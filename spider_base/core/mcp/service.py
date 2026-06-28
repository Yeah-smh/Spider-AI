"""MCP Server 管理服务"""
import json
from sqlmodel import Session, select
from .models import McpServer
from .presets import PRESET_MCP_SERVERS, MCP_CONTAINER_NAME, MCP_SSH_TARGET


def enable_preset(
    db: Session, user_id: int, project_id: int | None,
    preset_name: str, env_config: dict | None = None
) -> McpServer:
    """启用预置 MCP Server"""
    preset = next((p for p in PRESET_MCP_SERVERS if p["name"] == preset_name), None)
    if not preset:
        raise ValueError(f"未找到预置 MCP Server: {preset_name}")
    
    # 检查是否已存在
    stmt = select(McpServer).where(
        McpServer.user_id == user_id,
        McpServer.name == preset_name,
        McpServer.source == "preset",
    )
    if project_id is not None:
        stmt = stmt.where(McpServer.project_id == project_id)
    existing = db.exec(stmt).first()
    if existing:
        # 已存在则更新启用状态和环境变量
        existing.is_enabled = True
        if env_config:
            existing.env = json.dumps(env_config)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    
    server = McpServer(
        user_id=user_id,
        project_id=project_id,
        name=preset["name"],
        display_name=preset["display_name"],
        description=preset["description"],
        transport=preset["transport"],
        command=preset.get("command"),
        args=json.dumps(preset.get("args", [])),
        env=json.dumps(env_config) if env_config else None,
        is_enabled=True,
        is_public=True,
        source="preset",
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def create_custom_mcp(
    db: Session, user_id: int, project_id: int | None,
    name: str, display_name: str, description: str,
    transport: str, config: dict
) -> McpServer:
    """AI 创建自定义 MCP Server"""
    server = McpServer(
        user_id=user_id,
        project_id=project_id,
        name=name,
        display_name=display_name,
        description=description,
        transport=transport,
        command=config.get("command"),
        args=json.dumps(config.get("args", [])) if config.get("args") else None,
        env=json.dumps(config.get("env", {})) if config.get("env") else None,
        url=config.get("url"),
        headers=json.dumps(config.get("headers", {})) if config.get("headers") else None,
        is_enabled=True,
        is_public=False,
        source="custom",
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def list_mcp_servers(db: Session, user_id: int, project_id: int | None = None) -> list[McpServer]:
    """列出用户已启用的 MCP Server"""
    stmt = select(McpServer).where(McpServer.user_id == user_id)
    if project_id is not None:
        # 返回全局的 + 当前项目的
        stmt = stmt.where(
            (McpServer.project_id == None) | (McpServer.project_id == project_id)
        )
    return list(db.exec(stmt).all())


def get_mcp_server(db: Session, server_id: int, user_id: int) -> McpServer | None:
    """获取单个 MCP Server"""
    stmt = select(McpServer).where(McpServer.id == server_id, McpServer.user_id == user_id)
    return db.exec(stmt).first()


def delete_mcp_server(db: Session, server_id: int, user_id: int) -> bool:
    """删除 MCP Server"""
    server = get_mcp_server(db, server_id, user_id)
    if not server:
        return False
    db.delete(server)
    db.commit()
    return True


def update_mcp_config(
    db: Session, server_id: int, user_id: int, 
    env_config: dict | None = None, is_enabled: bool | None = None
) -> McpServer | None:
    """更新 MCP 配置"""
    server = get_mcp_server(db, server_id, user_id)
    if not server:
        return None
    if env_config is not None:
        server.env = json.dumps(env_config)
    if is_enabled is not None:
        server.is_enabled = is_enabled
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def build_mcp_connections(db: Session, user_id: int, project_id: int | None = None) -> dict:
    """构建 MultiServerMCPClient 需要的 connections 字典
    
    对于 stdio transport，通过 SSH 到 VM 再 docker exec 在 MCP 容器内执行命令。
    """
    import os
    servers = list_mcp_servers(db, user_id, project_id)
    connections = {}
    for server in servers:
        if not server.is_enabled:
            continue
        conn = {"transport": server.transport}
        if server.transport == "stdio":
            # 通过 SSH 到 VM，再 docker exec 在 MCP 容器内执行
            original_command = server.command or "npx"
            original_args = json.loads(server.args) if server.args else []
            
            # 构建 docker exec 命令
            docker_cmd_parts = ["docker", "exec", "-i"]
            if server.env:
                env_dict = json.loads(server.env)
                for k, v in env_dict.items():
                    docker_cmd_parts.extend(["-e", f"{k}={v}"])
            docker_cmd_parts.append(MCP_CONTAINER_NAME)
            docker_cmd_parts.append(original_command)
            docker_cmd_parts.extend(original_args)
            
            # 通过 SSH 执行远程命令
            conn["command"] = "ssh"
            conn["args"] = ["-q", "-o", "BatchMode=yes", f"{MCP_SSH_TARGET}"] + docker_cmd_parts
            # Windows OpenSSH 需要 PROGRAMDATA 来定位系统 SSH 配置
            conn["env"] = {"PROGRAMDATA": os.environ.get("PROGRAMDATA", r"C:\ProgramData")}
        elif server.transport in ("http", "streamable_http", "sse"):
            if server.url:
                conn["url"] = server.url
            if server.headers:
                conn["headers"] = json.loads(server.headers)
        connections[server.name] = conn
    return connections
