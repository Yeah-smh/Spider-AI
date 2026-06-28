"""工作记忆 - Redis 存储的会话上下文"""

import json
import logging
from datetime import datetime

from core.redis_client import get_redis
from core.config import settings

logger = logging.getLogger(__name__)

CACHE_PREFIX = "memory:working:"


class WorkingMemory:
    """
    工作记忆：当前会话的上下文消息列表。
    存储：Redis（Cache-Aside 模式，DB fallback）
    生命周期：跨交互，TTL = settings.MEMORY_WORKING_TTL（默认1小时）
    """
    
    def __init__(self, user_id: int, session_id: str):
        self.user_id = user_id
        self.session_id = session_id
        self._redis = self._get_redis_safe()
    
    def _get_redis_safe(self):
        """安全获取 Redis 连接"""
        try:
            r = get_redis()
            r.ping()
            return r
        except Exception as e:
            logger.warning(f"Redis unavailable for WorkingMemory: {e}")
            return None
    
    @property
    def cache_key(self) -> str:
        return f"{CACHE_PREFIX}{self.session_id}"
    
    def load_from_cache(self) -> list[dict] | None:
        """从 Redis 加载会话上下文，返回 None 表示 MISS"""
        if not self._redis:
            return None
        try:
            data = self._redis.get(self.cache_key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.warning(f"WorkingMemory cache load failed: {e}")
            return None
    
    def save_to_cache(self, messages: list[dict]):
        """将完整消息列表写入 Redis 缓存"""
        if not self._redis:
            return
        try:
            self._redis.setex(
                self.cache_key,
                settings.MEMORY_WORKING_TTL,
                json.dumps(messages, ensure_ascii=False, default=str)
            )
        except Exception as e:
            logger.warning(f"WorkingMemory cache save failed: {e}")
    
    def append_message(self, role: str, content: str):
        """追加单条消息到 Redis 缓存（读-改-写）"""
        if not self._redis:
            return
        try:
            data = self._redis.get(self.cache_key)
            if data:
                messages = json.loads(data)
                messages.append({"role": role, "content": content})
                self._redis.setex(
                    self.cache_key,
                    settings.MEMORY_WORKING_TTL,
                    json.dumps(messages, ensure_ascii=False, default=str)
                )
        except Exception as e:
            logger.warning(f"WorkingMemory append failed: {e}")
    
    def invalidate(self):
        """清除缓存（会话删除时调用）"""
        if not self._redis:
            return
        try:
            self._redis.delete(self.cache_key)
        except Exception as e:
            logger.warning(f"WorkingMemory invalidate failed: {e}")
    
    def load_context(self, db) -> list[dict]:
        """
        加载会话上下文（完整的 Cache-Aside 流程）：
        1. 尝试从 Redis 加载（HIT）
        2. MISS 则从 DB 加载历史消息，回写 Redis
        
        参数 db: SQLModel Session
        返回: [{"role": "user/assistant", "content": "..."}]
        """
        from core.models import Message
        from sqlmodel import select
        
        # 1. 尝试缓存
        cached = self.load_from_cache()
        if cached is not None:
            logger.info(f"WorkingMemory cache HIT: {self.session_id}")
            return cached
        
        # 2. Cache MISS → 查 DB
        stmt = (
            select(Message)
            .where(Message.session_id == self.session_id)
            .order_by(Message.created_at)
        )
        history = db.exec(stmt).all()
        messages = [{"role": m.role, "content": m.content} for m in history]
        
        # 3. 回写缓存
        if messages:
            self.save_to_cache(messages)
            logger.info(f"WorkingMemory cache MISS, written: {self.session_id}")
        
        return messages
