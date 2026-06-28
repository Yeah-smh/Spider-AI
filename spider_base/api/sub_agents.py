"""
SubAgents API - 子 Agent 管理接口
支持子 Agent 的创建、查询、更新、删除
"""
from typing import Optional
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from core.database import get_db
from core.deps import get_current_user
from core.models import User
from core.agent import service as agent_service

router = APIRouter()


# ============== 请求/响应模型 ==============

class SubAgentCreate(BaseModel):
    name: str
    display_name: str
    description: str = ""
    system_prompt: str = ""
    mcp_server_ids: list[int] = []
    project_id: Optional[int] = None


class SubAgentUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    mcp_server_ids: Optional[list[int]] = None
    is_enabled: Optional[bool] = None


# ============== 端点 ==============

@router.get("/sub-agents")
def list_sub_agents(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出子 Agent（支持按 project_id 筛选）"""
    agents = agent_service.list_sub_agents(db, current_user.id, project_id)
    return {"data": [
        {
            "id": a.id,
            "name": a.name,
            "display_name": a.display_name,
            "description": a.description,
            "project_id": a.project_id,
            "is_enabled": a.is_enabled,
            "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(),
        }
        for a in agents
    ]}


@router.post("/sub-agents")
def create_sub_agent(
    req: SubAgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建子 Agent"""
    agent = agent_service.create_sub_agent(
        db, current_user.id, req.project_id,
        req.name, req.display_name, req.description,
        req.system_prompt, req.mcp_server_ids
    )
    return {"data": {
        "id": agent.id,
        "name": agent.name,
        "display_name": agent.display_name,
    }}


@router.delete("/sub-agents/{agent_id}")
def delete_sub_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除子 Agent（只能删除自己的）"""
    ok = agent_service.delete_sub_agent(db, agent_id, current_user.id)
    if not ok:
        raise HTTPException(404, "SubAgent not found or not yours")
    return {"message": "deleted"}


@router.put("/sub-agents/{agent_id}")
def update_sub_agent(
    agent_id: int,
    req: SubAgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """更新子 Agent"""
    agent = agent_service.update_sub_agent(
        db, agent_id, current_user.id,
        display_name=req.display_name,
        description=req.description,
        system_prompt=req.system_prompt,
        mcp_server_ids=req.mcp_server_ids,
        is_enabled=req.is_enabled
    )
    if not agent:
        raise HTTPException(404, "SubAgent not found or not yours")
    return {"data": {
        "id": agent.id,
        "name": agent.name,
        "display_name": agent.display_name,
        "is_enabled": agent.is_enabled,
        "updated_at": agent.updated_at.isoformat(),
    }}
