"""
Redis 客户端模块
提供连接池复用的 Redis 连接
"""
import redis
from core.config import settings

_pool = None


def get_redis() -> redis.Redis:
    """获取 Redis 连接（连接池复用）"""
    global _pool
    if _pool is None:
        _pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL, 
            decode_responses=True
        )
    return redis.Redis(connection_pool=_pool)


def redis_ping() -> bool:
    """检查 Redis 连接状态，连接失败返回 False（不抛异常）"""
    try:
        r = get_redis()
        return r.ping()
    except Exception:
        return False
