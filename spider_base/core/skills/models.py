from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class Skill(SQLModel, table=True):
    """技能模型 - 存储 SKILL.md 格式内容"""
    __tablename__ = "skills"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    name: str = Field(max_length=100)       # kebab-case 标识符
    description: str = Field(default="")     # 简短描述
    content: str                              # SKILL.md 完整内容
    is_public: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
