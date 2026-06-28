"""
短信验证码存储模块（Redis 存储，内存 fallback）
"""
import json
import logging
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from core.redis_client import get_redis

logger = logging.getLogger(__name__)

# ==================== 常量配置 ====================

# Redis Key 前缀
SMS_KEY_PREFIX = "sms:"
SMS_LOCK_PREFIX = "sms:lock:"

# 验证码有效期（秒）
CODE_EXPIRE_SECONDS = 300  # 5分钟

# 防重发间隔（秒）
RESEND_INTERVAL_SECONDS = 60

# ==================== 内存 fallback ====================

# 内存存储结构: {phone: {"code": "482916", "expire": datetime, "send_time": datetime}}
_sms_store: Dict[str, dict] = {}


def _get_redis():
    """
    获取 Redis 连接，失败返回 None
    
    Returns:
        Redis 客户端实例，或 None（Redis 不可用时）
    """
    try:
        r = get_redis()
        r.ping()  # 测试连接是否可用
        return r
    except Exception as e:
        logger.warning(f"Redis unavailable, using memory fallback: {e}")
        return None


def generate_code() -> str:
    """生成6位随机数字验证码"""
    return ''.join(random.choices(string.digits, k=6))


def save_code(phone: str, code: str) -> None:
    """
    存储验证码到 Redis，带防重发锁
    
    Args:
        phone: 手机号
        code: 验证码
    """
    redis = _get_redis()
    key = f"{SMS_KEY_PREFIX}{phone}"
    lock_key = f"{SMS_LOCK_PREFIX}{phone}"
    
    now = datetime.now(timezone.utc)
    data = {
        "code": code,
        "send_time": now.isoformat()
    }
    
    if redis:
        try:
            # 存储验证码，5分钟过期
            redis.setex(key, CODE_EXPIRE_SECONDS, json.dumps(data))
            # 设置防重发锁，1分钟过期
            redis.setex(lock_key, RESEND_INTERVAL_SECONDS, "1")
            return
        except Exception as e:
            logger.warning(f"Redis set failed, fallback to memory: {e}")
    
    # Fallback 到内存
    _sms_store[phone] = {
        "code": code,
        "expire": now + timedelta(seconds=CODE_EXPIRE_SECONDS),
        "send_time": now
    }


def verify_code(phone: str, code: str) -> bool:
    """
    校验验证码
    
    Args:
        phone: 手机号
        code: 用户输入的验证码
    
    Returns:
        True 校验成功，False 校验失败
    
    Note:
        成功后自动删除验证码（一次性使用）
    """
    redis = _get_redis()
    key = f"{SMS_KEY_PREFIX}{phone}"
    
    if redis:
        try:
            data_str = redis.get(key)
            if not data_str:
                return False
            data = json.loads(data_str)
            if data["code"] != code:
                return False
            # 验证成功，删除 key
            redis.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis get failed, fallback to memory: {e}")
    
    # Fallback 到内存
    return _verify_code_memory(phone, code)


def _verify_code_memory(phone: str, code: str) -> bool:
    """内存模式验证验证码"""
    record = _sms_store.get(phone)
    
    if not record:
        return False
    
    # 检查是否过期
    if datetime.now(timezone.utc) > record["expire"]:
        # 已过期，清理并返回失败
        del _sms_store[phone]
        return False
    
    # 验证码比对
    if record["code"] != code:
        return False
    
    # 验证成功，删除记录
    del _sms_store[phone]
    return True


def can_send(phone: str) -> bool:
    """
    检查是否可以发送验证码（60秒防重发）
    
    Args:
        phone: 手机号
    
    Returns:
        True 可以发送，False 需要等待
    """
    redis = _get_redis()
    lock_key = f"{SMS_LOCK_PREFIX}{phone}"
    
    if redis:
        try:
            # 检查锁是否存在，存在则不能发送
            return not redis.exists(lock_key)
        except Exception as e:
            logger.warning(f"Redis exists failed, fallback to memory: {e}")
    
    # Fallback 到内存
    return _can_send_memory(phone)


def _can_send_memory(phone: str) -> bool:
    """内存模式检查是否可以发送"""
    record = _sms_store.get(phone)
    
    if not record:
        return True
    
    # 检查距离上次发送是否已过60秒
    elapsed = (datetime.now(timezone.utc) - record["send_time"]).total_seconds()
    return elapsed >= RESEND_INTERVAL_SECONDS


def get_remaining_cooldown(phone: str) -> int:
    """
    获取剩余冷却时间（秒）
    
    Args:
        phone: 手机号
    
    Returns:
        剩余秒数，0 表示可以发送
    """
    redis = _get_redis()
    lock_key = f"{SMS_LOCK_PREFIX}{phone}"
    
    if redis:
        try:
            # 获取锁的剩余 TTL
            ttl = redis.ttl(lock_key)
            return max(0, ttl)
        except Exception as e:
            logger.warning(f"Redis ttl failed, fallback to memory: {e}")
    
    # Fallback 到内存
    return _get_remaining_cooldown_memory(phone)


def _get_remaining_cooldown_memory(phone: str) -> int:
    """内存模式获取剩余冷却时间"""
    record = _sms_store.get(phone)
    
    if not record:
        return 0
    
    elapsed = (datetime.now(timezone.utc) - record["send_time"]).total_seconds()
    remaining = RESEND_INTERVAL_SECONDS - elapsed
    return max(0, int(remaining))
