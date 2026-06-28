"""
Skills API - 技能管理接口
支持技能的创建、查询、删除（SKILL.md 格式）
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from core.database import get_db
from core.deps import get_current_user
from core.models import User
from core.skills import service as skill_service

router = APIRouter()


# ============== 请求/响应模型 ==============

class SkillCreate(BaseModel):
    name: str
    description: str = ""
    content: str
    project_id: Optional[int] = None


# ============== 端点 ==============

@router.get("/skills")
def list_skills(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """列出技能（用户自己的 + 公开的）"""
    skills = skill_service.list_skills(db, current_user.id, project_id)
    return {"data": [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "project_id": s.project_id,
            "is_public": s.is_public,
            "created_at": s.created_at.isoformat(),
        }
        for s in skills
    ]}


@router.get("/skills/{skill_id}")
def get_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取技能详情（包含 SKILL.md 内容）"""
    skill = skill_service.get_skill(db, skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found")
    # 权限检查：自己的或公开的
    if skill.user_id != current_user.id and not skill.is_public:
        raise HTTPException(403, "No access")
    return {"data": {
        "id": skill.id,
        "name": skill.name,
        "description": skill.description,
        "content": skill.content,
        "project_id": skill.project_id,
        "is_public": skill.is_public,
        "created_at": skill.created_at.isoformat(),
    }}


@router.post("/skills")
def create_skill(
    req: SkillCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建新技能"""
    skill = skill_service.create_skill(
        db, current_user.id, req.project_id,
        req.name, req.description, req.content
    )
    return {"data": {"id": skill.id, "name": skill.name}}


@router.delete("/skills/{skill_id}")
def delete_skill(
    skill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除技能（只能删除自己的）"""
    ok = skill_service.delete_skill(db, skill_id, current_user.id)
    if not ok:
        raise HTTPException(404, "Skill not found or not yours")
    return {"message": "deleted"}

