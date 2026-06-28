from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    """用户模型"""
    __tablename__ = "users"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True, max_length=50)
    password_hash: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=20, unique=True, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatSession(SQLModel, table=True):
    """聊天会话模型"""
    __tablename__ = "chat_sessions"
    
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    title: str = Field(default="New Chat", max_length=200)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Message(SQLModel, table=True):
    """消息模型"""
    __tablename__ = "messages"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(foreign_key="chat_sessions.id", index=True)
    role: str = Field(max_length=20)  # "user" | "assistant"
    content: str
    token_count: int = Field(default=0)
    input_tokens: int = Field(default=0)    # 输入 token 数
    output_tokens: int = Field(default=0)   # 输出 token 数
    total_tokens: int = Field(default=0)    # 总 token 数
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    images: Optional[str] = Field(default=None)  # JSON 数组存储图片 base64 data URL


class Project(SQLModel, table=True):
    """项目模型"""
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectChatMessage(SQLModel, table=True):
    """项目聊天消息"""
    __tablename__ = "project_chat_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    session_id: str = Field(max_length=36, index=True)
    role: str = Field(max_length=20)  # "user" | "assistant"
    content: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LongtermMemory(SQLModel, table=True):
    """长期记忆"""
    __tablename__ = "longterm_memories"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    type: str = Field(max_length=30)  # "preference" / "knowledge" / "decision" / "experience"
    title: str = Field(max_length=200)
    content: str
    summary: Optional[str] = None
    importance: int = Field(default=5)
    source: str = Field(default="auto", max_length=20)  # "auto" / "user" / "system"
    access_count: int = Field(default=0)
    last_accessed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LearningSession(SQLModel, table=True):
    """学习会话模型"""
    __tablename__ = "learning_sessions"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = Field(default=None)
    duration_seconds: Optional[int] = Field(default=None)
    data_processed: int = Field(default=0)  # 处理的数据源数
    memories_generated: int = Field(default=0)  # 生成的记忆数
    status: str = Field(default="running")  # running/completed/failed
    mode: str = Field(default="incremental")  # full/incremental
