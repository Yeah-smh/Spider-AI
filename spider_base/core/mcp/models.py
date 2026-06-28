from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field


class McpServer(SQLModel, table=True):
    __tablename__ = "mcp_servers"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    project_id: Optional[int] = Field(default=None, foreign_key="projects.id", index=True)
    name: str = Field(max_length=100)           # 唯一标识（如 github, filesystem）
    display_name: str = Field(max_length=200)    # 显示名称
    description: str = Field(default="")
    transport: str = Field(default="stdio")      # "stdio" | "http"
    # stdio 配置
    command: Optional[str] = None                # "npx" | "python" | "uvx"
    args: Optional[str] = None                   # JSON string: ["-y", "@modelcontextprotocol/server-github"]
    env: Optional[str] = None                    # JSON string: {"GITHUB_TOKEN": "xxx"}
    # http 配置
    url: Optional[str] = None                    # "http://localhost:8000/mcp"
    headers: Optional[str] = None                # JSON string: {"Authorization": "Bearer xxx"}
    # 状态
    is_enabled: bool = Field(default=True)
    is_public: bool = Field(default=False)       # 是否为预置公共 Server
    source: str = Field(default="custom")        # "preset" | "custom"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
