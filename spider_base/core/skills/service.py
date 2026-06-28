import logging
from datetime import datetime, timezone
from sqlmodel import Session, select, or_
from core.skills.models import Skill

logger = logging.getLogger(__name__)


def create_skill(
    db: Session,
    user_id: int,
    project_id: int | None,
    name: str,
    description: str,
    content: str,
) -> Skill:
    """创建技能（SKILL.md 格式）"""
    skill = Skill(
        user_id=user_id,
        project_id=project_id,
        name=name,
        description=description,
        content=content,
    )
    db.add(skill)
    db.commit()
    db.refresh(skill)
    return skill


def list_skills(db: Session, user_id: int, project_id: int | None = None) -> list[Skill]:
    """列出技能：用户自己的 + 项目级的 + 公开的"""
    conditions = [
        Skill.user_id == user_id,
        Skill.is_public == True,  # noqa: E712
    ]
    if project_id:
        conditions.append(Skill.project_id == project_id)
    
    statement = select(Skill).where(or_(*conditions))
    return list(db.exec(statement).all())


def get_skill(db: Session, skill_id: int) -> Skill | None:
    """获取单个技能"""
    return db.get(Skill, skill_id)


def get_skill_by_name(
    db: Session, user_id: int, project_id: int | None, name: str
) -> Skill | None:
    """按名称查找技能（优先项目级）"""
    statement = select(Skill).where(
        Skill.name == name,
        or_(
            Skill.user_id == user_id,
            Skill.is_public == True,  # noqa: E712
        )
    )
    if project_id:
        skills = list(db.exec(statement).all())
        project_skill = next((s for s in skills if s.project_id == project_id), None)
        return project_skill or (skills[0] if skills else None)
    return db.exec(statement).first()


def delete_skill(db: Session, skill_id: int, user_id: int) -> bool:
    """删除技能（只能删自己的）"""
    skill = db.get(Skill, skill_id)
    if not skill or skill.user_id != user_id:
        return False
    db.delete(skill)
    db.commit()
    return True


def load_skills_for_agent(
    db: Session, user_id: int, project_id: int | None
) -> tuple[list[str], dict[str, dict]]:
    """加载用户技能，返回 (skills_paths, files_dict) 用于 create_deep_agent
    
    files_dict 的值必须是 FileData 格式：
    {"content": ["line1", "line2", ...], "created_at": "...", "modified_at": "..."}
    因为 StateBackend 内部会调用 file_data["content"] 来读取文件。
    """
    skills = list_skills(db, user_id, project_id)
    if not skills:
        return [], {}
    
    user_source = "/skills/user/"
    project_source = "/skills/project/"
    files = {}
    has_project_skills = False
    
    for skill in skills:
        if skill.project_id and skill.project_id == project_id:
            path = f"{project_source}{skill.name}/SKILL.md"
            has_project_skills = True
        else:
            path = f"{user_source}{skill.name}/SKILL.md"
        # StateBackend 要求 FileData 格式
        now = datetime.now(timezone.utc).isoformat()
        files[path] = {
            "content": skill.content.split("\n") if skill.content else [],
            "created_at": skill.created_at.isoformat() if skill.created_at else now,
            "modified_at": skill.updated_at.isoformat() if skill.updated_at else now,
        }
    
    if has_project_skills:
        skills_paths = [user_source, project_source]
    else:
        skills_paths = [user_source]
    
    return skills_paths, files
