"""子代理数据模型"""
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class SubAgent(SQLModel, table=True):
    __tablename__ = "sub_agents"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    name: str = Field(max_length=100)              # kebab-case 标识符，如 "data-analyst"
    display_name: str = Field(max_length=200)       # 显示名称，如 "数据分析师"
    description: str = Field(default="")
    system_prompt: str = Field(default="")          # 子 Agent 专用提示词
    mcp_server_ids: str = Field(default="[]")       # JSON: [1, 3, 5] 绑定的 MCP Server ID
    is_enabled: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
