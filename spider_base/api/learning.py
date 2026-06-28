"""学习引擎 API"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session as DBSession, select, func

from core.deps import get_current_user
from core.database import get_db
from core.models import User, LearningSession, LongtermMemory, ChatSession, Message, Project, ProjectChatMessage
from core.learning_engine import get_learning_engine
from core.memory.Longterm_Memory import LongtermMemoryStore

router = APIRouter()
learning_engine = get_learning_engine()
longterm_store = LongtermMemoryStore()


# ============== Request/Response Models ==============

from pydantic import BaseModel


class StartLearningRequest(BaseModel):
    """启动学习请求"""
    mode: str = "incremental"  # "full", "incremental" 或 "scheduled"
    interval_seconds: Optional[int] = 3600  # 定时模式的时间间隔（秒）


class StartLearningResponse(BaseModel):
    """启动学习响应"""
    success: bool
    session_id: int
    message: str


class LearningStatusResponse(BaseModel):
    """学习状态响应"""
    status: str  # idle/running/completed/failed
    progress: int  # 0-100
    stage: str
    message: str
    session_id: Optional[int] = None
    memories_generated: Optional[int] = None
    data_processed: Optional[int] = None
    duration_seconds: Optional[int] = None
    completed_at: Optional[str] = None
    scheduled: Optional[bool] = False  # 是否有定时学习运行中


class DataSourceItem(BaseModel):
    """数据源项"""
    id: int
    source: str
    type: str
    size: str
    collectedAt: str
    status: str


class LearningSessionItem(BaseModel):
    """学习会话项"""
    id: int
    start_time: str
    end_time: Optional[str]
    status: str
    mode: str
    data_processed: int
    memories_generated: int
    duration_seconds: Optional[int]


class MemoryItem(BaseModel):
    """记忆项"""
    id: int
    type: str
    title: str
    content: str
    importance: int
    source: str
    created_at: str
    updated_at: str


# ============== API Endpoints ==============

@router.post("/start", response_model=StartLearningResponse)
def start_learning(
    request: StartLearningRequest,
    current_user: User = Depends(get_current_user),
):
    """触发学习（后台异步执行）"""
    if request.mode not in ["full", "incremental", "scheduled"]:
        raise HTTPException(status_code=400, detail="mode 必须是 'full', 'incremental' 或 'scheduled'")
    
    try:
        if request.mode == "scheduled":
            # 定时学习模式
            interval = request.interval_seconds or 3600
            learning_engine.start_scheduled(
                user_id=current_user.id,
                interval_seconds=interval
            )
            return StartLearningResponse(
                success=True,
                session_id=0,
                message=f"定时学习已启动，每 {interval // 60} 分钟自动执行一次"
            )
        else:
            session_id = learning_engine.start_learning(
                user_id=current_user.id,
                mode=request.mode
            )
            return StartLearningResponse(
                success=True,
                session_id=session_id,
                message=f"学习已启动（{request.mode} 模式）"
            )
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动学习失败: {str(e)}")


@router.get("/status", response_model=LearningStatusResponse)
def get_learning_status(
    current_user: User = Depends(get_current_user),
):
    """获取当前学习状态"""
    status = learning_engine.get_status(current_user.id)
    return LearningStatusResponse(**status)


@router.get("/data-sources", response_model=list[DataSourceItem])
def get_data_sources(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    获取数据源列表（动态统计）
    不建独立表，实时统计 Message/Project 表
    """
    sources = []
    now = datetime.now(timezone.utc)
    
    # 1. Chat History - 最近7天的对话
    cutoff_7d = now - timedelta(days=7)
    chat_sessions = db.exec(
        select(ChatSession).where(
            ChatSession.user_id == current_user.id,
            ChatSession.updated_at >= cutoff_7d
        )
    ).all()
    
    if chat_sessions:
        session_ids = [s.id for s in chat_sessions]
        # 统计消息总数和总大小（估算）
        msg_count = db.exec(
            select(func.count(Message.id)).where(
                Message.session_id.in_(session_ids)
            )
        ).first() or 0
        
        # 估算大小（每条消息平均200字节）
        size_bytes = msg_count * 200
        size_str = _format_size(size_bytes)
        
        sources.append(DataSourceItem(
            id=1,
            source="Chat history",
            type="Chat",
            size=size_str,
            collectedAt=chat_sessions[0].updated_at.isoformat() if chat_sessions else now.isoformat(),
            status="Available"
        ))
    
    # 2. Project Data - 最近更新的项目
    cutoff_30d = now - timedelta(days=30)
    projects = db.exec(
        select(Project).where(
            Project.user_id == current_user.id,
            Project.updated_at >= cutoff_30d
        )
    ).all()
    
    if projects:
        project_ids = [p.id for p in projects]
        # 统计项目聊天消息
        project_msg_count = db.exec(
            select(func.count(ProjectChatMessage.id)).where(
                ProjectChatMessage.project_id.in_(project_ids)
            )
        ).first() or 0
        
        # 估算大小
        size_bytes = len(projects) * 500 + project_msg_count * 200
        size_str = _format_size(size_bytes)
        
        sources.append(DataSourceItem(
            id=2,
            source="Project data",
            type="Project",
            size=size_str,
            collectedAt=projects[0].updated_at.isoformat() if projects else now.isoformat(),
            status="Available"
        ))
    
    # 3. Existing Memories - 已有长期记忆
    memory_count = db.exec(
        select(func.count(LongtermMemory.id)).where(
            LongtermMemory.user_id == current_user.id
        )
    ).first() or 0
    
    if memory_count > 0:
        # 估算大小（每条记忆平均300字节）
        size_bytes = memory_count * 300
        size_str = _format_size(size_bytes)
        
        latest_memory = db.exec(
            select(LongtermMemory).where(
                LongtermMemory.user_id == current_user.id
            ).order_by(LongtermMemory.updated_at.desc()).limit(1)
        ).first()
        
        sources.append(DataSourceItem(
            id=3,
            source="Existing memories",
            type="Memory",
            size=size_str,
            collectedAt=latest_memory.updated_at.isoformat() if latest_memory else now.isoformat(),
            status="Available"
        ))
    
    # 如果没有数据源，返回空列表
    return sources


