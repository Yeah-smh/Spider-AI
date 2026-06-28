"""
Redis 接口限流模块
使用固定窗口算法：INCR + EXPIRE

原理说明：
- 固定窗口算法将时间划分为固定大小的窗口（如60秒）
- 每个窗口内统计请求次数，超过阈值则拒绝
- INCR: 原子性自增计数器，返回自增后的值
- EXPIRE: 设置 key 过期时间，窗口结束后自动重置
"""
import logging
from fastapi import HTTPException, Request, Depends
from core.deps import get_current_user
from core.models import User
from core.redis_client import get_redis

logger = logging.getLogger(__name__)

# ============ 限流配置 ============
RATE_LIMIT_PREFIX = "ratelimit:"  # Redis key 前缀，格式: ratelimit:{identifier}:{endpoint}
DEFAULT_LIMIT = 30       # 默认每分钟最多30次请求
DEFAULT_WINDOW = 60      # 窗口大小：60秒
CHAT_LIMIT = 10          # /chat 接口每分钟最多10次
GUEST_LIMIT = 5          # /chat/guest 游客每分钟最多5次


def _get_redis_safe():
    """
    安全获取 Redis 连接，失败返回 None
    
    这里做了双重保护：
    1. get_redis() 可能抛异常（配置错误等）
    2. ping() 检测连接是否真正可用
    """
    try:
        r = get_redis()
        r.ping()  # 实际发送 PING 命令验证连接
        return r
    except Exception as e:
        logger.warning(f"Rate limiter: Redis unavailable: {e}")
        return None


def check_rate_limit(
    identifier: str, 
    endpoint: str, 
    limit: int = DEFAULT_LIMIT, 
    window: int = DEFAULT_WINDOW
) -> bool:
    """
    检查是否超过限流阈值（核心函数）
    
    算法流程：
    1. 构造 Redis key: ratelimit:{用户标识}:{接口路径}
    2. INCR 原子自增（key 不存在时自动创建并初始化为 1）
    3. 如果是第一次请求（current=1），设置过期时间
    4. 比较当前计数与阈值
    
    Args:
        identifier: 用户标识（登录用户用 user_id，游客用 IP）
        endpoint: 接口路径（如 /chat）
        limit: 窗口内最大请求数
        window: 窗口大小（秒）
    
    Returns:
        True = 放行, False = 超限（应拒绝请求）
    """
    r = _get_redis_safe()
    if not r:
        return True  # Redis 不可用时降级放行，保证服务可用性
    
    # key 设计: ratelimit:user123:/chat 或 ratelimit:192.168.1.1:/chat/guest
    key = f"{RATE_LIMIT_PREFIX}{identifier}:{endpoint}"
    
    try:
        # INCR: 原子自增，返回自增后的值
        # 如果 key 不存在，Redis 会先初始化为 0 再自增，所以第一次返回 1
        current = r.incr(key)
        
        if current == 1:
            # 第一次请求，设置过期时间
            # EXPIRE 设置 key 的 TTL，到期后 key 自动删除，计数器重置
            r.expire(key, window)
        
        if current > limit:
            # 超限！获取剩余冷却时间用于日志
            ttl = r.ttl(key)  # TTL: Time To Live，返回剩余秒数
            logger.warning(
                f"Rate limit exceeded: {identifier} on {endpoint} "
                f"({current}/{limit}), reset in {ttl}s"
            )
            return False
        
        return True
        
    except Exception as e:
        logger.warning(f"Rate limit check failed: {e}")
        return True  # 异常时降级放行


def get_remaining_requests(
    identifier: str, 
    endpoint: str, 
    limit: int = DEFAULT_LIMIT
) -> dict:
    """
    获取剩余请求数信息（可用于响应头 X-RateLimit-* ）
    
    Returns:
        {
            "limit": 最大请求数,
            "remaining": 剩余可用次数,
            "reset": 重置倒计时（秒）
        }
    """
    r = _get_redis_safe()
    if not r:
        return {"limit": limit, "remaining": limit, "reset": 0}
    
    key = f"{RATE_LIMIT_PREFIX}{identifier}:{endpoint}"
    try:
        # GET: 获取当前计数，不存在返回 None
        current = int(r.get(key) or 0)
        # TTL: 获取剩余过期时间，key 不存在返回 -2，无过期时间返回 -1
        ttl = r.ttl(key)
        return {
            "limit": limit,
            "remaining": max(0, limit - current),
            "reset": max(0, ttl)
        }
    except Exception:
        return {"limit": limit, "remaining": limit, "reset": 0}


