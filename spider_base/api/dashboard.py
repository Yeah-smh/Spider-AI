from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from core.deps import get_current_user
from core.database import get_db
from core.models import User, ChatSession, Message, Project, LongtermMemory, LearningSession
from core.agent.models import SubAgent
from core.skills.models import Skill
from core.mcp.models import McpServer

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    days: int = 7,  # 支持 1, 7, 30
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取 Dashboard 统计数据"""
    # 参数校验
    if days not in (1, 7, 30):
        days = 7  # 默认 7 天
    
    user_id = current_user.id
    now = datetime.now(timezone.utc)
    range_start = now - timedelta(days=days)
    
    # ---- Token Usage ----
    # 获取用户所有会话 ID
    session_ids_stmt = select(ChatSession.id).where(ChatSession.user_id == user_id)
    session_ids = db.exec(session_ids_stmt).all()
    
    if session_ids:
        # 时间范围内的 Token 用量（只统计 assistant 消息）
        token_stmt = select(
            func.coalesce(func.sum(Message.input_tokens), 0),
            func.coalesce(func.sum(Message.output_tokens), 0),
            func.coalesce(func.sum(Message.total_tokens), 0)
        ).where(
            Message.session_id.in_(session_ids),
            Message.role == "assistant",
            Message.created_at >= range_start
        )
        token_result = db.exec(token_stmt).one()
        total_input = token_result[0]
        total_output = token_result[1]
        total_tokens = token_result[2]
        
        # 时间范围内每日 Token 趋势
        token_daily = []
        for i in range(days - 1, -1, -1):  # 从 days-1 天前到今天
            day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            daily_stmt = select(
                func.coalesce(func.sum(Message.total_tokens), 0)
            ).where(
                Message.session_id.in_(session_ids),
                Message.role == "assistant",
                Message.created_at >= day_start,
                Message.created_at < day_end
            )
            daily_tokens = db.exec(daily_stmt).one()
            
            token_daily.append({
                "date": day_start.strftime("%m-%d"),
                "day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day_start.weekday()],
                "tokens": daily_tokens
            })
    else:
        total_input = 0
        total_output = 0
        total_tokens = 0
        token_daily = []
    
    # 计算日均
    daily_avg = total_tokens // days if total_tokens > 0 else 0
    
    # ---- Conversations ----
    # 时间范围内的会话数
    session_count_stmt = select(func.count(ChatSession.id)).where(
        ChatSession.user_id == user_id,
        ChatSession.created_at >= range_start
    )
    total_sessions = db.exec(session_count_stmt).one()
    
    # 时间范围内的消息数
    if session_ids:
        msg_count_stmt = select(func.count(Message.id)).where(
            Message.session_id.in_(session_ids),
            Message.created_at >= range_start
        )
        total_messages = db.exec(msg_count_stmt).one()
    else:
        total_messages = 0
    
    # 时间范围内每日会话数（按 created_at 统计新建的会话）
    conv_daily = []
    for i in range(days - 1, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        daily_conv_stmt = select(func.count(ChatSession.id)).where(
            ChatSession.user_id == user_id,
            ChatSession.created_at >= day_start,
            ChatSession.created_at < day_end
        )
        daily_count = db.exec(daily_conv_stmt).one()
        
        conv_daily.append({
            "date": day_start.strftime("%m-%d"),
            "day": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day_start.weekday()],
            "count": daily_count
        })
    
    # 本周新增会话数
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_sessions_stmt = select(func.count(ChatSession.id)).where(
        ChatSession.user_id == user_id,
        ChatSession.created_at >= week_start
    )
    week_new_sessions = db.exec(week_sessions_stmt).one()
    
    # ---- Agents Stats ----
    # 子代理总数
    total_agents_stmt = select(func.count(SubAgent.id)).where(SubAgent.user_id == user_id)
    total_agents = db.exec(total_agents_stmt).one()
    
    # 项目总数
    total_projects_stmt = select(func.count(Project.id)).where(Project.user_id == user_id)
    total_projects = db.exec(total_projects_stmt).one()
    
    # 按类型分组的代理数（SubAgent 没有 type 字段，使用空字典）
    agents_by_type = {}
    
    # 最近 5 个子代理（关联 Project 表获取 project_name）
    recent_agents_stmt = (
        select(SubAgent, Project.name.label("project_name"))
        .outerjoin(Project, SubAgent.project_id == Project.id)
        .where(SubAgent.user_id == user_id)
        .order_by(SubAgent.created_at.desc())
        .limit(5)
    )
    recent_agents_result = db.exec(recent_agents_stmt).all()
    recent_agents = [
        {
            "name": agent.SubAgent.display_name or agent.SubAgent.name,
            "type": "custom",  # SubAgent 没有 type 字段，使用默认值
            "project_name": agent.project_name or "",
            "created_at": agent.SubAgent.created_at.isoformat() if agent.SubAgent.created_at else ""
        }
        for agent in recent_agents_result
    ]
    
    # ---- Tools & Skills Stats ----
    # 技能总数
    total_skills_stmt = select(func.count(Skill.id)).where(Skill.user_id == user_id)
    total_skills = db.exec(total_skills_stmt).one()
    
    # MCP Server 总数
    total_mcp_stmt = select(func.count(McpServer.id)).where(McpServer.user_id == user_id)
    total_mcp_servers = db.exec(total_mcp_stmt).one()
    
    # 已启用的 MCP 数量
    enabled_mcp_stmt = select(func.count(McpServer.id)).where(
        McpServer.user_id == user_id,
        McpServer.is_enabled == True
    )
    enabled_mcp_count = db.exec(enabled_mcp_stmt).one()
    
    # 已启用的 MCP 名称列表（最多 5 个）
    mcp_names_stmt = (
        select(McpServer.display_name)
        .where(McpServer.user_id == user_id, McpServer.is_enabled == True)
        .order_by(McpServer.created_at.desc())
        .limit(5)
    )
    mcp_names = [name for name in db.exec(mcp_names_stmt).all()]
    
    # 最近技能名称列表（最多 5 个）
    skill_names_stmt = (
        select(Skill.name)
        .where(Skill.user_id == user_id)
        .order_by(Skill.created_at.desc())
        .limit(5)
    )
    skill_names = [name for name in db.exec(skill_names_stmt).all()]
    
    # ---- Memory Stats ----
    # 长期记忆总数
    longterm_count_stmt = select(func.count(LongtermMemory.id)).where(
        LongtermMemory.user_id == user_id
    )
    longterm_count = db.exec(longterm_count_stmt).one()
    
    # 按类型分组统计
    type_stats_stmt = (
        select(LongtermMemory.type, func.count(LongtermMemory.id))
        .where(LongtermMemory.user_id == user_id)
        .group_by(LongtermMemory.type)
    )
    type_stats = {t: c for t, c in db.exec(type_stats_stmt).all()}
    
    # 最近记忆（最多 5 个）
    recent_memories_stmt = (
        select(LongtermMemory.title, LongtermMemory.type)
        .where(LongtermMemory.user_id == user_id)
        .order_by(LongtermMemory.created_at.desc())
        .limit(5)
    )
    recent_memories = [{"title": t, "type": tp} for t, tp in db.exec(recent_memories_stmt).all()]
    
    # ---- Learning Stats ----
    # 自动生成的记忆数
    auto_memories_stmt = select(func.count(LongtermMemory.id)).where(
        LongtermMemory.user_id == user_id,
        LongtermMemory.source == "auto"
    )
    auto_memories_count = db.exec(auto_memories_stmt).one()
    
    # 学习会话总数
    learning_sessions_stmt = select(func.count(LearningSession.id)).where(
        LearningSession.user_id == user_id
    )
    learning_sessions_count = db.exec(learning_sessions_stmt).one()
    
    # 完成的学习会话数
    completed_sessions_stmt = select(func.count(LearningSession.id)).where(
        LearningSession.user_id == user_id,
        LearningSession.status == "completed"
    )
    completed_sessions_count = db.exec(completed_sessions_stmt).one()
    
    # 总生成记忆数
    total_generated_stmt = select(func.coalesce(func.sum(LearningSession.memories_generated), 0)).where(
        LearningSession.user_id == user_id
    )
    total_memories_generated = db.exec(total_generated_stmt).one() or 0
    
    # 最近一次学习会话
    recent_learning_stmt = (
        select(LearningSession)
        .where(LearningSession.user_id == user_id)
        .order_by(LearningSession.start_time.desc())
        .limit(1)
    )
    recent_learning = db.exec(recent_learning_stmt).first()
    
    return {
        "token_usage": {
            "total": total_tokens,
            "input": total_input,
            "output": total_output,
            "daily_avg": daily_avg,
            "daily": token_daily
        },
        "conversations": {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "week_new": week_new_sessions,
            "daily": conv_daily
        },
        "agents_stats": {
            "total_agents": total_agents,
            "total_projects": total_projects,
            "agents_by_type": agents_by_type,
            "recent_agents": recent_agents
        },
        "tools_skills_stats": {
            "total_skills": total_skills,
            "total_mcp_servers": total_mcp_servers,
            "enabled_mcp_count": enabled_mcp_count,
            "mcp_names": mcp_names,
            "skill_names": skill_names
        },
        "memory_stats": {
            "total_longterm": longterm_count,
            "by_type": type_stats,
            "recent_memories": recent_memories
        },
        "learning_stats": {
            "auto_memories": auto_memories_count,
            "total_sessions": learning_sessions_count,
            "completed_sessions": completed_sessions_count,
            "total_generated": total_memories_generated,
            "last_session": {
                "status": recent_learning.status if recent_learning else None,
                "mode": recent_learning.mode if recent_learning else None,
                "memories_generated": recent_learning.memories_generated if recent_learning else 0,
                "start_time": recent_learning.start_time.isoformat() if recent_learning and recent_learning.start_time else None
            } if recent_learning else None
        }
    }
