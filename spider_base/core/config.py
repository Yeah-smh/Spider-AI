import secrets
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，从 .env 文件或环境变量读取"""
    
    # Database (openGauss)
    DATABASE_URL: str = ""
    
    # JWT
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h
    
    # AI Model
    DASHSCOPE_API_KEY: str = ""
    DASHSCOPE_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    DASHSCOPE_MODEL: str = "qwen3.5-35b-a3b"
    DASHSCOPE_VL_MODEL: str = "qwen3-vl-flash-2026-01-22"
    PREDICT_MODEL: str = "Qwen3-0.6B"
    PREDICT_BASE_URL: str = "http://localhost:8100/v1"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Workspace SSH (远程 VM 文件系统)
    WORKSPACE_SSH_HOST: str = ""
    WORKSPACE_SSH_USER: str = ""
    WORKSPACE_BASE_DIR: str = "/workspace"
    
    # Memory System
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "spider_memories"
    MEMORY_WORKING_TTL: int = 3600
    MEMORY_ANALYSIS_MODEL: str = "qwen3.6-plus"
    MEMORY_EMBEDDING_MODEL: str = "qwen3-vl-embedding"
    MEMORY_MAX_CONTEXT_TOKENS: int = 4000
    
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
