from datetime import datetime, timezone
import asyncio
import json
import logging
import re
import time
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session as DBSession, select, SQLModel
from langchain_openai import ChatOpenAI

from core.agent.base_agent import BaseAgent
from core.database import engine, get_db
from core.memory.memory_service import MemoryService
from core.memory.memory_tool import create_memory_search_tool
from core.memory.Longterm_Memory import LongtermMemoryStore
from core.deps import get_current_user
from core.rate_limiter import rate_limit_chat, rate_limit_guest
from core.models import User, ChatSession, Message, LongtermMemory
from core.redis_client import get_redis
from core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

agent = BaseAgent()
memory_service = MemoryService()
longterm_memory_store = LongtermMemoryStore()

# ============ 输入预测优化：记忆预缓存 ============
# {user_id: {"memories": [{"title": ..., "content": ...}, ...], "timestamp": float}}
_user_memory_cache: dict = {}
MEMORY_CACHE_TTL = 300  # 5分钟过期

# 预测缓存：{cache_key: {"prediction": str, "timestamp": float}}
_prediction_cache: dict = {}
PREDICTION_CACHE_TTL = 30  # 30秒过期
PREDICTION_CACHE_MAX = 30  # 最多缓存30条

# 输入预测专用轻量模型（模块级单例，只创建一次）
_predict_llm = ChatOpenAI(
    model=settings.PREDICT_MODEL,
    openai_api_key="not-needed",
    openai_api_base=settings.PREDICT_BASE_URL,
    max_tokens=50,
    temperature=0.7,
    model_kwargs={"extra_body": {"chat_template_kwargs": {"enable_thinking": False}}},
)


def _get_cached_memories(user_id: int, db: DBSession) -> list[dict]:
    """
    获取用户记忆（优先从缓存读取，缓存未命中则查 DB 并缓存）
    返回 [{"title": ..., "content": ...}, ...] 最多 10 条
    """
    now = time.time()
    cached = _user_memory_cache.get(user_id)
    if cached and (now - cached["timestamp"]) < MEMORY_CACHE_TTL:
        return cached["memories"]

    # 缓存未命中：从 DB 加载最近的 top 10 条记忆（按重要性+时间排序）
    try:
        stmt = (
            select(LongtermMemory)
            .where(LongtermMemory.user_id == user_id)
            .order_by(LongtermMemory.importance.desc(), LongtermMemory.updated_at.desc())
            .limit(10)
        )
        rows = list(db.exec(stmt).all())
        memories = [{"title": r.title, "content": r.content[:300]} for r in rows]
    except Exception as e:
        logger.warning(f"Predict memory DB load failed: {e}")
        memories = []

    _user_memory_cache[user_id] = {"memories": memories, "timestamp": now}
    return memories


def _keyword_match_memories(memories: list[dict], query: str, top_k: int = 3) -> list[dict]:
    """优化的记忆匹配：优先子串匹配，回退字符匹配"""
    if not memories or not query:
        return []

    scored = []
    for m in memories:
        text = m["title"] + m["content"]
        # 优先级1：子串完全匹配（最强信号）
        if query in text:
            score = 2.0 + len(query) / max(len(text), 1)
        elif len(query) >= 2:
            # 优先级2：滑动窗口子串匹配（部分匹配）
            best_overlap = 0
            for i in range(len(query), 1, -1):
                sub = query[:i]
                if sub in text:
                    best_overlap = i
                    break
            if best_overlap > 0:
                score = 1.0 + best_overlap / len(query)
            else:
                # 优先级3：字符重叠（最弱信号）
                query_chars = set(query)
                overlap = sum(1 for c in query_chars if c in text)
                score = overlap / max(len(query_chars), 1)
        else:
            query_chars = set(query)
            overlap = sum(1 for c in query_chars if c in text)
            score = overlap / max(len(query_chars), 1)

        if score > 0.3:  # 提高阈值从0.15到0.3
            scored.append((score, m))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [m for _, m in scored[:top_k]]

