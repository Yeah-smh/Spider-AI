import re
import random
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select, SQLModel

from core.database import get_db
from core.models import User
from core.security import hash_password, verify_password, create_access_token
from core.deps import get_current_user
from core import sms_store
from core.rate_limiter import (
    rate_limit_login, check_login_target_limit,
    rate_limit_sms_send, rate_limit_sms_verify, check_sms_verify_target_limit
)


router = APIRouter(prefix="/auth", tags=["auth"])


# ============== Request/Response Models ==============

class RegisterRequest(SQLModel):
    """用户注册请求"""
    username: str
    password: str
    email: Optional[str] = None


class LoginRequest(SQLModel):
    """用户登录请求"""
    username: str
    password: str


class UserPublic(SQLModel):
    """用户公开信息（不含密码）"""
    id: int
    username: str
    email: Optional[str]
    phone: Optional[str] = None
    created_at: datetime


class SMSSendRequest(SQLModel):
    """发送验证码请求"""
    phone: str


class SMSSendResponse(SQLModel):
    """发送验证码响应"""
    message: str
    expires_in: int
    code: Optional[str] = None  # 开发模式返回，生产模式为 null


class SMSVerifyRequest(SQLModel):
    """验证码校验请求"""
    phone: str
    code: str


class AuthResponse(SQLModel):
    """认证响应"""
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


# ============== API Endpoints ==============

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """
    用户注册
    
    - 检查用户名是否已存在
    - 创建用户并哈希密码
    - 签发 JWT token
    """
    # 校验密码强度（防止抓包篡改空密码）
    if not request.password or len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码不能为空且至少6位"
        )
    
    # 检查用户名是否已存在
    existing_user = db.exec(
        select(User).where(User.username == request.username)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already exists"
        )
    
    # 创建新用户
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        email=request.email
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # 签发 JWT token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return AuthResponse(
        access_token=access_token,
        user=UserPublic(
            id=user.id,
            username=user.username,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db), _=Depends(rate_limit_login)):
    """
    用户登录
    
    - 验证用户名和密码
    - 签发 JWT token
    """
    # 在验证密码之前，先检查目标用户名限流
    check_login_target_limit(request.username)
    
    # 查找用户
    user = db.exec(
        select(User).where(User.username == request.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # 手机号注册的用户没有密码，不允许密码登录
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该账号通过手机号注册，请使用手机号验证码登录"
        )
    
    # 验证密码
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )
    
    # 签发 JWT token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return AuthResponse(
        access_token=access_token,
        user=UserPublic(
            id=user.id,
            username=user.username,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserPublic)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    获取当前用户信息
    
    需要 Bearer token 认证
    """
    return UserPublic(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        phone=current_user.phone,
        created_at=current_user.created_at
    )


# ============== SMS 验证码登录/注册 ==============

def _validate_phone(phone: str) -> bool:
    """校验手机号格式（11位数字）"""
    return bool(re.match(r'^1\d{10}$', phone))


def _generate_username(phone: str) -> str:
    """自动生成用户名: user_手机后4位_随机4位"""
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    return f"user_{phone[-4:]}_{suffix}"


@router.post("/sms/send", response_model=SMSSendResponse)
async def sms_send(request: SMSSendRequest, _=Depends(rate_limit_sms_send)):
    """
    发送手机验证码（模拟模式，仅打印到控制台）
    
    - 校验手机号格式
    - 60秒防重发
    - 验证码 5 分钟有效
    """
    phone = request.phone.strip()
    
    # 校验手机号格式
    if not _validate_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确，请输入11位手机号"
        )
    
    # 检查60秒防重发
    if not sms_store.can_send(phone):
        remaining = sms_store.get_remaining_cooldown(phone)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"请{remaining}秒后重试"
        )
    
    # 生成并存储验证码
    code = sms_store.generate_code()
    sms_store.save_code(phone, code)
    
    # 模拟发送：打印到控制台
    print(f"[SMS模拟] 手机号: {phone}, 验证码: {code}")
    
    # 开发模式返回验证码，方便前端自动填充演示
    return SMSSendResponse(
        message="验证码已发送",
        expires_in=sms_store.CODE_EXPIRE_SECONDS,
        code=code  # 返回验证码
    )


@router.post("/sms/verify", response_model=AuthResponse)
async def sms_verify(request: SMSVerifyRequest, db: Session = Depends(get_db), _=Depends(rate_limit_sms_verify)):
    """
    验证码校验并登录/注册
    
    - 手机号已存在 → 登录
    - 手机号不存在 → 自动创建用户并登录
    """
    phone = request.phone.strip()
    code = request.code.strip()
    
    # 在验证码比对之前，检查目标手机号限流
    check_sms_verify_target_limit(phone)
    
    # 校验手机号格式
    if not _validate_phone(phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="手机号格式不正确"
        )
    
    # 校验验证码
    if not sms_store.verify_code(phone, code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="验证码错误或已过期"
        )
    
    # 查找用户
    user = db.exec(
        select(User).where(User.phone == phone)
    ).first()
    
    if not user:
        # 用户不存在，自动创建
        username = _generate_username(phone)
        # 确保用户名唯一
        while db.exec(select(User).where(User.username == username)).first():
            username = _generate_username(phone)
        
        user = User(
            username=username,
            password_hash=None,  # 手机号注册无密码
            phone=phone
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 签发 JWT token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return AuthResponse(
        access_token=access_token,
        user=UserPublic(
            id=user.id,
            username=user.username,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at
        )
    )