def _format_size(size_bytes: int) -> str:
    """格式化字节大小为人类可读格式"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


@router.get("/memories", response_model=list[MemoryItem])
def get_learning_memories(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    获取学习生成的记忆列表（source="auto" 的 LongtermMemory）
    """
    stmt = (
        select(LongtermMemory)
        .where(
            LongtermMemory.user_id == current_user.id,
            LongtermMemory.source == "auto"
        )
        .order_by(LongtermMemory.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    memories = db.exec(stmt).all()
    
    return [
        MemoryItem(
            id=m.id,
            type=m.type,
            title=m.title,
            content=m.content,
            importance=m.importance,
            source=m.source,
            created_at=m.created_at.isoformat() if m.created_at else "",
            updated_at=m.updated_at.isoformat() if m.updated_at else "",
        )
        for m in memories
    ]


@router.get("/sessions", response_model=list[LearningSessionItem])
def get_learning_sessions(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    """
    获取学习会话历史（LearningSession 表）
    """
    stmt = (
        select(LearningSession)
        .where(LearningSession.user_id == current_user.id)
        .order_by(LearningSession.start_time.desc())
        .limit(limit)
    )
    sessions = db.exec(stmt).all()
    
    return [
        LearningSessionItem(
            id=s.id,
            start_time=s.start_time.isoformat() if s.start_time else "",
            end_time=s.end_time.isoformat() if s.end_time else None,
            status=s.status,
            mode=s.mode,
            data_processed=s.data_processed,
            memories_generated=s.memories_generated,
            duration_seconds=s.duration_seconds,
        )
        for s in sessions
    ]


@router.post("/stop-scheduled")
def stop_scheduled_learning(
    current_user: User = Depends(get_current_user),
):
    """停止定时学习"""
    learning_engine.stop_scheduled(current_user.id)
    return {"message": "定时学习已停止"}


@router.delete("/memories/{memory_id}")
def delete_learning_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    删除一条学习生成的记忆
    """
    # 先检查记忆是否存在且属于当前用户
    memory = db.get(LongtermMemory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="记忆不存在")
    
    if memory.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此记忆")
    
    # 使用 LongtermMemoryStore 删除（会同时删除 DB 和 Qdrant）
    success = longterm_store.delete(memory_id, current_user.id, db)
    
    if not success:
        raise HTTPException(status_code=500, detail="删除失败")
    
    return {"message": "记忆已删除", "id": memory_id}


@router.delete("/sessions/{session_id}")
def delete_learning_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    删除学习会话记录
    """
    # 先检查会话是否存在且属于当前用户
    session = db.get(LearningSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此会话")
    
    # 删除会话
    db.delete(session)
    db.commit()
    
    return {"message": "已删除"}


@router.get("/stats")
def get_learning_stats(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    获取学习统计信息
    """
    # 统计自动生成的记忆数
    auto_memories = db.exec(
        select(func.count(LongtermMemory.id)).where(
            LongtermMemory.user_id == current_user.id,
            LongtermMemory.source == "auto"
        )
    ).first() or 0
    
    # 统计用户手动添加的记忆数
    user_memories = db.exec(
        select(func.count(LongtermMemory.id)).where(
            LongtermMemory.user_id == current_user.id,
            LongtermMemory.source == "user"
        )
    ).first() or 0
    
    # 统计学习会话数
    session_count = db.exec(
        select(func.count(LearningSession.id)).where(
            LearningSession.user_id == current_user.id
        )
    ).first() or 0
    
    # 统计成功完成的会话
    completed_sessions = db.exec(
        select(func.count(LearningSession.id)).where(
            LearningSession.user_id == current_user.id,
            LearningSession.status == "completed"
        )
    ).first() or 0
    
    # 总生成记忆数
    total_generated = db.exec(
        select(func.sum(LearningSession.memories_generated)).where(
            LearningSession.user_id == current_user.id
        )
    ).first() or 0
    
    return {
        "auto_memories": auto_memories,
        "user_memories": user_memories,
        "total_memories": auto_memories + user_memories,
        "session_count": session_count,
        "completed_sessions": completed_sessions,
        "total_generated": total_generated,
    }
