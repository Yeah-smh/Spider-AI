"""
MCP API - MCP Server 管理接口
支持预置 MCP 的启用、自定义 MCP 的创建、查询、更新和删除
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session

from core.database import get_db
from core.deps import get_current_user
from core.models import User
from core.mcp import service as mcp_service
from core.mcp.presets import get_preset_list
from core.mcp.models import McpServer

router = APIRouter()


# ============== 请求/响应模型 ==============

class EnablePresetRequest(BaseModel):
    preset_name: str
    project_id: Optional[int] = None
    env_config: Optional[dict] = None


class CreateCustomMcpRequest(BaseModel):
    name: str
    display_name: str
    description: str = ""
    project_id: Optional[int] = None
    transport: str = Field(default="stdio", pattern="^(stdio|http|streamable_http|sse)$")
    config: dict = Field(default_factory=dict)


class UpdateMcpRequest(BaseModel):
    env_config: Optional[dict] = None
    is_enabled: Optional[bool] = None


# ============== 端点 ==============

@router.get("/mcp/presets")
def list_presets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取预置公共 MCP 列表（含当前用户启用状态）"""
    # 获取用户已启用的 preset 名称列表
    servers = mcp_service.list_mcp_servers(db, current_user.id)
    enabled_names = [s.name for s in servers if s.source == "preset" and s.is_enabled]
    
    presets = get_preset_list(enabled_names)
    return {"data": presets}


@router.post("/mcp/enable")
def enable_preset(
    req: EnablePresetRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """启用预置 MCP Server"""
    try:
        server = mcp_service.enable_preset(
            db, current_user.id, req.project_id,
            req.preset_name, req.env_config
        )
        return {"data": {
            "id": server.id,
            "name": server.name,
            "display_name": server.display_name,
            "is_enabled": server.is_enabled,
        }}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/mcp/custom")
def create_custom_mcp(
    req: CreateCustomMcpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建自定义 MCP Server"""
    server = mcp_service.create_custom_mcp(
        db, current_user.id, req.project_id,
        req.name, req.display_name, req.description,
        req.transport, req.config
    )
    return {"data": {
        "id": server.id,
        "name": server.name,
        "display_name": server.display_name,
        "is_enabled": server.is_enabled,
    }}


@router.get("/mcp/servers")
def list_mcp_servers(
    project_id: Optional[int] = Query(None, description="可选的项目 ID 过滤"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出用户已启用的 MCP Server"""
    servers = mcp_service.list_mcp_servers(db, current_user.id, project_id)
    return {"data": [
        {
            "id": s.id,
            "name": s.name,
            "display_name": s.display_name,
            "description": s.description,
            "transport": s.transport,
            "is_enabled": s.is_enabled,
            "is_public": s.is_public,
            "source": s.source,
            "project_id": s.project_id,
            "created_at": s.created_at.isoformat(),
        }
        for s in servers
    ]}


@router.delete("/mcp/servers/{server_id}")
def delete_mcp_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除 MCP Server"""
    ok = mcp_service.delete_mcp_server(db, server_id, current_user.id)
    if not ok:
        raise HTTPException(404, "MCP Server not found or not yours")
    return {"message": "deleted"}


@router.put("/mcp/servers/{server_id}")
def update_mcp_server(
    server_id: int,
    req: UpdateMcpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新 MCP 配置"""
    server = mcp_service.update_mcp_config(
        db, server_id, current_user.id,
        req.env_config, req.is_enabled
    )
    if not server:
        raise HTTPException(404, "MCP Server not found or not yours")
    return {"data": {
        "id": server.id,
        "name": server.name,
        "display_name": server.display_name,
        "is_enabled": server.is_enabled,
    }}
