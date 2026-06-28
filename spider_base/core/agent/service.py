"""子代理管理服务"""
import json
import logging
from sqlmodel import Session, select
from .models import SubAgent
from core.ssh_backend import SSHWorkspaceBackend

logger = logging.getLogger(__name__)


def _normalize_mcp_ids_to_str(mcp_server_ids) -> str:
    """将 mcp_server_ids 规范化为 JSON 数组字符串，避免双重序列化。
    支持入参类型：None / list / str（合法 JSON 数组字符串）/ 双重编码字符串。
    """
    if mcp_server_ids is None:
        return "[]"
    if isinstance(mcp_server_ids, list):
        return json.dumps(mcp_server_ids)
    if isinstance(mcp_server_ids, str):
        s = mcp_server_ids.strip()
        if not s:
            return "[]"
        try:
            parsed = json.loads(s)
        except Exception:
            # 非合法 JSON，回退为空数组
            logger.warning(f"mcp_server_ids 非合法 JSON，已重置为 []: {mcp_server_ids!r}")
            return "[]"
        # 处理双重编码：'"[24]"' -> '[24]' -> [24]
        if isinstance(parsed, str):
            try:
                parsed = json.loads(parsed)
            except Exception:
                logger.warning(f"mcp_server_ids 双重编码解码失败，已重置为 []: {mcp_server_ids!r}")
                return "[]"
        if isinstance(parsed, list):
            return json.dumps(parsed)
        return "[]"
    # 其它类型一律按空列表处理
    return "[]"


