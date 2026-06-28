"""记忆管理 API"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session as DBSession, SQLModel

from core.deps import get_current_user
from core.database import get_db
from core.models import User
from core.memory.memory_service import MemoryService

router = APIRouter()
memory_service = MemoryService()


class PinMemoryRequest(SQLModel):
    """用户主动添加记忆"""
    title: str
    content: str
    type: str = "knowledge"  # preference / knowledge / decision / experience


@router.get("")
def get_memories(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """获取用户所有长期记忆"""
    memories = memory_service.get_user_memories(current_user.id, db)
    return {"data": memories}


@router.get("/search")
def search_memories(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """语义搜索记忆"""
    results = memory_service.search_memories(current_user.id, q, db)
    return {"data": results}


@router.post("")
def pin_memory(
    request: PinMemoryRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """用户主动添加记忆"""
    if not request.title.strip() or not request.content.strip():
        raise HTTPException(status_code=400, detail="标题和内容不能为空")
    
    result = memory_service.pin_memory(
        user_id=current_user.id,
        title=request.title.strip(),
        content=request.content.strip(),
        type=request.type,
        db=db,
    )
    if not result:
        raise HTTPException(status_code=500, detail="保存失败")
    return {"data": result}


@router.delete("/{memory_id}")
def delete_memory(
    memory_id: int,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """删除一条长期记忆"""
    success = memory_service.delete_memory(memory_id, current_user.id, db)
    if not success:
        raise HTTPException(status_code=404, detail="记忆不存在或无权删除")
    return {"message": "已删除"}
