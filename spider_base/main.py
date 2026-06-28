from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.database import init_db
from core.redis_client import redis_ping
from core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    init_db()
    
    # Redis 健康检查
    if redis_ping():
        print("✅ Redis connected")
    else:
        print("⚠️ Redis not available, some features may be degraded")
    
    yield


app = FastAPI(title="Spider AI API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由挂载
from api.auth import router as auth_router
from api.sessions import router as sessions_router
from api.llm_chat import router as chat_router
from api.dashboard import router as dashboard_router
from api.projects import router as projects_router
from api.skills import router as skills_router
from api.mcp import router as mcp_router
from api.sub_agents import router as sub_agents_router
from api.memory import router as memory_router
from api.learning import router as learning_router

app.include_router(auth_router, tags=["Auth"])
app.include_router(sessions_router, prefix="/sessions", tags=["Sessions"])
app.include_router(chat_router, tags=["Chat"])
app.include_router(dashboard_router, tags=["Dashboard"])
app.include_router(projects_router, tags=["Projects"])
app.include_router(skills_router, tags=["skills"])
app.include_router(mcp_router, tags=["MCP"])
app.include_router(sub_agents_router, tags=["SubAgents"])
app.include_router(memory_router, prefix="/memory", tags=["memory"])
app.include_router(learning_router, prefix="/learning", tags=["learning"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "Spider AI", "model": settings.DASHSCOPE_MODEL}
