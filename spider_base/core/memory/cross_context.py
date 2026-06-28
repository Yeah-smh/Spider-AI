"""跨源上下文服务 - ChatPage 与 Projects 内容互通"""
import logging
from sqlmodel import Session as DBSession, select, desc
from core.models import Message, Project, ProjectChatMessage, LongtermMemory, ChatSession

logger = logging.getLogger(__name__)


def get_project_summary_for_chat(user_id: int, db: DBSession, max_projects: int = 5) -> str:
    """
    为 ChatPage 聊天获取用户的项目摘要。
    返回格式化文本，带 [来源:Projects] 标签。
    包含：项目名称、描述、最近几条项目聊天内容。
    """
    try:
        # 1. 查询用户的项目列表（按更新时间倒序）
        projects = db.exec(
            select(Project)
            .where(Project.user_id == user_id)
            .order_by(desc(Project.updated_at))
            .limit(max_projects)
        ).all()
        
        if not projects:
            return ""
        
        # 2. 构建项目摘要
        lines = ["[来源:Projects] 用户项目概览："]
        
        for project in projects:
            # 项目基本信息
            project_line = f"\n• 项目「{project.name}」"
            if project.description:
                project_line += f"：{project.description[:100]}"
                if len(project.description) > 100:
                    project_line += "..."
            lines.append(project_line)
            
            # 获取最近3条项目聊天消息
            recent_messages = db.exec(
                select(ProjectChatMessage)
                .where(
                    ProjectChatMessage.project_id == project.id,
                    ProjectChatMessage.user_id == user_id
                )
                .order_by(desc(ProjectChatMessage.created_at))
                .limit(3)
            ).all()
            
            if recent_messages:
                lines.append("  最近对话：")
                # 反转顺序，按时间正序显示
                for msg in reversed(recent_messages):
                    role = "用户" if msg.role == "user" else "助手"
                    content = msg.content[:80] if len(msg.content) > 80 else msg.content
                    lines.append(f"    - {role}：{content}")
        
        return "\n".join(lines)
        
    except Exception as e:
        logger.error(f"获取项目摘要失败: {e}")
        return ""


def get_chat_summary_for_project(user_id: int, db: DBSession, max_sessions: int = 3, max_messages_per_session: int = 5) -> str:
    """
    为 Projects 聊天获取用户的 ChatPage 近期对话摘要。
    返回格式化文本，带 [来源:ChatPage] 标签。
    包含：最近N个会话的摘要（每个会话取最近几条消息）。
    """
    try:
        # 1. 查询用户最近的 ChatSession（按更新时间倒序）
        sessions = db.exec(
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(desc(ChatSession.updated_at))
            .limit(max_sessions)
        ).all()
        
        if not sessions:
            return ""
        
        # 2. 构建对话摘要
        lines = ["[来源:ChatPage] 用户近期对话概览："]
        
        for session in sessions:
            lines.append(f"\n• 会话「{session.title}」")
            
            # 获取最近几条消息
            recent_messages = db.exec(
                select(Message)
                .where(Message.session_id == session.id)
                .order_by(desc(Message.created_at))
                .limit(max_messages_per_session)
            ).all()
            
            if recent_messages:
                # 反转顺序，按时间正序显示
                for msg in reversed(recent_messages):
                    role = "用户" if msg.role == "user" else "助手"
                    content = msg.content[:80] if len(msg.content) > 80 else msg.content
                    lines.append(f"  - {role}：{content}")
        
        return "\n".join(lines)
        
    except Exception as e:
        logger.error(f"获取对话摘要失败: {e}")
        return ""


def get_preference_summary(user_id: int, db: DBSession, limit: int = 10) -> str:
    """
    获取用户偏好记忆摘要，带 [来源:偏好记忆] 标签。
    查询 LongtermMemory 中 type 包含 preference/habit 的条目。
    """
    try:
        # 查询偏好和习惯类型的长期记忆
        memories = db.exec(
            select(LongtermMemory)
            .where(
                LongtermMemory.user_id == user_id,
                LongtermMemory.type.in_(["preference", "habit"])
            )
            .order_by(desc(LongtermMemory.importance), desc(LongtermMemory.updated_at))
            .limit(limit)
        ).all()
        
        if not memories:
            return ""
        
        # 格式化偏好记忆
        lines = ["[来源:偏好记忆] 用户偏好与习惯："]
        
        for mem in memories:
            type_label = "偏好" if mem.type == "preference" else "习惯"
            content = mem.content[:150] if len(mem.content) > 150 else mem.content
            lines.append(f"\n• [{type_label}] {mem.title}：{content}")
        
        return "\n".join(lines)
        
    except Exception as e:
        logger.error(f"获取偏好记忆摘要失败: {e}")
        return ""