# ============ Redis 会话上下文缓存配置 ============
CONTEXT_CACHE_PREFIX = "context:"  # Redis key 前缀，格式: context:{session_id}
CONTEXT_CACHE_TTL = 3600  # 缓存过期时间（秒），1小时


# ============ Redis 缓存辅助函数 ============
def _get_redis_safe():
    """
    安全获取 Redis 连接，失败返回 None
    
    原理：调用 ping() 验证连接存活，任何异常都返回 None
    这样主逻辑可以无缝降级到 DB 查询
    """
    try:
        r = get_redis()
        r.ping()  # 验证连接是否存活
        return r
    except Exception as e:
        logger.warning(f"Redis unavailable: {e}")
        return None


def _load_context_from_cache(redis_client, session_id: str) -> list | None:
    """
    从 Redis 加载会话上下文
    
    原理：使用 GET 命令读取 JSON 字符串，反序列化为 messages 列表
    返回 None 表示 Cache MISS（key 不存在或已过期）
    
    Args:
        redis_client: Redis 客户端实例
        session_id: 会话 ID
    
    Returns:
        messages 列表（HIT）或 None（MISS）
    """
    key = f"{CONTEXT_CACHE_PREFIX}{session_id}"
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning(f"Redis get failed: {e}")
        return None


