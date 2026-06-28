"""记忆系统统一服务层"""
import logging
import threading
from datetime import datetime, timezone

from sqlmodel import Session as DBSession

from core.config import settings
from core.database import engine
from core.memory.Sensory_Memory import SensoryMemory
from core.memory.Working_Memory import WorkingMemory
from core.memory.Longterm_Memory import LongtermMemoryStore
from core.memory.memory_analyzer import MemoryAnalyzer
from core.memory.cross_context import get_project_summary_for_chat, get_preference_summary
from core.models import LongtermMemory

logger = logging.getLogger(__name__)

# 单例
_longterm_store = LongtermMemoryStore()
_analyzer = MemoryAnalyzer()


class MemoryService:
    """
    记忆系统统一服务层。
    封装三级记忆的协调逻辑：上下文组装、异步分析、冲突处理。
    """
    
    def assemble_context(self, user_id: int, session_id: str, 
                         user_input: str, db: DBSession,
                         include_cross_context: bool = True) -> list[dict]:
        """
        组装完整上下文:
        上下文 = 跨源上下文(可选) + 工作记忆(历史消息) + 当前用户输入
        
        长期记忆检索已改为 Agent Tool 模式，由 LLM 自行决定何时搜索。
        
        返回: messages 列表，可直接传给 Agent
        """
        messages = []
        
        # 1. 注入跨源上下文（如果启用）
        if include_cross_context:
            cross_context_parts = []
            
            # 获取项目摘要
            project_summary = get_project_summary_for_chat(user_id, db)
            if project_summary:
                cross_context_parts.append(project_summary)
            
            # 获取偏好摘要
            preference_summary = get_preference_summary(user_id, db)
            if preference_summary:
                cross_context_parts.append(preference_summary)
            
            # 如果有跨源上下文，作为 system 消息注入到开头
            if cross_context_parts:
                cross_context_content = "以下是用户的跨平台上下文信息，供你参考：\n\n" + "\n\n".join(cross_context_parts)
                messages.append({"role": "system", "content": cross_context_content})
        
        # 2. 加载工作记忆（Redis → DB fallback）
        working_memory = WorkingMemory(user_id=user_id, session_id=session_id)
        history = working_memory.load_context(db)
        messages.extend(history)
        
        # 3. 确保当前用户输入在消息列表中
        if messages and messages[-1].get("role") == "user" and messages[-1].get("content") == user_input:
            pass  # 已存在
        elif not messages or messages[-1].get("content") != user_input:
            messages.append({"role": "user", "content": user_input})
        
        return messages
    
    def _format_memories(self, memories: list[LongtermMemory]) -> str:
        """格式化长期记忆为文本（保留兼容性）"""
        lines = []
        for mem in memories:
            lines.append(f"- **[{mem.type}]** {mem.title}: {mem.content[:200]}")
        return "\n".join(lines)
    
    def trigger_async_analysis(self, user_id: int, session_id: str,
                                user_input: str, ai_response: str):
        """
        异步触发记忆分析（在后台线程中执行，不阻塞聊天流）。
        使用独立的 DB session，避免线程安全问题。
        """
        def _analyze_in_background():
            try:
                with DBSession(engine) as db:
                    self._do_analysis(user_id, session_id, user_input, ai_response, db)
            except Exception as e:
                logger.error(f"Background memory analysis failed: {e}")
        
        thread = threading.Thread(target=_analyze_in_background, daemon=True)
        thread.start()
        logger.info(f"Memory analysis triggered in background for user {user_id}")
    
    def _do_analysis(self, user_id: int, session_id: str,
                     user_input: str, ai_response: str, db: DBSession):
        """执行记忆分析的实际逻辑（在后台线程中运行）"""
        # 1. 获取用户已有长期记忆标题
        existing_titles = _longterm_store.get_titles(user_id, db)
        existing_title_set = {t["title"] for t in existing_titles}  # 用于本地去重
        
        # 2. 调用 LLM 分析
        result = _analyzer.analyze(user_input, ai_response, existing_titles)
        logger.info(f"Memory analysis result: should_save={result.should_save_longterm}, "
                    f"entries={len(result.longterm_entries)}, conflicts={len(result.conflicts)}")
        
        # 3. 保存长期记忆（带本地去重）
        if result.should_save_longterm and result.longterm_entries:
            saved_count = 0
            for entry in result.longterm_entries:
                # 本地去重：检查 LLM 返回的 title 是否已存在
                if entry.title in existing_title_set:
                    logger.info(f"Skipping duplicate memory (local dedup): title='{entry.title}'")
                    continue
                
                _longterm_store.save(
                    db=db,
                    user_id=user_id,
                    type=entry.type,
                    title=entry.title,
                    content=entry.content,
                    importance=entry.importance,
                    source="auto",
                )
                existing_title_set.add(entry.title)  # 添加到本地集合，防止同批次内重复
                saved_count += 1
            logger.info(f"Saved {saved_count}/{len(result.longterm_entries)} long-term memories for user {user_id}")
        
        # 4. 处理冲突（新记忆覆盖旧记忆）
        if result.conflicts:
            for conflict in result.conflicts:
                if conflict.old_memory_id:
                    old_mem = db.get(LongtermMemory, conflict.old_memory_id)
                    if old_mem and old_mem.user_id == user_id:
                        old_mem.content = conflict.new_content
                        old_mem.updated_at = datetime.now(timezone.utc)
                        db.add(old_mem)
                        logger.info(f"Updated conflicting memory: id={conflict.old_memory_id}")
            db.commit()
        
        # 5. 更新工作记忆（追加 AI 回复到缓存）
        working_memory = WorkingMemory(user_id=user_id, session_id=session_id)
        working_memory.append_message("assistant", ai_response)
    
    # ===== 用户记忆管理接口 =====
    
    def get_user_memories(self, user_id: int, db: DBSession) -> list[dict]:
        """获取用户所有长期记忆"""
        memories = _longterm_store.list_by_user(user_id, db)
        return [
            {
                "id": m.id,
                "type": m.type,
                "title": m.title,
                "content": m.content,
                "summary": m.summary,
                "importance": m.importance,
                "source": m.source,
                "access_count": m.access_count,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "updated_at": m.updated_at.isoformat() if m.updated_at else None,
            }
            for m in memories
        ]
    
    def search_memories(self, user_id: int, query: str, db: DBSession) -> list[dict]:
        """语义搜索用户记忆"""
        memories = _longterm_store.search(user_id, query, db)
        return [
            {
                "id": m.id,
                "type": m.type,
                "title": m.title,
                "content": m.content,
                "importance": m.importance,
                "access_count": m.access_count,
            }
            for m in memories
        ]
    
    def delete_memory(self, memory_id: int, user_id: int, db: DBSession) -> bool:
        """删除一条长期记忆"""
        return _longterm_store.delete(memory_id, user_id, db)
    
    def pin_memory(self, user_id: int, title: str, content: str, 
                   type: str = "knowledge", db: DBSession = None) -> dict | None:
        """
        用户主动保存记忆（pin）。
        """
        if not db:
            return None
        memory = _longterm_store.save(
            db=db,
            user_id=user_id,
            type=type,
            title=title,
            content=content,
            importance=8,  # 用户主动保存的，重要性较高
            source="user",
        )
        if memory:
            return {
                "id": memory.id,
                "type": memory.type,
                "title": memory.title,
                "content": memory.content,
                "importance": memory.importance,
            }
        return None
