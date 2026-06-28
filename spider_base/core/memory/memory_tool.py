"""记忆搜索 Tool - 让 Agent 自主决定何时检索用户长期记忆"""

import logging
from langchain_core.tools import tool
from sqlmodel import Session as DBSession

from core.memory.Longterm_Memory import LongtermMemoryStore

logger = logging.getLogger(__name__)

# 单例
_longterm_store = LongtermMemoryStore()

# 类型映射为中文标签
_TYPE_LABELS = {
    "preference": "偏好",
    "knowledge": "知识",
    "fact": "事实",
    "event": "事件",
    "skill": "技能",
    "goal": "目标",
    "other": "其他",
}


def create_memory_search_tool(user_id: int, db: DBSession):
    """
    工厂函数：为当前请求创建一个绑定了 user_id 和 db 的记忆搜索 Tool。
    
    通过闭包捕获 user_id 和 db，使 Tool 执行时能访问当前用户上下文。
    
    Args:
        user_id: 当前用户 ID
        db: 当前请求的数据库 session
    
    Returns:
        LangChain Tool 实例
    """
    @tool
    def search_user_memory(query: str) -> str:
        """当用户提到之前告诉过你的事情、个人偏好、历史信息时，或当你需要回忆用户的个人信息时，调用此工具搜索用户的长期记忆。
        
        Args:
            query: 搜索关键词，描述你想要回忆的内容
        """
        try:
            memories = _longterm_store.search(
                user_id=user_id,
                query=query,
                db=db,
                top_k=5,
            )
            
            if not memories:
                return "没有找到相关记忆。"
            
            lines = [f"找到 {len(memories)} 条相关记忆："]
            for i, mem in enumerate(memories, 1):
                label = _TYPE_LABELS.get(mem.type, mem.type)
                content_preview = mem.content[:150] if len(mem.content) > 150 else mem.content
                lines.append(f"{i}. [{label}] {mem.title} - {content_preview}")
            
            result = "\n".join(lines)
            logger.info(f"Memory tool searched for user {user_id}, query='{query[:50]}', found {len(memories)} results")
            return result
            
        except Exception as e:
            logger.warning(f"Memory tool search failed: {e}")
            return "记忆搜索暂时不可用，请直接回答用户"
    
    return search_user_memory