def _save_context_to_cache(redis_client, session_id: str, messages: list):
    """
    将会话上下文写入 Redis 缓存
    
    原理：使用 SETEX 命令原子性地设置值和过期时间
    SETEX key seconds value 比 SET + EXPIRE 更安全
    （避免中间断开导致 key 永不过期的问题）
    
    Args:
        redis_client: Redis 客户端实例
        session_id: 会话 ID
        messages: 消息列表
    """
    key = f"{CONTEXT_CACHE_PREFIX}{session_id}"
    try:
        redis_client.setex(key, CONTEXT_CACHE_TTL, json.dumps(messages, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Redis set failed: {e}")


def _append_to_cache(redis_client, session_id: str, new_message: dict):
    """
    追加单条消息到缓存（不重查 DB）
    
    原理：读-改-写模式
    1. GET 获取现有消息列表
    2. append 新消息
    3. SETEX 重新写入（刷新 TTL）
    
    注意：这不是原子操作，但对于聊天场景可接受
    （同一会话不会并发写入）
    
    Args:
        redis_client: Redis 客户端实例
        session_id: 会话 ID
        new_message: 新消息 {"role": "...", "content": "..."}
    """
    key = f"{CONTEXT_CACHE_PREFIX}{session_id}"
    try:
        data = redis_client.get(key)
        if data:
            messages = json.loads(data)
            messages.append(new_message)
            redis_client.setex(key, CONTEXT_CACHE_TTL, json.dumps(messages, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Redis append failed: {e}")


def _invalidate_context_cache(redis_client, session_id: str):
    """
    删除会话缓存（用于会话被删除时）
    
    原理：使用 DEL 命令删除 key
    
    Args:
        redis_client: Redis 客户端实例
        session_id: 会话 ID
    """
    key = f"{CONTEXT_CACHE_PREFIX}{session_id}"
    try:
        redis_client.delete(key)
    except Exception as e:
        logger.warning(f"Redis delete failed: {e}")


class PredictRequest(SQLModel):
    """输入预测请求"""
    text: str
    session_id: str | None = None


@router.post("/chat/predict")
async def predict(
    request: PredictRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    """
    输入预测补全 - SSE 流式返回，基于用户记忆和会话上下文预测用户想问的完整问题

    优化策略：
    - 预测缓存（30s TTL，命中直接返回 done 事件）
    - 记忆预缓存 + 关键词匹配（消除 embedding API 调用，节省 ~500ms）
    - 轻量模型 qwen-turbo（比主模型快 3-5x）
    - 精简 prompt（减少 input tokens）
    - SSE 流式逐 token 输出

    Body: { "text": "用户当前输入", "session_id": "xxx" (可选) }
    Response: SSE stream
        data: {"type": "token", "content": "..."}
        data: {"type": "done", "prediction": "完整预测" | null}
    """
    # 1. 输入校验：空或少于2字符直接返回 null
    if not request.text or len(request.text.strip()) < 2:
        async def _empty():
            yield f"data: {json.dumps({'type': 'done', 'prediction': None}, ensure_ascii=False)}\n\n"
        return StreamingResponse(_empty(), media_type="text/event-stream")

    text = request.text.strip()
    user_id = current_user.id

    # 2. 查预测缓存
    cache_key = f"{user_id}:{text[:20]}"
    now = time.time()
    cached = _prediction_cache.get(cache_key)
    if cached and (now - cached["timestamp"]) < PREDICTION_CACHE_TTL:
        async def _cached_hit():
            yield f"data: {json.dumps({'type': 'done', 'prediction': cached['prediction']}, ensure_ascii=False)}\n\n"
        return StreamingResponse(_cached_hit(), media_type="text/event-stream")

    # 3. 从缓存获取用户记忆 + 关键词匹配（无 embedding 调用）
    all_memories = _get_cached_memories(user_id, db)
    matched = _keyword_match_memories(all_memories, text, top_k=3)
    memories_text = "\n".join(
        f"- {m['title']}: {m['content'][:200]}" for m in matched
    ) if matched else ""

    # 4. 获取会话上下文（最近2条，精简）
    context_text = ""
    recent_msgs = None
    if request.session_id:
        try:
            stmt = (
                select(Message)
                .where(Message.session_id == request.session_id)
                .order_by(Message.created_at.desc())
                .limit(6)
            )
            recent_msgs = list(db.exec(stmt).all())
            if recent_msgs:
                recent_msgs.reverse()
                context_text = "\n".join(
                    f"{m.role}: {m.content[:120]}" for m in recent_msgs
                )
        except Exception as e:
            logger.warning(f"Predict context load failed: {e}")

    # 5. 构造「扮演用户续写」prompt
    system_prompt = (
        "你的任务是续写用户正在输入的消息。用户正在和\"Spider AI\"智能助手对话。\n\n"
        "【重要】请优先参考以下信息来续写：\n"
        "1. [用户记忆] - 用户的个人信息、偏好和历史记录，如果输入与记忆相关，直接续写相关内容\n"
        "2. [最近对话] - 当前对话上下文，如果输入与最近话题相关，延续该话题\n\n"
        "【续写规则】\n"
        "1. 站在用户角度续写（用户在对AI说话，\"你\"指AI助手）\n"
        "2. 只输出续写的文字（不重复用户已输入的内容）\n"
        "3. 如果输入能在记忆中找到匹配，优先补全为相关内容\n"
        "4. 保持简短自然，一句话即可\n"
        "5. 不要加引号、不要解释\n"
        "6. 无法合理续写时输出空字符串\n\n"
        "【示例】\n"
        "[用户记忆: 安全哥美式聚合]\n"
        "用户输入\"安全哥美\" → 续写\"式聚合\"\n\n"
        "[用户记忆: 用户是Python开发者]\n"
        "用户输入\"帮我写\" → 续写\"一个Python脚本\"\n\n"
        "用户输入\"你好，\" → 续写\"能帮我查一下天气吗？\""
    )

    user_parts = []
    if memories_text:
        user_parts.append(f"[用户记忆]\n{memories_text}")
    if context_text:
        user_parts.append(f"[最近对话]\n{context_text}")
    user_parts.append(f"[用户正在输入]\n{text}\n[续写]")
    predict_user_prompt = "\n\n".join(user_parts)

    logger.info(f"Predict context - memories: {len(matched)}, history: {len(recent_msgs) if recent_msgs else 0}")
    for m in matched:
        logger.info(f"  Memory matched: {m['title']}: {m['content'][:50]}")
    logger.info(f"Predict user prompt:\n{predict_user_prompt[:300]}")

    async def generate():
        from langchain_core.messages import SystemMessage, HumanMessage
        full_prediction = ""
        try:
            async for chunk in _predict_llm.astream(
                [SystemMessage(content=system_prompt), HumanMessage(content=predict_user_prompt)],
            ):
                if chunk.content:
                    full_prediction += chunk.content
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk.content}, ensure_ascii=False)}\n\n"

            logger.info(f"Predict raw output: '{full_prediction[:100]}'")

            # 兜底：去除 <think>...</think> 标签内容
            cleaned = re.sub(r'<think>.*?</think>', '', full_prediction, flags=re.DOTALL).strip()
            logger.info(f"Predict cleaned: '{cleaned[:100]}'")

            prediction = cleaned if cleaned else None
            if prediction and len(prediction) < 2:
                prediction = None

            # 写入预测缓存
            if prediction:
                _prediction_cache[cache_key] = {"prediction": prediction, "timestamp": time.time()}
                # 缓存满时淘汰最旧条目
                if len(_prediction_cache) > PREDICTION_CACHE_MAX:
                    oldest_key = min(_prediction_cache, key=lambda k: _prediction_cache[k]["timestamp"])
                    _prediction_cache.pop(oldest_key, None)

            yield f"data: {json.dumps({'type': 'done', 'prediction': prediction}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.warning(f"Predict stream error: {e}")
            yield f"data: {json.dumps({'type': 'done', 'prediction': None}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


class PredictFeedbackRequest(SQLModel):
    """预测反馈请求"""
    prediction: str               # 预测内容
    action: str                   # "accept" | "dismiss" | "ignore"
    latency_ms: int | None = None  # 从预测显示到用户操作的时间(ms)
    input_text: str | None = None  # 用户当时的输入


@router.post("/chat/predict/feedback")
async def predict_feedback(
    request: PredictFeedbackRequest,
    current_user: User = Depends(get_current_user),
):
    """记录用户对预测的反馈（accept/dismiss/ignore），用于后续优化"""
    logger.info(
        f"Predict feedback: user={current_user.id}, action={request.action}, "
        f"latency={request.latency_ms}ms, prediction='{request.prediction[:30]}...'"
    )
    return {"status": "ok"}


class ChatRequest(SQLModel):
    """聊天请求"""
    prompt: str
    session_id: str | None = None  # 可选，不传则自动创建
    mode: str | None = None  # "dual" 表示双答案模式，None/缺省表示普通模式
    images: list[str] | None = None  # base64 data URL 列表


@router.post("/chat")
def chat(
    request: ChatRequest,
    current_user: User = Depends(rate_limit_chat),
    db: DBSession = Depends(get_db)
):
    """
    聊天接口 - SSE 流式响应
    
    Header: Authorization: Bearer {token}
    Body: { "prompt": "用户消息", "session_id": "xxx" (可选) }
    Response: SSE stream
        data: {"type": "content", "content": "..."}
        data: {"type": "done", "session_id": "xxx", "message_id": 123}
    """
    # 1. 会话处理
    if request.session_id:
        # 验证会话属于当前用户
        session = db.get(ChatSession, request.session_id)
        if not session or session.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        # 自动创建新会话
        session = ChatSession(user_id=current_user.id, title="New Chat")
        db.add(session)
        db.commit()
        db.refresh(session)
    
    session_id = session.id
    is_first_message = False
    
    # 2. 检查是否是首轮对话（用于自动标题）
    count_statement = select(Message).where(Message.session_id == session_id)
    existing_messages = db.exec(count_statement).all()
    if len(existing_messages) == 0:
        is_first_message = True
    
    # 3. 纯图片无文字时补默认 prompt
    if request.images and not request.prompt.strip():
        request.prompt = "说明图片，根据图片随心所欲的回答~"
    
    # 保存用户消息到数据库
    user_msg = Message(
        session_id=session_id,
        role="user",
        content=request.prompt,
        token_count=len(request.prompt) // 4,  # 简单估算
        images=json.dumps(request.images) if request.images else None,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    
    # 4. 使用 MemoryService 组装上下文（长期记忆 + 工作记忆 + 当前输入）
    messages = memory_service.assemble_context(
        user_id=current_user.id,
        session_id=session_id,
        user_input=request.prompt,
        db=db,
    )
    
    # 4.5 如果有图片，将最后一条 user 消息改为多模态格式
    has_images = bool(request.images)
    if has_images:
        # 找到最后一条 user 消息并替换 content 为多模态格式
        for i in range(len(messages) - 1, -1, -1):
            if messages[i].get("role") == "user":
                multimodal_content = [
                    {"type": "text", "text": messages[i]["content"]}
                ]
                for img_url in request.images:
                    multimodal_content.append({
                        "type": "image_url",
                        "image_url": {"url": img_url}
                    })
                messages[i]["content"] = multimodal_content
                break
    
    # 记录用于生成器内部使用的数据
    prompt_text = request.prompt
    
    # 双答案模式：并行生成两个答案
    if request.mode == "dual":
        return StreamingResponse(
            _generate_dual(
                agent_instance=agent,
                messages=messages,
                system_prompt_base=agent.system_prompt,
                session_id=session_id,
                is_first_message=is_first_message,
                prompt_text=prompt_text,
                current_user_id=current_user.id,
            ),
            media_type="text/event-stream",
        )
    
    def generate():
        """SSE 流式生成器"""
        full_response = ""
        ai_message_id = None
        token_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        
        try:
            # 创建绑定当前用户的记忆搜索 Tool
            memory_tool = create_memory_search_tool(user_id=current_user.id, db=db)
            
            # 内置工具（时间查询等）
            from core.tools import get_current_time
            builtin_tools = [memory_tool, get_current_time]
            
            # 调用 Agent 流式生成（注入工具，有图片时用 VL 模型）
            for chunk in agent.quick_start_stream(messages, extra_tools=builtin_tools, use_vl_model=has_images):
                if isinstance(chunk, tuple) and len(chunk) >= 1:
                    msg = chunk[0]
                    
                    # 尝试从 chunk 收集 usage 信息（通常在最后一个 chunk）
                    if hasattr(msg, 'usage_metadata') and msg.usage_metadata:
                        um = msg.usage_metadata
                        if hasattr(um, 'input_tokens') and um.input_tokens:
                            token_usage["input_tokens"] = um.input_tokens
                        if hasattr(um, 'output_tokens') and um.output_tokens:
                            token_usage["output_tokens"] = um.output_tokens
                        if hasattr(um, 'total_tokens') and um.total_tokens:
                            token_usage["total_tokens"] = um.total_tokens
                    
                    # 也检查 response_metadata 中的 usage
                    if hasattr(msg, 'response_metadata') and msg.response_metadata:
                        rm = msg.response_metadata
                        if 'usage' in rm:
                            usage = rm['usage']
                            token_usage["input_tokens"] = usage.get('prompt_tokens', 0) or usage.get('input_tokens', 0)
                            token_usage["output_tokens"] = usage.get('completion_tokens', 0) or usage.get('output_tokens', 0)
                            token_usage["total_tokens"] = usage.get('total_tokens', 0)
                    
                    # 跳过 tool_call 消息
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        continue
                    if hasattr(msg, 'tool_call_chunks') and msg.tool_call_chunks:
                        continue
                    
                    # 正常文本内容
                    if hasattr(msg, 'content') and msg.content:
                        full_response += msg.content
                        yield f"data: {json.dumps({'type': 'content', 'content': msg.content}, ensure_ascii=False)}\n\n"
            
            # 如果没有从流中获取到 usage，用估算值
            if token_usage["total_tokens"] == 0:
                estimated_input = sum(len(m.get('content', '')) for m in messages) * 3 // 4
                estimated_output = len(full_response) * 3 // 4
                token_usage = {
                    "input_tokens": estimated_input,
                    "output_tokens": estimated_output,
                    "total_tokens": estimated_input + estimated_output
                }
            
            print(f"[Token Usage] input={token_usage['input_tokens']}, output={token_usage['output_tokens']}, total={token_usage['total_tokens']}")
            
            # 流结束后，使用新的数据库 session 保存 AI 回复
            with DBSession(engine) as save_db:
                # 保存 AI 回复消息（使用真实或估算的 token 数）
                ai_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    token_count=token_usage["output_tokens"] or len(full_response) // 4,
                    input_tokens=token_usage["input_tokens"],
                    output_tokens=token_usage["output_tokens"],
                    total_tokens=token_usage["total_tokens"]
                )
                save_db.add(ai_msg)
                save_db.commit()
                save_db.refresh(ai_msg)
                ai_message_id = ai_msg.id
                
                # 异步触发记忆分析（含工作记忆更新）
                memory_service.trigger_async_analysis(
                    user_id=current_user.id,
                    session_id=session_id,
                    user_input=prompt_text,
                    ai_response=full_response,
                )
                
                # 获取会话并更新
                chat_session = save_db.get(ChatSession, session_id)
                if chat_session:
                    # 自动标题（首轮对话时）
                    if is_first_message:
                        chat_session.title = prompt_text[:50]
                    
                    chat_session.updated_at = datetime.now(timezone.utc)
                    save_db.add(chat_session)
                    save_db.commit()
            
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'message_id': ai_message_id, 'usage': token_usage}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            # 错误处理：返回错误 SSE 事件
            import traceback
            traceback.print_exc()
            error_msg = str(e)
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


async def _generate_dual(agent_instance: BaseAgent, messages: list, system_prompt_base: str,
                         session_id: str, is_first_message: bool, prompt_text: str,
                         current_user_id: int):
    """
    双答案并行 SSE 生成器（asyncio 版）
    
    并行调用两次 LLM（不同温度 + 不同角度 system prompt），
    通过 asyncio.Queue 交错读取并 SSE 发送两个答案，实现真正的异步并行流式输出。
    
    Answer A (index=0): temperature=0.3，简洁直接
    Answer B (index=1): temperature=0.9，多角度分析
    """
    q: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    
    # 提取非 system 消息作为上下文
    context_messages = [m for m in messages if m.get("role") != "system"]
    
    # 获取原始 system prompt
    original_system = ""
    for m in messages:
        if m.get("role") == "system":
            original_system = m.get("content", "")
            break
    
    # 构造两组 messages（不同 system prompt）
    messages_a = [{"role": "system", "content": original_system + "\n\n请简洁直接，给出核心答案，避免冗余。"}] + context_messages
    messages_b = [{"role": "system", "content": original_system + "\n\n请从多个角度深入分析，提供不同视角和思路。"}] + context_messages
    
    async def stream_answer(answer_idx: int, msgs: list, temperature: float):
        """
        单个答案的异步生成任务
        
        在线程池中运行同步的 quick_start_stream，
        通过 asyncio.run_coroutine_threadsafe 将 chunk 实时送入 asyncio.Queue。
        """
        full_text = ""
        token_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        
        def _sync_stream():
            """在线程池中执行的同步流式生成"""
            nonlocal full_text, token_usage
            try:
                for chunk in agent_instance.quick_start_stream(msgs, extra_tools=[], temperature=temperature):
                    if isinstance(chunk, tuple) and len(chunk) >= 1:
                        msg = chunk[0]
                        
                        # 收集 usage 信息
                        if hasattr(msg, 'usage_metadata') and msg.usage_metadata:
                            um = msg.usage_metadata
                            if hasattr(um, 'input_tokens') and um.input_tokens:
                                token_usage["input_tokens"] = um.input_tokens
                            if hasattr(um, 'output_tokens') and um.output_tokens:
                                token_usage["output_tokens"] = um.output_tokens
                            if hasattr(um, 'total_tokens') and um.total_tokens:
                                token_usage["total_tokens"] = um.total_tokens
                        
                        if hasattr(msg, 'response_metadata') and msg.response_metadata:
                            rm = msg.response_metadata
                            if 'usage' in rm:
                                usage = rm['usage']
                                token_usage["input_tokens"] = usage.get('prompt_tokens', 0) or usage.get('input_tokens', 0)
                                token_usage["output_tokens"] = usage.get('completion_tokens', 0) or usage.get('output_tokens', 0)
                                token_usage["total_tokens"] = usage.get('total_tokens', 0)
                        
                        # 跳过 tool_call 消息
                        if hasattr(msg, 'tool_calls') and msg.tool_calls:
                            continue
                        if hasattr(msg, 'tool_call_chunks') and msg.tool_call_chunks:
                            continue
                        
                        # 正常文本内容 —— 实时送入 asyncio.Queue
                        if hasattr(msg, 'content') and msg.content:
                            full_text += msg.content
                            asyncio.run_coroutine_threadsafe(
                                q.put({"type": "content", "content": msg.content, "answer_index": answer_idx}),
                                loop,
                            )
                
                # 估算 usage（如果流中没获取到）
                if token_usage["total_tokens"] == 0:
                    estimated_input = sum(len(m.get('content', '')) for m in msgs) * 3 // 4
                    estimated_output = len(full_text) * 3 // 4
                    token_usage = {
                        "input_tokens": estimated_input,
                        "output_tokens": estimated_output,
                        "total_tokens": estimated_input + estimated_output
                    }
                
                asyncio.run_coroutine_threadsafe(
                    q.put({"type": "answer_done", "answer_index": answer_idx,
                           "full_text": full_text, "usage": token_usage}),
                    loop,
                )
            except Exception as e:
                logger.error(f"Dual answer {answer_idx} error: {e}")
                asyncio.run_coroutine_threadsafe(
                    q.put({"type": "error", "content": str(e), "answer_index": answer_idx}),
                    loop,
                )
                # 即使出错也发送 answer_done 以便主循环正确退出
                asyncio.run_coroutine_threadsafe(
                    q.put({"type": "answer_done", "answer_index": answer_idx,
                           "full_text": full_text, "usage": token_usage, "error": True}),
                    loop,
                )
        
        # 将同步阻塞流放到线程池执行，不阻塞事件循环
        await loop.run_in_executor(None, _sync_stream)
    
    # 启动两个异步任务，真正并行
    task_a = asyncio.create_task(stream_answer(0, messages_a, 0.3))
    task_b = asyncio.create_task(stream_answer(1, messages_b, 0.9))
    
    # 主协程从 asyncio.Queue 读取并 yield SSE（两个答案的 chunk 交错实时输出）
    done_count = 0
    answer_results = {}  # answer_idx -> {full_text, usage}
    
    while done_count < 2:
        try:
            item = await asyncio.wait_for(q.get(), timeout=120)
            if item["type"] == "answer_done":
                done_count += 1
                answer_results[item["answer_index"]] = {
                    "full_text": item.get("full_text", ""),
                    "usage": item.get("usage", {}),
                    "error": item.get("error", False)
                }
                continue
            # content 和 error 事件直接转发给前端
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
        except asyncio.TimeoutError:
            logger.warning("Dual answer generation timed out")
            break
    
    # 确保两个任务都已完成
    await asyncio.gather(task_a, task_b, return_exceptions=True)
    
    # 流结束后，保存两个答案到数据库
    answers_info = []
    try:
        with DBSession(engine) as save_db:
            for idx in sorted(answer_results.keys()):
                result = answer_results[idx]
                if result["error"] and not result["full_text"]:
                    answers_info.append({"message_id": None, "usage": result["usage"], "error": True})
                    continue
                ai_msg = Message(
                    session_id=session_id,
                    role="assistant",
                    content=result["full_text"],
                    token_count=result["usage"].get("output_tokens", 0) or len(result["full_text"]) // 4,
                    input_tokens=result["usage"].get("input_tokens", 0),
                    output_tokens=result["usage"].get("output_tokens", 0),
                    total_tokens=result["usage"].get("total_tokens", 0),
                )
                save_db.add(ai_msg)
                save_db.commit()
                save_db.refresh(ai_msg)
                answers_info.append({"message_id": ai_msg.id, "usage": result["usage"]})
            
            # 记忆分析只触发一次（用 answer A 的内容）
            answer_a = answer_results.get(0, {})
            if answer_a and answer_a.get("full_text"):
                memory_service.trigger_async_analysis(
                    user_id=current_user_id,
                    session_id=session_id,
                    user_input=prompt_text,
                    ai_response=answer_a["full_text"],
                )
            
            # 更新会话
            chat_session = save_db.get(ChatSession, session_id)
            if chat_session:
                if is_first_message:
                    chat_session.title = prompt_text[:50]
                chat_session.updated_at = datetime.now(timezone.utc)
                save_db.add(chat_session)
                save_db.commit()
    except Exception as e:
        logger.error(f"Dual answer save error: {e}")
    
    # 最终 done 事件
    yield f"data: {json.dumps({'type': 'done', 'session_id': session_id, 'answers': answers_info}, ensure_ascii=False)}\n\n"


class GuestChatRequest(SQLModel):
    """游客聊天请求（首页尝鲜）"""
    prompt: str
    images: list[str] | None = None  # base64 data URL 列表


@router.post("/chat/guest")
def guest_chat(request: GuestChatRequest, _=Depends(rate_limit_guest)):
    """
    游客聊天 - 无需登录，不保存记录
    
    Body: { "prompt": "用户消息" }
    Response: SSE stream
        data: {"type": "content", "content": "..."}
        data: {"type": "done"}
    """
    # 纯图片无文字时补默认 prompt
    if request.images and not request.prompt.strip():
        request.prompt = "说明图片，根据图片随心所欲的回答~"
    
    # 构造消息（有图片时使用多模态格式）
    has_images = bool(request.images)
    if has_images:
        user_content = [
            {"type": "text", "text": request.prompt}
        ]
        for img_url in request.images:
            user_content.append({
                "type": "image_url",
                "image_url": {"url": img_url}
            })
        messages = [{"role": "user", "content": user_content}]
    else:
        messages = [{"role": "user", "content": request.prompt}]
    
    def generate():
        full_response = ""
        token_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
        
        try:
            for chunk in agent.quick_start_stream(messages, use_vl_model=has_images):
                if isinstance(chunk, tuple) and len(chunk) >= 1:
                    msg = chunk[0]
                    
                    # 尝试从 chunk 收集 usage 信息
                    if hasattr(msg, 'usage_metadata') and msg.usage_metadata:
                        um = msg.usage_metadata
                        if hasattr(um, 'input_tokens') and um.input_tokens:
                            token_usage["input_tokens"] = um.input_tokens
                        if hasattr(um, 'output_tokens') and um.output_tokens:
                            token_usage["output_tokens"] = um.output_tokens
                        if hasattr(um, 'total_tokens') and um.total_tokens:
                            token_usage["total_tokens"] = um.total_tokens
                    
                    # 也检查 response_metadata 中的 usage
                    if hasattr(msg, 'response_metadata') and msg.response_metadata:
                        rm = msg.response_metadata
                        if 'usage' in rm:
                            usage = rm['usage']
                            token_usage["input_tokens"] = usage.get('prompt_tokens', 0) or usage.get('input_tokens', 0)
                            token_usage["output_tokens"] = usage.get('completion_tokens', 0) or usage.get('output_tokens', 0)
                            token_usage["total_tokens"] = usage.get('total_tokens', 0)
                    
                    # 跳过 tool_call 消息
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        continue
                    if hasattr(msg, 'tool_call_chunks') and msg.tool_call_chunks:
                        continue
                    
                    # 正常文本内容
                    if hasattr(msg, 'content') and msg.content:
                        full_response += msg.content
                        yield f"data: {json.dumps({'type': 'content', 'content': msg.content}, ensure_ascii=False)}\n\n"
            
            # 如果没有从流中获取到 usage，用估算值
            if token_usage["total_tokens"] == 0:
                estimated_input = len(request.prompt) * 3 // 4
                estimated_output = len(full_response) * 3 // 4
                token_usage = {
                    "input_tokens": estimated_input,
                    "output_tokens": estimated_output,
                    "total_tokens": estimated_input + estimated_output
                }
            
            print(f"[Token Usage] guest: input={token_usage['input_tokens']}, output={token_usage['output_tokens']}, total={token_usage['total_tokens']}")
            
            yield f"data: {json.dumps({'type': 'done', 'usage': token_usage}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