def create_sub_agent(
    db: Session, user_id: int, project_id: int | None,
    name: str, display_name: str, description: str,
    system_prompt: str, mcp_server_ids: list[int] | str | None = None
) -> SubAgent:
    """创建子代理（若同名已存在则更新并返回，避免重复创建）。"""
    from datetime import datetime, timezone

    stored_ids = _normalize_mcp_ids_to_str(mcp_server_ids)

    # 重复检测：同 user_id + project_id + name 视为同一子代理
    existing = get_sub_agent_by_name(db, user_id, project_id, name)
    if existing is not None:
        logger.info(f"子代理 '{name}' 已存在 (id={existing.id})，执行更新而非新建")
        existing.display_name = display_name or existing.display_name
        existing.description = description if description is not None else existing.description
        existing.system_prompt = system_prompt if system_prompt is not None else existing.system_prompt
        existing.mcp_server_ids = stored_ids
        existing.is_enabled = True
        existing.updated_at = datetime.now(timezone.utc)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    agent = SubAgent(
        user_id=user_id,
        project_id=project_id,
        name=name,
        display_name=display_name,
        description=description,
        system_prompt=system_prompt,
        mcp_server_ids=stored_ids,
        is_enabled=True,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def list_sub_agents(db: Session, user_id: int, project_id: int | None = None) -> list[SubAgent]:
    """列出用户的子代理"""
    stmt = select(SubAgent).where(SubAgent.user_id == user_id)
    if project_id is not None:
        stmt = stmt.where(
            (SubAgent.project_id == None) | (SubAgent.project_id == project_id)
        )
    return list(db.exec(stmt).all())


def get_sub_agent(db: Session, agent_id: int, user_id: int) -> SubAgent | None:
    """获取单个子代理"""
    stmt = select(SubAgent).where(SubAgent.id == agent_id, SubAgent.user_id == user_id)
    return db.exec(stmt).first()


def get_sub_agent_by_name(db: Session, user_id: int, project_id: int | None, name: str) -> SubAgent | None:
    """按名称获取子代理"""
    stmt = select(SubAgent).where(SubAgent.user_id == user_id, SubAgent.name == name)
    if project_id is not None:
        stmt = stmt.where(
            (SubAgent.project_id == None) | (SubAgent.project_id == project_id)
        )
    return db.exec(stmt).first()


def delete_sub_agent(db: Session, agent_id: int, user_id: int) -> bool:
    """删除子代理"""
    agent = get_sub_agent(db, agent_id, user_id)
    if not agent:
        return False
    db.delete(agent)
    db.commit()
    return True


def update_sub_agent(
    db: Session, agent_id: int, user_id: int,
    display_name: str | None = None, description: str | None = None,
    system_prompt: str | None = None, mcp_server_ids: list[int] | None = None,
    is_enabled: bool | None = None
) -> SubAgent | None:
    """更新子代理"""
    from datetime import datetime, timezone
    agent = get_sub_agent(db, agent_id, user_id)
    if not agent:
        return None
    if display_name is not None:
        agent.display_name = display_name
    if description is not None:
        agent.description = description
    if system_prompt is not None:
        agent.system_prompt = system_prompt
    if mcp_server_ids is not None:
        agent.mcp_server_ids = _normalize_mcp_ids_to_str(mcp_server_ids)
    if is_enabled is not None:
        agent.is_enabled = is_enabled
    agent.updated_at = datetime.now(timezone.utc)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


def build_sub_agent_tools(db: Session, sub_agent: SubAgent) -> list:
    """根据绑定的 mcp_server_ids 构建 MCP 工具列表"""
    from core.mcp.models import McpServer
    from core.mcp.loader import load_mcp_tools_sync
    from core.mcp.presets import MCP_CONTAINER_NAME, MCP_SSH_TARGET
    
    # 健壮解析 mcp_server_ids，兼容历史双重编码数据：'"[24]"' -> '[24]' -> [24]
    raw = sub_agent.mcp_server_ids
    if not raw:
        mcp_ids = []
    elif isinstance(raw, list):
        mcp_ids = raw
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except Exception as e:
            logger.warning(f"子代理 {sub_agent.name} mcp_server_ids 解析失败: {e}, 原始值={raw!r}")
            parsed = []
        if isinstance(parsed, str):
            # 双重编码场景
            try:
                parsed = json.loads(parsed)
            except Exception as e:
                logger.warning(f"子代理 {sub_agent.name} mcp_server_ids 二次解析失败: {e}, 原始值={raw!r}")
                parsed = []
        mcp_ids = parsed if isinstance(parsed, list) else []
    else:
        mcp_ids = []

    # 过滤非整数项，防止迭代到字符串字符（如 '['）
    mcp_ids = [i for i in mcp_ids if isinstance(i, int)]

    if not mcp_ids:
        logger.info(f"子代理 {sub_agent.name} 无绑定 MCP Server")
        return []
    
    logger.info(f"子代理 {sub_agent.name} 开始加载 MCP 工具, mcp_ids={mcp_ids}")
    
    # 查询绑定的 MCP Server
    connections = {}
    for mid in mcp_ids:
        stmt = select(McpServer).where(McpServer.id == mid)
        server = db.exec(stmt).first()
        if not server or not server.is_enabled:
            logger.warning(f"MCP Server id={mid} 不存在或未启用")
            continue
        
        conn = {"transport": server.transport}
        if server.transport == "stdio":
            # 通过 SSH 到 VM，再 docker exec 在 MCP 容器内执行
            original_command = server.command or "npx"
            original_args = json.loads(server.args) if server.args else []
            
            docker_cmd_parts = ["docker", "exec", "-i"]
            if server.env:
                env_dict = json.loads(server.env)
                for k, v in env_dict.items():
                    docker_cmd_parts.extend(["-e", f"{k}={v}"])
            docker_cmd_parts.append(MCP_CONTAINER_NAME)
            docker_cmd_parts.append(original_command)
            docker_cmd_parts.extend(original_args)
            
            conn["command"] = "ssh"
            conn["args"] = ["-q", "-o", "BatchMode=yes", MCP_SSH_TARGET] + docker_cmd_parts
            # Windows OpenSSH 需要 PROGRAMDATA 环境变量来定位系统 SSH 配置
            import os
            conn["env"] = {"PROGRAMDATA": os.environ.get("PROGRAMDATA", r"C:\ProgramData")}
            logger.info(f"MCP Server '{server.name}' 连接配置: ssh {MCP_SSH_TARGET} docker exec ... {original_command}")
        elif server.transport in ("http", "streamable_http", "sse"):
            if server.url:
                conn["url"] = server.url
            if server.headers:
                conn["headers"] = json.loads(server.headers)
        connections[server.name] = conn
    
    logger.info(f"开始同步加载 MCP 工具, connections={list(connections.keys())}")
    tools = load_mcp_tools_sync(connections)
    logger.info(f"MCP 工具加载完成, 共 {len(tools)} 个工具: {[t.name for t in tools]}")
    return tools


def run_sub_agent_task(
    db: Session, sub_agent: SubAgent, task_prompt: str,
    user_id: int, project_id: int | None,
    project_tools: list | None = None,
    stream_queue=None  # queue.Queue | None，用于流式推送事件
) -> str:
    """组装并执行子 Agent，返回结果字符串。如果提供 stream_queue，则逐 token 推送事件。"""
    import asyncio
    from core.agent.base_agent import BaseAgent
    
    # 加载绑定的 MCP 工具
    mcp_tools = build_sub_agent_tools(db, sub_agent)
    
    # 合并所有工具：项目工具 + MCP 工具
    all_tools = []
    if project_tools:
        all_tools.extend(project_tools)
    if mcp_tools:
        all_tools.extend(mcp_tools)
    
    # 创建专用 Agent，使用 SSH backend 以获得内置文件工具
    agent = BaseAgent(
        tools=all_tools if all_tools else None,
        system_prompt=sub_agent.system_prompt or f"你是{sub_agent.display_name}。{sub_agent.description}",
        backend=lambda rt: SSHWorkspaceBackend(user_id, project_id),
    )
    
    try:
        model = agent._get_model()
        graph = agent._create_agent(model)
        invoke_input = {"messages": [{"role": "user", "content": task_prompt}]}
        
        async def _run_stream():
            full_result = ""
            async for chunk in graph.astream(invoke_input, stream_mode="messages"):
                if isinstance(chunk, tuple):
                    msg = chunk[0]
                else:
                    msg = chunk
                # 跳过 tool_call_chunks（流式 tool call 的中间片段）
                if hasattr(msg, 'tool_call_chunks') and msg.tool_call_chunks:
                    continue
                # 工具调用开始
                if hasattr(msg, 'tool_calls') and msg.tool_calls:
                    if stream_queue:
                        for tc in msg.tool_calls:
                            if tc.get('name'):
                                stream_queue.put({"type": "tool_start", "tool": tc['name'], "args": tc.get('args', {})})
                    continue
                # 工具执行结果
                msg_type = getattr(msg, 'type', '')
                if msg_type == 'tool':
                    if stream_queue:
                        tool_name = getattr(msg, 'name', '') or ''
                        tool_content = str(getattr(msg, 'content', '') or '')
                        stream_queue.put({
                            "type": "tool_done",
                            "tool": tool_name,
                            "result": tool_content[:500],
                            "success": not tool_content.startswith('Error')
                        })
                    continue
                # 正常文本内容
                if hasattr(msg, 'content') and msg.content:
                    full_result += msg.content
                    if stream_queue:
                        stream_queue.put({"type": "content", "content": msg.content})
            return full_result
        
        # 在新事件循环中执行异步流式调用
        result = asyncio.run(_run_stream())
        return result if result else "子代理执行完成，无文本输出。"
    except Exception as e:
        logger.error(f"子代理 {sub_agent.name} 执行失败: {e}")
        return f"子代理执行失败: {str(e)}"
