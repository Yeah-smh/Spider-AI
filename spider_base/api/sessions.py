from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func, SQLModel

from core.database import get_db
from core.deps import get_current_user
from core.models import User, ChatSession, Message

router = APIRouter()


# ============== 请求/响应模型 ==============

class SessionListItem(SQLModel):
    """会话列表项"""
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class CreateSessionRequest(SQLModel):
    """创建会话请求"""
    title: str = "New Chat"


class UpdateSessionRequest(SQLModel):
    """更新会话请求"""
    title: str


# ============== 辅助函数 ==============

def get_user_session(session_id: str, user_id: int, db: Session) -> ChatSession:
    """获取用户的会话，不存在或不属于该用户则 404"""
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# ============== API 接口 ==============

@router.get("", response_model=List[SessionListItem])
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户所有会话"""
    # 查询用户的所有会话，按 updated_at 降序
    statement = (
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = db.exec(statement).all()
    
    # 构建返回列表，计算每个会话的消息数
    result = []
    for session in sessions:
        # 计算消息数量
        count_statement = (
            select(func.count(Message.id))
            .where(Message.session_id == session.id)
        )
        message_count = db.exec(count_statement).one()
        
        result.append(SessionListItem(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=message_count
        ))
    
    return result


@router.post("", response_model=ChatSession)
def create_session(
    request: CreateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建新会话"""
    session = ChatSession(
        user_id=current_user.id,
        title=request.title
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}")
def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除会话"""
    # 验证会话属于当前用户
    session = get_user_session(session_id, current_user.id, db)
    
    # 先批量删除该会话的所有消息（用原生 DELETE 语句确保先执行）
    from sqlalchemy import delete as sa_delete
    db.exec(sa_delete(Message).where(Message.session_id == session_id))
    db.flush()
    
    # 再删除会话
    db.delete(session)
    db.commit()
    
    return {"ok": True}


@router.get("/{session_id}/messages", response_model=List[Message])
def get_session_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取会话消息"""
    # 验证会话属于当前用户
    get_user_session(session_id, current_user.id, db)
    
    # 查询消息，按 created_at 升序
    statement = (
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    messages = db.exec(statement).all()
    
    return messages


@router.patch("/{session_id}", response_model=ChatSession)
def update_session(
    session_id: str,
    request: UpdateSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新会话标题"""
    # 验证会话属于当前用户
    session = get_user_session(session_id, current_user.id, db)
    
    # 更新标题和更新时间
    session.title = request.title
    session.updated_at = datetime.now(timezone.utc)
    
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return session
