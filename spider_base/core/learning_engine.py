"""学习引擎 - 批量分析对话和项目内容，生成长期记忆"""

import json
import logging
import re
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from sqlmodel import Session as DBSession, select

from core.config import settings
from core.database import engine
from core.memory.Longterm_Memory import LongtermMemoryStore
from core.models import (
    ChatSession, 
    Message, 
    Project, 
    ProjectChatMessage, 
    LongtermMemory, 
    LearningSession
)

logger = logging.getLogger(__name__)


class LearningEngine:
    """
    学习引擎核心逻辑。
    采集 ChatPage 对话 + Project 内容 + 现有偏好记忆，
    用 LLM 批量分析并生成新的长期记忆。
    """
    
    def __init__(self):
        self._running = {}  # user_id -> bool，运行状态
        self._progress = {}  # user_id -> dict，进度信息
        self._lock = threading.Lock()
        self._longterm_store = LongtermMemoryStore()
        self._scheduled_timers = {}  # user_id -> Timer，定时学习定时器
    
    def start_learning(self, user_id: int, mode: str = "incremental") -> int:
        """
        启动学习任务（后台线程）。
        mode: "full"=全量分析, "incremental"=仅处理新数据
        
        Returns:
            session_id: 学习会话ID
        """
        with self._lock:
            # 1. 检查是否已在运行
            if self._running.get(user_id, False):
                raise RuntimeError("学习任务已在运行中")
            
            # 2. 创建 LearningSession 记录
            with DBSession(engine) as db:
                session = LearningSession(
                    user_id=user_id,
                    status="running",
                    mode=mode,
                    start_time=datetime.now(timezone.utc),
                )
                db.add(session)
                db.commit()
                db.refresh(session)
                session_id = session.id
            
            # 3. 标记为运行中
            self._running[user_id] = True
            self._progress[user_id] = {
                "session_id": session_id,
                "status": "running",
                "progress": 0,
                "stage": "initializing",
                "message": "初始化中...",
            }
            
            # 4. 启动后台线程
            thread = threading.Thread(
                target=self._do_learning,
                args=(user_id, session_id, mode),
                daemon=True
            )
            thread.start()
            
            logger.info(f"Learning started: user_id={user_id}, session_id={session_id}, mode={mode}")
            return session_id
    
    def get_status(self, user_id: int) -> dict:
        """获取学习状态"""
        with self._lock:
            progress = self._progress.get(user_id, {})
            is_running = self._running.get(user_id, False)
            is_scheduled = user_id in self._scheduled_timers
                
            if is_running:
                return {
                    "status": "running",
                    "progress": progress.get("progress", 0),
                    "stage": progress.get("stage", ""),
                    "message": progress.get("message", ""),
                    "session_id": progress.get("session_id"),
                    "scheduled": is_scheduled,
                }
            else:
                # 检查是否有最近完成的会话
                with DBSession(engine) as db:
                    stmt = (
                        select(LearningSession)
                        .where(LearningSession.user_id == user_id)
                        .order_by(LearningSession.start_time.desc())
                        .limit(1)
                    )
                    result = db.exec(stmt).first()
                    if result:
                        return {
                            "status": result.status,
                            "progress": 100 if result.status == "completed" else 0,
                            "stage": "finished",
                            "message": f"上次学习: {result.memories_generated} 条记忆生成",
                            "session_id": result.id,
                            "memories_generated": result.memories_generated,
                            "data_processed": result.data_processed,
                            "duration_seconds": result.duration_seconds,
                            "completed_at": result.end_time.isoformat() if result.end_time else None,
                            "scheduled": is_scheduled,
                        }
                    return {"status": "idle", "progress": 0, "stage": "", "message": "无学习记录", "scheduled": is_scheduled}
    
    def _update_progress(self, user_id: int, progress: int, stage: str, message: str):
        """更新进度"""
        with self._lock:
            if user_id in self._progress:
                self._progress[user_id]["progress"] = progress
                self._progress[user_id]["stage"] = stage
                self._progress[user_id]["message"] = message
    
    def _do_learning(self, user_id: int, session_id: int, mode: str):
        """后台执行学习"""
        start_time = time.time()
        memories_generated = 0
        data_processed = 0
        
        try:
            # 使用独立 DB session
            with DBSession(engine) as db:
                # 1. 采集阶段 (0-30%)
                self._update_progress(user_id, 5, "collecting", "正在采集对话数据...")
                chat_data = self._collect_chat_data(user_id, db, mode)
                data_processed += len(chat_data)
                
                self._update_progress(user_id, 15, "collecting", "正在采集项目数据...")
                project_data = self._collect_project_data(user_id, db, mode)
                data_processed += len(project_data)
                
                self._update_progress(user_id, 25, "collecting", "正在获取已有记忆...")
                existing_memories = self._get_existing_memories(user_id, db)
                
                # 合并所有待分析数据
                all_data = chat_data + project_data
                
                if not all_data:
                    self._update_progress(user_id, 100, "completed", "无新数据需要分析")
                    self._finish_session(db, session_id, data_processed, 0, int(time.time() - start_time), "completed")
                    return
                
                # 2. 分析阶段 (30-80%)
                self._update_progress(user_id, 30, "analyzing", f"正在分析 {len(all_data)} 个数据源...")
                
                # 分批处理，每批最多5个数据源
                batch_size = 5
                all_new_memories = []
                
                try:
                    for i in range(0, len(all_data), batch_size):
                        batch = all_data[i:i + batch_size]
                        progress = 30 + int((i / len(all_data)) * 50)
                        self._update_progress(user_id, progress, "analyzing", f"正在分析批次 {i//batch_size + 1}/{(len(all_data)-1)//batch_size + 1}...")
                        
                        batch_memories = self._analyze_batch(batch, existing_memories)
                        all_new_memories.extend(batch_memories)
                        
                        # 短暂休眠避免 API 限流
                        time.sleep(0.5)
                except Exception as e:
                    logger.error(f"Learning analysis failed: {e}")
                    duration = int(time.time() - start_time)
                    self._finish_session(db, session_id, data_processed, memories_generated, duration, "failed")
                    self._update_progress(user_id, 0, "failed", f"学习失败: {str(e)[:100]}")
                    return
                
                # 3. 存储阶段 (80-100%)
                self._update_progress(user_id, 80, "saving", f"正在保存 {len(all_new_memories)} 条记忆...")
                
                for idx, mem in enumerate(all_new_memories):
                    try:
                        # 去重检查：检查是否已有相似标题的记忆
                        if not self._is_duplicate(mem["title"], existing_memories):
                            self._longterm_store.save(
                                db=db,
                                user_id=user_id,
                                type=mem["type"],
                                title=mem["title"],
                                content=mem["content"],
                                importance=mem.get("importance", 5),
                                source="auto",
                            )
                            memories_generated += 1
                            # 添加到已有记忆列表防止后续重复
                            existing_memories.append({"title": mem["title"], "type": mem["type"]})
                        
                        progress = 80 + int((idx + 1) / len(all_new_memories) * 20)
                        self._update_progress(user_id, progress, "saving", f"已保存 {idx + 1}/{len(all_new_memories)} 条记忆...")
                    except Exception as e:
                        logger.warning(f"保存记忆失败: {e}")
                
                # 4. 完成
                duration = int(time.time() - start_time)
                self._finish_session(db, session_id, data_processed, memories_generated, duration, "completed")
                self._update_progress(user_id, 100, "completed", f"学习完成！生成 {memories_generated} 条新记忆")
                
                logger.info(f"Learning completed: user_id={user_id}, session_id={session_id}, "
                           f"memories={memories_generated}, duration={duration}s")
                
        except Exception as e:
            logger.error(f"Learning failed: user_id={user_id}, error={e}")
            try:
                with DBSession(engine) as db:
                    duration = int(time.time() - start_time)
                    self._finish_session(db, session_id, data_processed, memories_generated, duration, "failed")
            except Exception as e2:
                logger.error(f"Failed to update session status: {e2}")
            self._update_progress(user_id, 0, "failed", f"学习失败: {str(e)[:100]}")
        finally:
            with self._lock:
                self._running[user_id] = False
    
    def _finish_session(self, db: DBSession, session_id: int, data_processed: int, 
                        memories_generated: int, duration: int, status: str):
        """完成学习会话"""
        session = db.get(LearningSession, session_id)
        if session:
            session.status = status
            session.end_time = datetime.now(timezone.utc)
            session.data_processed = data_processed
            session.memories_generated = memories_generated
            session.duration_seconds = duration
            db.add(session)
            db.commit()
    
    def start_scheduled(self, user_id: int, interval_seconds: int = 3600):
        """启动定时学习（每 interval_seconds 秒执行一次 Incremental）"""
        self.stop_scheduled(user_id)  # 先停止已有的
        
        def _run_and_reschedule():
            try:
                self.start_learning(user_id, mode="incremental")
            except RuntimeError as e:
                logger.warning(f"Scheduled learning failed for user {user_id}: {e}")
            # 学习完成后重新调度
            if user_id in self._scheduled_timers:
                timer = threading.Timer(interval_seconds, _run_and_reschedule)
                timer.daemon = True
                timer.start()
                self._scheduled_timers[user_id] = timer
        
        timer = threading.Timer(interval_seconds, _run_and_reschedule)
        timer.daemon = True
        timer.start()
        self._scheduled_timers[user_id] = timer
        logger.info(f"Scheduled learning started for user {user_id}, interval={interval_seconds}s")
    
    def stop_scheduled(self, user_id: int):
        """停止定时学习"""
        if user_id in self._scheduled_timers:
            self._scheduled_timers[user_id].cancel()
            del self._scheduled_timers[user_id]
            logger.info(f"Scheduled learning stopped for user {user_id}")
    
    def is_scheduled(self, user_id: int) -> bool:
        """检查是否有定时学习"""
        return user_id in self._scheduled_timers
    
    def _is_duplicate(self, title: str, existing_memories: list[dict]) -> bool:
        """检查是否重复（标题相似度检查）"""
        title_lower = title.lower().strip()
        for mem in existing_memories:
            existing_title = mem.get("title", "").lower().strip()
            # 完全匹配认为是重复
            if title_lower == existing_title:
                return True
            # 高度相似（一方包含另一方且长度差距不大）认为是重复
            if title_lower and existing_title:
                if title_lower in existing_title or existing_title in title_lower:
                    # 只有当长度差距小于50%时才算重复，避免误判
                    len_ratio = min(len(title_lower), len(existing_title)) / max(len(title_lower), len(existing_title))
                    if len_ratio > 0.5:
                        return True
        return False
    
    def _collect_chat_data(self, user_id: int, db: DBSession, mode: str) -> list[dict]:
        """从 Message 表采集对话数据"""
        # 确定时间范围
        if mode == "incremental":
            # 只取最近7天的对话
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
        else:
            # 全量：取最近90天
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)
        
        # 获取用户的所有会话
        stmt = select(ChatSession).where(
            ChatSession.user_id == user_id,
            ChatSession.updated_at >= cutoff_date
        )
        sessions = db.exec(stmt).all()
        
        result = []
        for session in sessions:
            # 获取每个会话的最近消息（最多20条）
            stmt = (
                select(Message)
                .where(Message.session_id == session.id)
                .order_by(Message.created_at.desc())
                .limit(20)
            )
            messages = db.exec(stmt).all()
            
            if messages:
                # 按时间正序排列
                messages = list(reversed(messages))
                
                # 构建消息列表
                msg_list = []
                for msg in messages:
                    msg_list.append({
                        "role": msg.role,
                        "content": msg.content[:500],  # 截断防超长
                        "created_at": msg.created_at.isoformat() if msg.created_at else None,
                    })
                
                result.append({
                    "source": "chatpage",
                    "session_id": session.id,
                    "session_title": session.title,
                    "message_count": len(msg_list),
                    "messages": msg_list,
                })
        
        return result
    
    def _collect_project_data(self, user_id: int, db: DBSession, mode: str) -> list[dict]:
        """从 Project + ProjectChatMessage 表采集项目数据"""
        # 确定时间范围
        if mode == "incremental":
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
        else:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)
        
        # 获取用户的所有项目
        stmt = select(Project).where(
            Project.user_id == user_id,
            Project.updated_at >= cutoff_date
        )
        projects = db.exec(stmt).all()
        
        result = []
        for project in projects:
            # 获取项目的最近聊天消息（最多15条）
            stmt = (
                select(ProjectChatMessage)
                .where(
                    ProjectChatMessage.project_id == project.id,
                    ProjectChatMessage.created_at >= cutoff_date
                )
                .order_by(ProjectChatMessage.created_at.desc())
                .limit(15)
            )
            messages = db.exec(stmt).all()
            
            # 按时间正序排列
            messages = list(reversed(messages))
            
            msg_list = []
            for msg in messages:
                msg_list.append({
                    "role": msg.role,
                    "content": msg.content[:500],
                    "created_at": msg.created_at.isoformat() if msg.created_at else None,
                })
            
            result.append({
                "source": "project",
                "project_id": project.id,
                "project_name": project.name,
                "description": project.description[:300] if project.description else "",
                "message_count": len(msg_list),
                "messages": msg_list,
            })
        
        return result
    
    def _get_existing_memories(self, user_id: int, db: DBSession) -> list[dict]:
        """获取用户已有的长期记忆标题列表"""
        return self._longterm_store.get_titles(user_id, db, limit=100)
    
    def _analyze_batch(self, collected_data: list[dict], existing_memories: list[dict]) -> list[dict]:
        """用 LLM 批量分析，返回需要保存的记忆列表"""
        # 构建已有记忆标题文本
        if existing_memories:
            titles_text = "\n".join(
                f"- [{m.get('type', 'unknown')}] {m.get('title', '')}" 
                for m in existing_memories[:50]  # 最多50条避免超长
            )
        else:
            titles_text = "（暂无已有记忆）"
        
        # 构建待分析数据摘要
        data_summary = []
        for idx, item in enumerate(collected_data):
            if item["source"] == "chatpage":
                summary = f"【对话 {idx+1}】{item['session_title']}\n"
                for msg in item["messages"][-5:]:  # 只取最近5条
                    role_label = "用户" if msg["role"] == "user" else "AI"
                    content = msg["content"][:200]  # 截断
                    summary += f"  {role_label}: {content}\n"
            else:  # project
                summary = f"【项目 {idx+1}】{item['project_name']}\n"
                if item["description"]:
                    summary += f"  描述: {item['description'][:100]}\n"
                for msg in item["messages"][-3:]:  # 只取最近3条
                    role_label = "用户" if msg["role"] == "user" else "AI"
                    content = msg["content"][:150]
                    summary += f"  {role_label}: {content}\n"
            data_summary.append(summary)
        
        data_text = "\n---\n".join(data_summary)
        
        # 构建 prompt
        prompt = f"""你是一个记忆分析专家。请分析以下用户的对话和项目数据，提取有价值的长期记忆。

## 已有记忆（避免重复提取相似内容）
{titles_text}

## 待分析数据
{data_text}

## 分析规则
请提取以下类型的记忆：
- preference: 用户偏好（如编程风格、工具选择、语言偏好、喜欢的回复方式等）
- knowledge: 知识点（用户了解或在学习的领域知识、专业背景等）
- skill: 技能（用户掌握的技术技能、编程语言、框架等）
- habit: 习惯（工作习惯、使用模式、常用操作等）

## 输出格式（严格JSON）
```json
{{
  "memories": [
    {{
      "type": "preference/knowledge/skill/habit",
      "title": "简短标题（15字以内）",
      "content": "详细记忆内容（100字以内）",
      "importance": 1-10,
      "source": "chatpage/project"
    }}
  ]
}}
```

重要提示：
1. 只输出新的、不与已有记忆重复的条目
2. 确保提取的内容是用户相关的个人特征，而非通用知识
3. 如果无新内容可提取，返回空数组 {{"memories": []}}
4. 只返回JSON，不要其他文字"""

        # 调用 DashScope OpenAI 兼容 API
        url = f"{settings.DASHSCOPE_BASE_URL}/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.MEMORY_ANALYSIS_MODEL,
            "messages": [
                {"role": "system", "content": "你是记忆分析专家，只输出JSON格式。"},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        
        try:
            with httpx.Client(timeout=120) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                
                # 检查 API 返回的错误
                if "error" in data:
                    error_info = data["error"]
                    logger.error(f"DashScope API error: {error_info}")
                    raise RuntimeError(f"API error: {error_info}")
                
                # 检查 choices 是否存在
                if "choices" not in data or not data["choices"]:
                    logger.error(f"DashScope API response missing choices: {data}")
                    raise RuntimeError("API response missing choices")
                
                content = data["choices"][0]["message"]["content"]
                logger.info(f"LearningEngine LLM response (first 300 chars): {repr(content[:300])}")
        except httpx.TimeoutException as e:
            logger.error(f"LLM API timeout after 120s: {e}")
            raise RuntimeError(f"LLM API timeout: {e}")
        except httpx.HTTPStatusError as e:
            logger.error(f"LLM API HTTP error: {e.response.status_code} - {e.response.text[:500]}")
            raise RuntimeError(f"LLM API HTTP error {e.response.status_code}: {e.response.text[:200]}")
        except Exception as e:
            logger.error(f"LLM API call failed: [{type(e).__name__}] {e}")
            raise
        
        # 解析 JSON
        return self._parse_analysis_result(content, collected_data)
    
    def _parse_analysis_result(self, content: str, source_data: list[dict]) -> list[dict]:
        """解析 LLM 分析结果"""
        try:
            # 处理 content 可能不是字符串的情况
            if not isinstance(content, str):
                logger.error(f"LLM response content is not string: {type(content)} - {repr(content)[:500]}")
                return []
            
            original_content = content  # 保留原始内容用于错误日志
            
            # 清理思考标签（qwen3 模型会在开头插入 <think>...</think>）
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            content = re.sub(r'<\|thinking\|>.*?<\|/thinking\|>', '', content, flags=re.DOTALL).strip()
            
            # 提取 markdown 代码块
            md_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
            if md_match:
                content = md_match.group(1).strip()
            
            # 找到 JSON 对象边界
            brace_start = content.find('{')
            brace_end = content.rfind('}')
            if brace_start == -1 or brace_end == -1 or brace_end <= brace_start:
                logger.error(f"No JSON object found in response. Content preview: {original_content[:500]}")
                return []
            
            content = content[brace_start:brace_end + 1]
            
            # 解析 JSON
            try:
                data = json.loads(content)
            except json.JSONDecodeError as je:
                logger.error(f"JSON decode error at position {je.pos}: {je.msg}. Content around error: {content[max(0,je.pos-50):je.pos+50]}")
                return []
            
            # 获取 memories 数组
            if not isinstance(data, dict):
                logger.error(f"Parsed JSON is not an object: {type(data)} - {repr(data)[:500]}")
                return []
            
            memories = data.get("memories", [])
            if not isinstance(memories, list):
                logger.error(f"'memories' field is not a list: {type(memories)} - {repr(memories)[:500]}")
                return []
            
            # 验证和清理
            valid_memories = []
            for idx, mem in enumerate(memories):
                if not isinstance(mem, dict):
                    logger.warning(f"Memory item {idx} is not a dict: {type(mem)}")
                    continue
                if not all(k in mem for k in ["type", "title", "content"]):
                    logger.warning(f"Memory item {idx} missing required fields: {mem.keys()}")
                    continue
                # 限制字段长度
                mem["title"] = str(mem["title"])[:200]
                mem["content"] = str(mem["content"])[:1000]
                mem["importance"] = min(max(mem.get("importance", 5), 1), 10)
                # 设置 source
                if "source" not in mem:
                    mem["source"] = source_data[0]["source"] if source_data else "unknown"
                valid_memories.append(mem)
            
            logger.info(f"Successfully parsed {len(valid_memories)} memories from LLM response")
            return valid_memories
            
        except Exception as e:
            logger.error(f"Parse analysis result failed: [{type(e).__name__}] {e}. Raw content preview: {repr(content)[:500] if 'content' in dir() else 'N/A'}")
            return []


# 单例实例
_learning_engine: Optional[LearningEngine] = None


def get_learning_engine() -> LearningEngine:
    """获取学习引擎单例"""
    global _learning_engine
    if _learning_engine is None:
        _learning_engine = LearningEngine()
    return _learning_engine
