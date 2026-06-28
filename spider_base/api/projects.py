"""
Projects API - 文件系统方案
项目元数据存数据库，文件操作通过 workspace 模块操作 VM 真实文件系统
"""
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlmodel import Session, select
from langchain_core.tools import tool

from core.database import get_db
from core.deps import get_current_user
from core.models import User, Project, ProjectChatMessage
from core import workspace

router = APIRouter(prefix="/projects", tags=["Projects"])


# ============== 请求/响应模型 ==============

class CreateProjectRequest(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MoveFileRequest(BaseModel):
    source_path: str      # 源路径
    destination_path: str  # 目标路径（新路径）


class CreateFileRequest(BaseModel):
    name: str
    content: str = ""
    parent_path: str = ""  # 父目录相对路径，空串表示根目录


class CreateFolderRequest(BaseModel):
    name: str
    parent_path: str = ""  # 父目录相对路径


class UpdateFileRequest(BaseModel):
    content: Optional[str] = None


class RenameFileRequest(BaseModel):
    new_name: str  # 新文件名（不含路径）


class FileContentResponse(BaseModel):
    """读取文件响应"""
    path: str
    name: str
    content: str
    language: Optional[str] = None


# ============== 辅助函数 ==============

def _get_user_project(project_id: int, user_id: int, db: Session) -> Project:
    """验证项目所有权，返回项目或 404"""
    project = db.get(Project, project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _build_file_path(parent_path: str, name: str) -> str:
    """构建完整文件路径"""
    if parent_path:
        return f"{parent_path}/{name}"
    return name


# ============== 项目 CRUD ==============

@router.post("")
def create_project(
    request: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建项目（同时创建 VM 工作空间目录）"""
    project = Project(
        user_id=current_user.id,
        name=request.name,
        description=request.description
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # 创建 VM 工作空间目录
    try:
        workspace.ensure_workspace(current_user.id, project.id)
    except RuntimeError as e:
        # 创建目录失败，回滚数据库
        db.delete(project)
        db.commit()
        raise HTTPException(status_code=500, detail=f"创建工作空间失败: {str(e)}")
    
    return project


@router.get("")
def get_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户项目列表"""
    projects = db.exec(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(Project.updated_at.desc())
    ).all()
    return projects


@router.get("/{project_id}")
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取单个项目"""
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除项目（同时删除 VM 工作空间目录）"""
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 先删除 VM 目录
    workspace.delete_path(current_user.id, project_id, "")
    
    # 先删除关联的子表记录（外键约束）
    from core.skills.models import Skill
    from core.agent.models import SubAgent
    from core.mcp.models import McpServer
    from sqlmodel import select
    
    # 删除项目聊天消息
    chat_messages = db.exec(
        select(ProjectChatMessage).where(ProjectChatMessage.project_id == project_id)
    ).all()
    for msg in chat_messages:
        db.delete(msg)
    
    # 删除关联的子代理
    sub_agents = db.exec(select(SubAgent).where(SubAgent.project_id == project_id)).all()
    for sub_agent in sub_agents:
        db.delete(sub_agent)
    
    # 删除关联的 MCP 服务
    mcp_servers = db.exec(select(McpServer).where(McpServer.project_id == project_id)).all()
    for mcp_server in mcp_servers:
        db.delete(mcp_server)
    
    # 删除关联的 skills
    skills = db.exec(select(Skill).where(Skill.project_id == project_id)).all()
    for skill in skills:
        db.delete(skill)
    
    # 清理 Qdrant 中引用了该项目名称的长期记忆（避免删项目后残留过时信息）
    try:
        from core.models import LongtermMemory
        from core.memory.qdrant_client import get_qdrant_client
        from core.config import settings
        
        project_name = project.name
        stale_memories = db.exec(
            select(LongtermMemory).where(
                LongtermMemory.user_id == current_user.id,
                LongtermMemory.title.contains(project_name)
            )
        ).all()
        
        if stale_memories:
            # 从 Qdrant 删除向量
            qdrant = get_qdrant_client()
            if qdrant:
                from qdrant_client.models import PointIdsList
                point_ids = [m.id for m in stale_memories]
                qdrant.delete(
                    collection_name=settings.QDRANT_COLLECTION,
                    points_selector=PointIdsList(points=point_ids),
                )
            # 从 DB 删除记录
            for mem in stale_memories:
                db.delete(mem)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"清理项目相关记忆失败: {e}")
    
    # 再删数据库记录
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.put("/{project_id}")
def update_project(
    project_id: int,
    request: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新项目名称和描述"""
    project = db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if request.name is not None:
        project.name = request.name
    if request.description is not None:
        project.description = request.description
    
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


# ============== 文件 CRUD ==============

@router.get("/{project_id}/files")
def get_project_files(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目文件列表（树形结构）"""
    _get_user_project(project_id, current_user.id, db)
    # 确保工作空间目录存在
    workspace.ensure_workspace(current_user.id, project_id)
    try:
        files = workspace.list_files(current_user.id, project_id)
        return files
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"无法连接到工作空间: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {e}")


@router.post("/{project_id}/files")
def create_file(
    project_id: int,
    request: CreateFileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建文件"""
    _get_user_project(project_id, current_user.id, db)
    
    file_path = _build_file_path(request.parent_path, request.name)
    
    if not workspace.write_file(current_user.id, project_id, file_path, request.content):
        raise HTTPException(status_code=500, detail="创建文件失败")
    
    return {
        "path": file_path,
        "name": request.name,
        "content": request.content,
        "language": workspace._detect_language(request.name)
    }


@router.get("/{project_id}/files/{file_path:path}")
def get_file_content(
    project_id: int,
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取单个文件（含 content）"""
    _get_user_project(project_id, current_user.id, db)
    
    content = workspace.read_file(current_user.id, project_id, file_path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found")
    
    name = file_path.split("/")[-1]
    
    return FileContentResponse(
        path=file_path,
        name=name,
        content=content,
        language=workspace._detect_language(name)
    )


@router.put("/{project_id}/files/{file_path:path}")
def update_file(
    project_id: int,
    file_path: str,
    request: UpdateFileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新文件内容"""
    _get_user_project(project_id, current_user.id, db)
    
    if request.content is None:
        raise HTTPException(status_code=400, detail="content is required")
    
    if not workspace.write_file(current_user.id, project_id, file_path, request.content):
        raise HTTPException(status_code=500, detail="更新文件失败")
    
    name = file_path.split("/")[-1]
    
    return {
        "path": file_path,
        "name": name,
        "content": request.content,
        "language": workspace._detect_language(name)
    }


@router.delete("/{project_id}/files/{file_path:path}")
def delete_file(
    project_id: int,
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除文件或目录"""
    _get_user_project(project_id, current_user.id, db)
    
    if not workspace.delete_path(current_user.id, project_id, file_path):
        raise HTTPException(status_code=500, detail="删除失败")
    
    return {"ok": True}


@router.patch("/{project_id}/files/{file_path:path}")
def rename_file(
    project_id: int,
    file_path: str,
    request: RenameFileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """重命名文件或文件夹"""
    _get_user_project(project_id, current_user.id, db)
    
    # 构建新路径
    parent = "/".join(file_path.split("/")[:-1])
    new_path = f"{parent}/{request.new_name}" if parent else request.new_name
    
    if not workspace.rename_path(current_user.id, project_id, file_path, new_path):
        raise HTTPException(status_code=500, detail="重命名失败")
    
    return {
        "old_path": file_path,
        "new_path": new_path,
        "name": request.new_name
    }


@router.post("/{project_id}/files/move")
def move_file(
    project_id: int,
    request: MoveFileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """移动文件或文件夹"""
    _get_user_project(project_id, current_user.id, db)
    
    if not workspace.move_path(current_user.id, project_id, request.source_path, request.destination_path):
        raise HTTPException(status_code=500, detail="移动失败")
    
    return {
        "old_path": request.source_path,
        "new_path": request.destination_path
    }


@router.post("/{project_id}/files/upload")
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    parent_path: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传文件（Multipart）"""
    _get_user_project(project_id, current_user.id, db)
    
    content_bytes = await file.read()
    file_path = _build_file_path(parent_path, file.filename or "unnamed")
    
    if not workspace.upload_file(current_user.id, project_id, file_path, content_bytes):
        raise HTTPException(status_code=500, detail="上传文件失败")
    
    return {
        "path": file_path,
        "name": file.filename,
        "size": len(content_bytes),
        "language": workspace._detect_language(file.filename or "")
    }


@router.post("/{project_id}/folders")
def create_folder(
    project_id: int,
    request: CreateFolderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建文件夹"""
    _get_user_project(project_id, current_user.id, db)
    
    folder_path = _build_file_path(request.parent_path, request.name)
    
    if not workspace.create_folder(current_user.id, project_id, folder_path):
        raise HTTPException(status_code=500, detail="创建文件夹失败")
    
    return {
        "path": folder_path,
        "name": request.name,
        "is_folder": True
    }


# ============== 代码执行 ==============

import time
import shlex
import subprocess
import re as _re

from core.config import settings
from langchain_openai import ChatOpenAI


# ============== 代码补全（Ghost Text） ==============

# 模块级单例：使用 PREDICT_MODEL（本地轻量模型，低延迟）
# 若本地服务不可用，可降级为 DASHSCOPE_MODEL，但会有更高延迟。
_code_complete_llm = ChatOpenAI(
    model=settings.PREDICT_MODEL,
    openai_api_key="not-needed",
    openai_api_base=settings.PREDICT_BASE_URL,
    max_tokens=150,
    temperature=0,
    timeout=10,
    model_kwargs={"extra_body": {"chat_template_kwargs": {"enable_thinking": False}}},
)


class CodeCompleteRequest(BaseModel):
    code: str            # 当前文件完整代码
    cursor_line: int     # 光标所在行（1-based）
    cursor_column: int   # 光标所在列（1-based）
    language: str = ""   # 文件语言（python/javascript/typescript 等）
    file_path: str = ""  # 文件路径（可选，提供更好上下文）


def _split_code_at_cursor(code: str, line: int, column: int) -> tuple[str, str]:
    """按 1-based 光标位置把代码切成 (prefix, suffix)"""
    lines = code.split("\n")
    line_idx = max(0, min(line - 1, len(lines) - 1)) if lines else 0
    if not lines:
        return "", ""
    col_idx = max(0, min(column - 1, len(lines[line_idx])))
    prefix_lines = lines[:line_idx] + [lines[line_idx][:col_idx]]
    suffix_lines = [lines[line_idx][col_idx:]] + lines[line_idx + 1:]
    return "\n".join(prefix_lines), "\n".join(suffix_lines)


def _clean_completion(text: str, prefix: str) -> str:
    """后处理：去 think 标签、markdown 围栏、与 prefix 重复部分"""
    if not text:
        return ""
    # 去除 <think>...</think>（qwen3 推理标签）
    text = _re.sub(r"<think>[\s\S]*?</think>", "", text, flags=_re.IGNORECASE).strip()
    # 去除 markdown 代码块围栏
    fence = _re.match(r"^```[a-zA-Z0-9_+-]*\n([\s\S]*?)\n?```\s*$", text)
    if fence:
        text = fence.group(1)
    else:
        # 仅前缀有 ``` 的情况
        if text.startswith("```"):
            text = _re.sub(r"^```[a-zA-Z0-9_+-]*\n?", "", text)
            text = _re.sub(r"\n?```\s*$", "", text)
    text = text.strip("\n")
    # 与 prefix 末尾去重：如果模型重复了光标前的最后若干字符
    if prefix and text:
        max_overlap = min(len(prefix), len(text), 80)
        for n in range(max_overlap, 0, -1):
            if prefix.endswith(text[:n]):
                text = text[n:]
                break
    return text


@router.post("/{project_id}/code-complete")
async def code_complete(
    project_id: int,
    request: CodeCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 代码补全（Ghost Text）— 返回光标处的预测续写"""
    # 验证项目所有权（即便补全无副作用，也避免被未授权用户滥用 LLM 资源）
    _get_user_project(project_id, current_user.id, db)

    code = request.code or ""
    if len(code.strip()) < 3:
        return {"completion": ""}

    prefix, suffix = _split_code_at_cursor(code, request.cursor_line, request.cursor_column)
    # 截断上下文（前 2000 字符，后 500 字符）
    prefix_ctx = prefix[-2000:]
    suffix_ctx = suffix[:500]

    prompt = (
        "你是一个代码补全引擎。根据以下代码上下文，预测光标位置接下来最可能的代码。\n\n"
        "规则：\n"
        "- 只输出补全的代码片段，不要解释\n"
        "- 不要重复已有代码\n"
        "- 保持代码风格一致\n"
        "- 最多输出 3-5 行\n"
        "- 如果无法确定补全内容，返回空字符串\n\n"
        f"语言: {request.language or 'plaintext'}\n"
        f"文件: {request.file_path or '(unnamed)'}\n\n"
        "--- 光标前的代码 ---\n"
        f"{prefix_ctx}\n"
        "--- 光标后的代码 ---\n"
        f"{suffix_ctx}\n"
        "--- 请补全 ---"
    )

    try:
        result = await _code_complete_llm.ainvoke([{"role": "user", "content": prompt}])
        raw = (result.content or "").strip() if hasattr(result, "content") else str(result).strip()
    except Exception as e:
        logger.warning(f"code_complete LLM call failed: {e}")
        return {"completion": ""}

    completion = _clean_completion(raw, prefix_ctx)
    # 限制最多 5 行，防止幻觉过长
    if completion:
        parts = completion.split("\n")
        if len(parts) > 5:
            completion = "\n".join(parts[:5])
    # 调试日志：观察实际返回的 completion 内容（截断 100 字符）
    print(
        f"[code-complete] raw_len={len(raw)} cleaned_len={len(completion)} "
        f"completion: '{(completion[:100] if completion else '')}'"
    )
    return {"completion": completion}


class RunCodeRequest(BaseModel):
    file_path: str  # 相对路径，如 "main.py" 或 "src/app.py"
    language: str = "python"  # 目前只支持 python


class RunCodeResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int


@router.post("/{project_id}/run", response_model=RunCodeResponse)
async def run_code(
    project_id: int,
    body: RunCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """在 Docker 容器中执行代码
    
    使用 python:3.12-slim 镜像执行 Python 代码。
    
    安全措施：
    - 内存限制 128MB，CPU 限制 0.5 核
    - 禁用网络（--network=none）
    - 文件只读挂载（:ro）
    - 执行超时 30 秒
    """
    # 1. 验证项目所有权
    _get_user_project(project_id, current_user.id, db)
    
    # 2. 构建工作空间路径
    workspace_path = f"{settings.WORKSPACE_BASE_DIR}/{current_user.id}/{project_id}"
    
    # 3. 构建 docker run 命令
    #    使用 python:3.12-slim 镜像
    docker_cmd = (
        f"docker run --rm "
        f"--memory=128m --cpus=0.5 "
        f"--network=none "
        f"-v {workspace_path}:/app:ro "
        f"-w /app "
        f"python:3.12-slim "
        f"timeout 30 python {shlex.quote(body.file_path)}"
    )
    
    # 4. 通过 SSH 在 VM 上执行
    try:
        start = time.time()
        result = subprocess.run(
            ["ssh", "-q", f"{settings.WORKSPACE_SSH_USER}@{settings.WORKSPACE_SSH_HOST}", docker_cmd],
            capture_output=True,
            text=True,
            timeout=60,  # 给额外时间（含容器启动）
            encoding='utf-8',
            errors='replace'
        )
        duration_ms = int((time.time() - start) * 1000)
        
        return RunCodeResponse(
            stdout=result.stdout or "",
            stderr=result.stderr or "",
            exit_code=result.returncode,
            duration_ms=duration_ms
        )
        
    except subprocess.TimeoutExpired:
        return RunCodeResponse(
            stdout="",
            stderr="执行超时（SSH 连接超时 60 秒）",
            exit_code=-1,
            duration_ms=60000
        )
    except Exception as e:
        return RunCodeResponse(
            stdout="",
            stderr=f"执行失败: {str(e)}",
            exit_code=-1,
            duration_ms=0
        )


# ============== 项目聊天（SSE 流式响应）==============

import json
import uuid
import logging
from fastapi.responses import StreamingResponse

from core.agent.base_agent import BaseAgent
from core.redis_client import get_redis
from core.memory.cross_context import get_chat_summary_for_project, get_preference_summary

logger = logging.getLogger(__name__)

# Redis 缓存配置
PROJECT_CONTEXT_CACHE_PREFIX = "project_ctx:"
PROJECT_CONTEXT_CACHE_TTL = 3600  # 1小时


def _build_work_tools(user_id: int, project_id: int):
    """构建实际工作工具（给子Agent用）- 包含技能管理、MCP管理"""
    
    @tool
    def create_skill(name: str, description: str, content: str) -> str:
        """创建一个 SKILL.md 格式的技能。
        name: kebab-case标识符（如 count-python-files）
        description: 简短描述
        content: 完整的 SKILL.md 内容（Markdown 格式的指令文档，包含 YAML 前置元数据）"""
        try:
            from core.skills import service as skill_service
            db = next(get_db())
            try:
                skill = skill_service.create_skill(
                    db=db, user_id=user_id, project_id=project_id,
                    name=name, description=description, content=content
                )
                return f"技能 '{skill.name}' 创建成功 (id={skill.id})"
            finally:
                db.close()
        except Exception as e:
            return f"创建技能失败: {str(e)}"

    @tool
    def use_skill(skill_name: str) -> str:
        """读取指定技能的完整 SKILL.md 内容，然后按其中的指令执行任务。
        skill_name: 技能的 kebab-case 名称"""
        try:
            from core.skills import service as skill_service
            db = next(get_db())
            try:
                skill = skill_service.get_skill_by_name(db, user_id, project_id, skill_name)
                if not skill:
                    return f"未找到技能: {skill_name}"
                return skill.content
            finally:
                db.close()
        except Exception as e:
            return f"读取技能失败: {str(e)}"

    @tool
    def delete_skill(skill_name: str) -> str:
        """删除指定名称的技能。skill_name: 技能的 kebab-case 名称"""
        try:
            from core.skills import service as skill_service
            db = next(get_db())
            try:
                skill = skill_service.get_skill_by_name(db, user_id, project_id, skill_name)
                if not skill:
                    return f"未找到技能: {skill_name}"
                ok = skill_service.delete_skill(db, skill.id, user_id)
                if ok:
                    return f"技能 '{skill_name}' 删除成功"
                else:
                    return f"无权限删除技能: {skill_name}"
            finally:
                db.close()
        except Exception as e:
            return f"删除技能失败: {str(e)}"

    @tool
    def create_mcp(name: str, display_name: str, description: str, transport: str, config_json: str) -> str:
        """创建自定义 MCP Server。
        name: kebab-case 标识符
        display_name: 显示名称
        description: MCP Server 描述
        transport: 连接方式 "stdio" 或 "http"
        config_json: JSON 字符串，stdio 需要 {"command": "...", "args": [...], "env": {...}}，http 需要 {"url": "...", "headers": {...}}
        """
        try:
            import json as _json
            from core.mcp import service as mcp_service
            config = _json.loads(config_json)
            _db = next(get_db())
            try:
                server = mcp_service.create_custom_mcp(
                    _db, user_id, project_id,
                    name=name, display_name=display_name,
                    description=description, transport=transport, config=config
                )
                return f"MCP Server '{display_name}' 创建成功 (ID: {server.id})"
            finally:
                _db.close()
        except Exception as e:
            return f"创建 MCP Server 失败: {str(e)}"

    @tool
    def enable_mcp(preset_name: str, env_config_json: str = "{}") -> str:
        """启用预置的公共 MCP Server。
        preset_name: 预置 Server 名称，可选值: github, fetch, filesystem, memory, sequential-thinking
        env_config_json: JSON 字符串，包含所需的环境变量配置，如 {"GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"}
        """
        try:
            import json as _json
            from core.mcp import service as mcp_service
            env_config = _json.loads(env_config_json) if env_config_json else {}
            _db = next(get_db())
            try:
                server = mcp_service.enable_preset(
                    _db, user_id, project_id,
                    preset_name=preset_name, env_config=env_config if env_config else None
                )
                return f"MCP Server '{server.display_name}' 已启用"
            finally:
                _db.close()
        except Exception as e:
            return f"启用 MCP Server 失败: {str(e)}"

    return [create_skill, use_skill, delete_skill, create_mcp, enable_mcp]


def _build_dispatch_tools(user_id: int, project_id: int, work_tools: list, stream_context: dict = None):
    """构建调度工具（给主Agent用）- 只包含子代理管理工具"""
    
    @tool
    def create_sub_agent(name: str, display_name: str, description: str,
                         system_prompt: str, mcp_server_ids_json: str = "[]") -> str:
        """创建一个专用子代理。当用户需要特定能力的 Agent 时使用。
        name: kebab-case 标识符，如 "data-analyst"
        display_name: 显示名称，如 "数据分析师"
        description: 子代理的能力描述
        system_prompt: 子代理的专用系统提示词（指导其行为和专业领域）
        mcp_server_ids_json: JSON 数组，绑定的 MCP Server ID 列表，如 "[1, 3]"。可通过已启用的 MCP Server 获取 ID。
        """
        try:
            from core.agent import service as agent_service
            # 直接传递原始参数，由 service 层统一规范化，避免双重序列化
            _db = next(get_db())
            try:
                agent = agent_service.create_sub_agent(
                    _db, user_id, project_id,
                    name=name, display_name=display_name,
                    description=description, system_prompt=system_prompt,
                    mcp_server_ids=mcp_server_ids_json
                )
                return f"子代理 '{display_name}' 创建成功 (ID: {agent.id}, 名称: {agent.name})"
            finally:
                _db.close()
        except Exception as e:
            return f"创建子代理失败: {str(e)}"

    @tool
    def run_sub_agent(agent_name: str, task: str) -> str:
        """调用已注册的子代理执行任务。子代理会使用其绑定的 MCP 工具和项目工具完成任务。
        agent_name: 子代理的 name 标识符（kebab-case）
        task: 要执行的具体任务描述
        """
        try:
            from core.agent import service as agent_service
            _db = next(get_db())
            try:
                sub_agent = agent_service.get_sub_agent_by_name(_db, user_id, project_id, agent_name)
                if not sub_agent:
                    return f"未找到子代理: {agent_name}"
                if not sub_agent.is_enabled:
                    return f"子代理 '{agent_name}' 已被禁用"
                # 关键：把 work_tools 传给子Agent
                result = agent_service.run_sub_agent_task(
                    _db, sub_agent, task, user_id, project_id,
                    project_tools=work_tools,
                    stream_queue=stream_context.get("queue") if stream_context else None
                )
                return result
            finally:
                _db.close()
        except Exception as e:
            return f"子代理执行失败: {str(e)}"

    @tool
    def list_sub_agents() -> str:
        """列出当前项目已注册的所有子代理及其能力描述。"""
        try:
            import json as _json
            from core.agent import service as agent_service
            _db = next(get_db())
            try:
                agents = agent_service.list_sub_agents(_db, user_id, project_id)
                if not agents:
                    return "当前项目暂无已注册的子代理。"
                lines = []
                for a in agents:
                    try:
                        parsed = _json.loads(a.mcp_server_ids) if a.mcp_server_ids else []
                        if isinstance(parsed, str):
                            parsed = _json.loads(parsed)
                        mcp_ids = parsed if isinstance(parsed, list) else []
                    except Exception:
                        mcp_ids = []
                    status = "启用" if a.is_enabled else "禁用"
                    lines.append(f"- {a.name} ({a.display_name}): {a.description} [MCP工具数: {len(mcp_ids)}, 状态: {status}]")
                return "已注册子代理:\n" + "\n".join(lines)
            finally:
                _db.close()
        except Exception as e:
            return f"获取子代理列表失败: {str(e)}"

    return [create_sub_agent, run_sub_agent, list_sub_agents]


def _get_redis_safe():
    """安全获取 Redis 连接，失败返回 None"""
    try:
        r = get_redis()
        r.ping()
        return r
    except Exception as e:
        logger.warning(f"Redis unavailable: {e}")
        return None


def _load_project_context_from_cache(redis_client, cache_key: str) -> list | None:
    """从 Redis 加载项目上下文"""
    try:
        data = redis_client.get(cache_key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning(f"Redis get failed: {e}")
        return None


def _save_project_context_to_cache(redis_client, cache_key: str, messages: list):
    """将项目上下文写入 Redis 缓存"""
    try:
        redis_client.setex(cache_key, PROJECT_CONTEXT_CACHE_TTL, json.dumps(messages, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Redis set failed: {e}")


class ProjectChatRequest(BaseModel):
    """项目聊天请求"""
    prompt: str
    files: list[str] = []  # 要关联的文件路径列表（相对于项目根目录）
    session_id: str | None = None  # 可选，用于多轮对话


@router.post("/{project_id}/chat")
def project_chat(
    project_id: int,
    request: ProjectChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    项目聊天接口 - SSE 流式响应
    
    Header: Authorization: Bearer {token}
    Body: { 
        "prompt": "用户消息", 
        "files": ["main.py", "utils.py"],  // 可选，要关联的文件
        "session_id": "xxx"  // 可选，用于多轮对话
    }
    Response: SSE stream
        data: {"type": "content", "content": "..."}
        data: {"type": "done", "session_id": "xxx"}
    """
    # 1. 验证项目归属
    project = _get_user_project(project_id, current_user.id, db)
    
    # 2. 生成或使用现有 session_id
    session_id = request.session_id or str(uuid.uuid4())
    cache_key = f"{PROJECT_CONTEXT_CACHE_PREFIX}{current_user.id}:{project_id}:{session_id}"
    
    # 3. 获取 Redis 连接（可选）
    r = _get_redis_safe()
    
    # 4. 构建文件上下文
    file_contexts = []
    max_file_length = 10000  # 每个文件最大字符数
    
    for file_path in request.files:
        content = workspace.read_file(current_user.id, project_id, file_path)
        if content is not None:
            # 截断过长的文件
            if len(content) > max_file_length:
                content = content[:max_file_length] + "\n... (文件已截断)"
            file_contexts.append(f"--- 文件: {file_path} ---\n{content}\n")
        else:
            file_contexts.append(f"--- 文件: {file_path} ---\n[文件不存在或无法读取]\n")
    
    # 5. 构建项目工具和专用 agent
    # 构建工作工具（给子Agent用，主Agent不直接使用）
    work_tools = _build_work_tools(current_user.id, project_id)
    
    # 构建调度工具（给主Agent用）
    stream_context = {"queue": None}
    dispatch_tools = _build_dispatch_tools(current_user.id, project_id, work_tools, stream_context)
    
    # 主Agent 只用调度工具
    tools = dispatch_tools
    
    # 构建项目专用系统提示（调度模式）
    project_system_prompt = f"""你是项目「{project.name}」的智能调度器。
{f'项目描述：{project.description}' if project.description else ''}

【核心规则 - 必须严格遵守】
1. 你没有直接访问文件系统、网络或任何外部资源的能力
2. 你必须且只能通过调用工具（create_sub_agent / run_sub_agent / list_sub_agents）来完成任务
3. 绝对禁止编造或假装工具调用结果
4. 对于任何需要执行操作的请求，必须调用工具

【工作流程】
- 收到用户任务 → 调用 list_sub_agents 查看可用子代理
- 如果有合适的子代理 → 调用 run_sub_agent 委派任务
- 如果没有合适的子代理 → 调用 create_sub_agent 创建一个，然后 run_sub_agent
- 收到子代理结果 → 简短确认完成（子代理输出已实时呈现给用户，不要重复其详细内容，只需 1-2 句话总结状态）

【你能直接回复的唯一情况】
- 简单的问候或闲聊（如"你好"、"谢谢"）
- 解释你的能力和使用方法
- 总结子代理返回的结果

【可用工具】
- list_sub_agents: 查看已注册的子代理列表
- create_sub_agent: 创建新的专用子代理（指定名称、能力描述、系统提示词、绑定 MCP 工具）
- run_sub_agent: 委派任务给已注册的子代理执行

【创建子代理的原则】
- 为每个专业领域创建独立的子代理（如：数据分析师、代码开发者、文档撰写者等）
- 子代理的 system_prompt 应该清晰描述其职责和工作方式
- 根据子代理需要的能力，绑定相应的 MCP 工具
- 子代理自动拥有项目文件操作能力（读写文件、创建技能等）

使用中文回复，使用 Markdown 格式。"""

    # 加载已注册子代理摘要
    from core.agent import service as agent_service
    sub_agents_list = agent_service.list_sub_agents(db, current_user.id, project_id)
    if sub_agents_list:
        import json as _json
        sub_agent_info = "\n## 已注册子代理\n"
        for sa in sub_agents_list:
            mcp_ids = _json.loads(sa.mcp_server_ids) if sa.mcp_server_ids else []
            sub_agent_info += f"- {sa.name} ({sa.display_name}): {sa.description} [绑定MCP: {len(mcp_ids)}个]\n"
        project_system_prompt += sub_agent_info
    
    # 注入可用 MCP Server 列表（让主Agent知道创建子代理时该绑定哪些 ID）
    from core.mcp.service import list_mcp_servers
    available_mcps = list_mcp_servers(db, current_user.id, project_id)
    enabled_mcps = [s for s in available_mcps if s.is_enabled]
    if enabled_mcps:
        mcp_info = "\n## 可用 MCP Server（创建子代理时通过 ID 绑定）\n"
        for s in enabled_mcps:
            mcp_info += f"- ID={s.id}: {s.display_name} — {s.description}\n"
        mcp_info += "\n创建需要网络能力的子代理时，务必在 mcp_server_ids_json 中填入对应的 ID，如 \"[1]\"。\n"
        project_system_prompt += mcp_info
    
    # 注入跨平台上下文（ChatPage 摘要和偏好记忆）
    cross_context_parts = []
    
    # 获取 ChatPage 对话摘要
    chat_summary = get_chat_summary_for_project(current_user.id, db)
    if chat_summary:
        cross_context_parts.append(chat_summary)
    
    # 获取偏好记忆摘要
    preference_summary = get_preference_summary(current_user.id, db)
    if preference_summary:
        cross_context_parts.append(preference_summary)
    
    # 追加到系统提示词
    if cross_context_parts:
        project_system_prompt += "\n\n## 用户跨平台上下文\n"
        project_system_prompt += "\n\n".join(cross_context_parts)

    # 创建带工具的 agent（主Agent只用调度工具，不传skills）
    project_agent = BaseAgent(
        tools=tools,
        system_prompt=project_system_prompt,
        enable_search=False,  # 主Agent关闭搜索，强制走子代理
        tool_choice="auto",
        # 不传 backend → 用 create_agent，无内置文件工具，纯调度模式
    )
    
    # 6. 构建用户消息（仅包含文件上下文，项目信息已在系统提示中）
    file_context_str = "\n".join(file_contexts) if file_contexts else ""
    
    if file_context_str:
        user_message = f"以下是相关文件内容：\n{file_context_str}\n\n{request.prompt}"
    else:
        user_message = request.prompt
    
    # 7. 加载历史上下文（如果有多轮对话）
    messages = None
    if r:
        messages = _load_project_context_from_cache(r, cache_key)
    
    if messages is None:
        messages = []
    
    # 8. 构建当前用户消息
    messages.append({"role": "user", "content": user_message})
    
    # 9. 追加用户消息到 Redis 缓存
    if r:
        _save_project_context_to_cache(r, cache_key, messages)
    
    # 9.1 保存用户消息到数据库
    try:
        user_msg = ProjectChatMessage(
            project_id=project_id,
            user_id=current_user.id,
            session_id=session_id,
            role="user",
            content=request.prompt,
        )
        db.add(user_msg)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to save user message to DB: {e}")
    
    # 10. SSE 流式生成器
    # 已知工具列表（供前端 UI 展示）- 主Agent只用3个调度工具
    knownTools = ["create_sub_agent", "run_sub_agent", "list_sub_agents"]
    
    def generate():
        import queue as queue_module
        import threading

        event_queue = queue_module.Queue()
        stream_context["queue"] = event_queue

        # 发送已知工具列表
        yield f"data: {json.dumps({'type': 'init', 'knownTools': knownTools}, ensure_ascii=False)}\n\n"

        full_response = ""
        artifacts = []

        def _agent_thread():
            """后台线程：驱动主Agent流式执行"""
            try:
                for chunk in project_agent.quick_start_stream(messages):
                    if isinstance(chunk, tuple) and len(chunk) >= 1:
                        msg = chunk[0]

                        # 工具调用开始
                        if hasattr(msg, 'tool_calls') and msg.tool_calls:
                            for tc in msg.tool_calls:
                                if tc.get('name'):
                                    event_queue.put({"type": "tool_start", "tool": tc['name'], "args": tc.get('args', {})})
                            continue
                        # 跳过 tool_call_chunks
                        if hasattr(msg, 'tool_call_chunks') and msg.tool_call_chunks:
                            continue
                        # 工具执行结果
                        msg_type = getattr(msg, 'type', '')
                        if msg_type == 'tool':
                            tool_name = getattr(msg, 'name', '') or ''
                            tool_result = getattr(msg, 'content', '') or ''
                            success = not str(tool_result).startswith('Error')
                            if tool_name == 'write_file' and success:
                                event_queue.put({"type": "_artifact", "path": str(tool_result).replace("Updated file ", "")})
                            event_queue.put({"type": "tool_done", "tool": tool_name, "result": str(tool_result)[:200], "success": success})
                            continue
                        # 正常文本内容
                        if hasattr(msg, 'content') and msg.content:
                            event_queue.put({"type": "content", "content": msg.content})
                event_queue.put(None)  # sentinel: 正常结束
            except Exception as e:
                event_queue.put({"type": "error", "content": str(e)})
                event_queue.put(None)

        thread = threading.Thread(target=_agent_thread, daemon=True)
        thread.start()

        # 主循环：从 queue 读取事件并 yield SSE
        while True:
            event = event_queue.get()
            if event is None:
                break
            if event["type"] == "content":
                full_response += event["content"]
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            elif event["type"] == "_artifact":
                artifacts.append({"path": event["path"], "action": "write"})
            elif event["type"] == "error":
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        thread.join(timeout=10)

        # 流结束后，追加 AI 回复到缓存
        if r:
            r_inner = _get_redis_safe()
            if r_inner:
                updated_messages = messages + [{"role": "assistant", "content": full_response}]
                _save_project_context_to_cache(r_inner, cache_key, updated_messages)

        # 保存 AI 回复到数据库
        if full_response:
            try:
                _db = next(get_db())
                try:
                    ai_msg = ProjectChatMessage(
                        project_id=project_id,
                        user_id=current_user.id,
                        session_id=session_id,
                        role="assistant",
                        content=full_response,
                    )
                    _db.add(ai_msg)
                    _db.commit()
                finally:
                    _db.close()
            except Exception as e:
                logger.warning(f"Failed to save AI message to DB: {e}")

        # done 事件附带 artifacts
        yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'artifacts': artifacts}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


# ============== 历史消息 API ==============

@router.get("/{project_id}/messages")
def get_project_messages(
    project_id: int,
    session_id: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    获取项目的聊天历史消息

    如果指定 session_id，加载该会话的消息；
    否则加载最新会话的消息。
    """
    # 验证项目所有权
    project = db.exec(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == current_user.id
        )
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # 如果指定了 session_id，加载该会话的消息
    if session_id:
        stmt = select(ProjectChatMessage).where(
            ProjectChatMessage.project_id == project_id,
            ProjectChatMessage.user_id == current_user.id,
            ProjectChatMessage.session_id == session_id,
        ).order_by(ProjectChatMessage.created_at)
    else:
        # 否则加载最新会话的消息
        # 先找最新的 session_id
        latest_stmt = select(ProjectChatMessage.session_id).where(
            ProjectChatMessage.project_id == project_id,
            ProjectChatMessage.user_id == current_user.id,
        ).order_by(ProjectChatMessage.created_at.desc()).limit(1)
        latest = db.exec(latest_stmt).first()
        if not latest:
            return {"data": [], "session_id": None}

        stmt = select(ProjectChatMessage).where(
            ProjectChatMessage.project_id == project_id,
            ProjectChatMessage.session_id == latest,
        ).order_by(ProjectChatMessage.created_at)

    messages = db.exec(stmt).all()
    return {
        "data": [{"role": m.role, "content": m.content} for m in messages],
        "session_id": messages[0].session_id if messages else None,
    }