# ============ FastAPI 依赖注入函数 ============

def rate_limit_chat(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    /chat 接口限流依赖
    
    使用方式：替换原有的 Depends(get_current_user)
    
    特点：
    - 内部已调用 get_current_user，所以认证逻辑保持不变
    - 按 user_id 限流，每个用户每分钟最多 CHAT_LIMIT 次
    - 返回 current_user，接口可直接使用
    """
    if not check_rate_limit(
        identifier=str(current_user.id),
        endpoint="/chat",
        limit=CHAT_LIMIT,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,  # 429 Too Many Requests
            detail=f"请求过于频繁，请稍后再试（每分钟最多{CHAT_LIMIT}次）"
        )
    return current_user


def rate_limit_guest(request: Request):
    """
    /chat/guest 游客接口限流依赖
    
    使用方式：添加 _=Depends(rate_limit_guest) 参数
    
    特点：
    - 无需登录，按客户端 IP 限流
    - 每个 IP 每分钟最多 GUEST_LIMIT 次
    - 返回值无意义（用 _ 接收）
    """
    # 获取客户端 IP
    # request.client 是 Address 对象，包含 host 和 port
    # 注意：如果使用反向代理，可能需要从 X-Forwarded-For 头获取真实 IP
    client_ip = request.client.host if request.client else "unknown"
    
    if not check_rate_limit(
        identifier=client_ip,
        endpoint="/chat/guest",
        limit=GUEST_LIMIT,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail=f"请求过于频繁，请稍后再试（每分钟最多{GUEST_LIMIT}次）"
        )


# ──── 登录接口限流配置 ────
LOGIN_LIMIT_PER_IP = 10         # 同一IP每分钟最多10次登录尝试
LOGIN_LIMIT_PER_TARGET = 5      # 同一用户名每分钟最多5次登录尝试
SMS_SEND_LIMIT_PER_IP = 5       # 同一IP每分钟最多5次发送验证码
SMS_VERIFY_LIMIT_PER_IP = 10    # 同一IP每分钟最多10次验证码验证
SMS_VERIFY_LIMIT_PER_PHONE = 5  # 同一手机号每分钟最多5次验证尝试


def rate_limit_login(request: Request):
    """
    /auth/login 登录接口双重限流
    1. 按 IP 限流
    2. 按目标用户名限流（需要在路由中拿到 username 后手动调用）
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not check_rate_limit(
        identifier=client_ip,
        endpoint="/auth/login",
        limit=LOGIN_LIMIT_PER_IP,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail="登录请求过于频繁，请稍后再试"
        )


def check_login_target_limit(username: str):
    """
    检查目标用户名的登录尝试次数
    在路由函数内部调用（因为需要拿到请求体中的 username）
    """
    if not check_rate_limit(
        identifier=f"target:{username}",
        endpoint="/auth/login",
        limit=LOGIN_LIMIT_PER_TARGET,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail="该账号登录尝试次数过多，请稍后再试"
        )


def rate_limit_sms_send(request: Request):
    """
    /auth/sms/send 发送验证码限流（按 IP）
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not check_rate_limit(
        identifier=client_ip,
        endpoint="/auth/sms/send",
        limit=SMS_SEND_LIMIT_PER_IP,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail="验证码发送请求过于频繁，请稍后再试"
        )


def rate_limit_sms_verify(request: Request):
    """
    /auth/sms/verify 验证码验证限流（按 IP）
    """
    client_ip = request.client.host if request.client else "unknown"
    
    if not check_rate_limit(
        identifier=client_ip,
        endpoint="/auth/sms/verify",
        limit=SMS_VERIFY_LIMIT_PER_IP,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail="验证请求过于频繁，请稍后再试"
        )


def check_sms_verify_target_limit(phone: str):
    """
    检查目标手机号的验证尝试次数
    在路由函数内部调用
    """
    if not check_rate_limit(
        identifier=f"target:{phone}",
        endpoint="/auth/sms/verify",
        limit=SMS_VERIFY_LIMIT_PER_PHONE,
        window=DEFAULT_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail="该手机号验证尝试次数过多，请稍后再试"
        )