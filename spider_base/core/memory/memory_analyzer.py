"""记忆分析器 - LLM 驱动的异步记忆分类"""
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MemoryEntry:
    """单条待存储的长期记忆"""
    type: str          # "preference" / "knowledge" / "decision" / "experience"
    title: str         # 记忆标题
    content: str       # 记忆内容
    importance: int    # 1-10


@dataclass
class MemoryConflict:
    """记忆冲突"""
    old_memory_id: int
    old_title: str
    new_content: str
    reason: str


@dataclass
class MemoryAnalysisResult:
    """记忆分析结果"""
    should_save_longterm: bool = False
    longterm_entries: list[MemoryEntry] = field(default_factory=list)
    conflicts: list[MemoryConflict] = field(default_factory=list)
    summary: str = ""  # 本轮对话摘要（可用于工作记忆压缩）


class MemoryAnalyzer:
    """
    LLM 驱动的记忆分析器。
    对话完成后异步调用，不阻塞聊天主流程。
    """
    
    ANALYSIS_PROMPT = """你是一个记忆分析助手。分析以下对话，判断是否需要将其中的信息存为用户的长期记忆。

## 用户已有的长期记忆标题
{existing_titles}

## 本轮对话
用户: {user_input}
AI: {ai_response}

## 分析规则
1. **应该保存为长期记忆的内容**：
   - 用户明确表达的偏好（如"我喜欢..."、"我不喜欢..."）
   - 用户的个人信息（姓名、职业、学历等）
   - 用户满意的解决方案或建议
   - 用户明确要求记住的内容（如"请记住"、"帮我记下"）
   - 重要的决策或结论

2. **不应该保存的内容**：
   - 闲聊、问候
   - 一次性的信息查询
   - 与用户个人无关的通用知识
   - 临时性的讨论

3. **冲突检测**：
   - 如果本轮对话中用户表达的信息与已有记忆矛盾，标记冲突
   - 例如：已有记忆"用户喜欢简洁回复"，但用户说"请给我详细解释"

## 重要：去重规则
- **严禁输出与"用户已有的长期记忆标题"相同或高度相似的条目**
- 在输出前必须检查每个条目的 title 是否已在已有记忆中出现
- 如果用户表达的信息与已有记忆相似，不要输出新条目，而是在 conflicts 中标记

## 输出格式（严格JSON）
```json
{{
  "should_save": true/false,
  "entries": [
    {{
      "type": "preference/knowledge/decision/experience",
      "title": "简短标题（10字以内）",
      "content": "详细记忆内容",
      "importance": 1-10
    }}
  ],
  "conflicts": [
    {{
      "old_memory_id": 123,
      "old_title": "旧记忆标题",
      "new_content": "新的记忆内容",
      "reason": "冲突原因"
    }}
  ],
  "summary": "本轮对话的一句话摘要"
}}
```

如果没有需要保存的内容，返回 `{{"should_save": false, "entries": [], "conflicts": [], "summary": "摘要"}}`
只返回JSON，不要其他文字。"""

    def analyze(self, user_input: str, ai_response: str, 
                existing_titles: list[dict]) -> MemoryAnalysisResult:
        """
        同步调用 LLM 分析本轮对话（在后台线程中运行，所以用同步即可）。
        
        参数：
        - user_input: 用户本轮输入
        - ai_response: AI 本轮回复
        - existing_titles: 用户已有长期记忆 [{"id": 1, "title": "xxx", "type": "preference"}, ...]
        
        返回：MemoryAnalysisResult
        """
        try:
            # 格式化已有记忆标题
            if existing_titles:
                titles_text = "\n".join(
                    f"- [{t['type']}] {t['title']} (id={t['id']})" 
                    for t in existing_titles
                )
            else:
                titles_text = "（暂无）"
            
            # 构造 prompt
            prompt = self.ANALYSIS_PROMPT.format(
                existing_titles=titles_text,
                user_input=user_input[:1000],    # 截断防超长
                ai_response=ai_response[:2000],  # 截断防超长
            )
            
            # 调用 DashScope OpenAI 兼容 API
            url = f"{settings.DASHSCOPE_BASE_URL}/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": settings.MEMORY_ANALYSIS_MODEL,
                "messages": [
                    {"role": "system", "content": "你是记忆分析助手，只输出JSON格式。"},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,  # 低温度，确保输出稳定
                "response_format": {"type": "json_object"},  # 强制JSON输出
            }
            
            with httpx.Client(timeout=30) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"MemoryAnalyzer API resp type={type(data).__name__}, keys={list(data.keys()) if isinstance(data, dict) else 'N/A'}, raw={str(data)[:500]}")
                content = data["choices"][0]["message"]["content"]
            
            logger.info(f"MemoryAnalyzer raw content (first 300): {repr(content[:300]) if isinstance(content, str) else repr(content)}")
            
            # 解析 JSON 结果
            return self._parse_result(content)
            
        except Exception as e:
            logger.error(f"MemoryAnalyzer failed: [{type(e).__name__}] {e}")
            # 分析失败，返回默认结果（不保存）
            return MemoryAnalysisResult(summary=f"分析失败: {str(e)[:100]}")
    
    def _extract_json(self, text: str) -> dict:
        """从 LLM 响应中提取 JSON，处理各种包装格式"""
        # 1. 去除 <think>...</think> 或类似思考标签（部分模型会有）
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        # 兼容其他可能的思考标签格式
        text = re.sub(r'<\|thinking\|>.*?<\|/thinking\|>', '', text, flags=re.DOTALL).strip()
            
        # 2. 去除 markdown 代码块包裹
        md_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if md_match:
            text = md_match.group(1).strip()
            
        # 3. 尝试找到 JSON 对象边界 { ... }
        brace_start = text.find('{')
        brace_end = text.rfind('}')
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            text = text[brace_start:brace_end + 1]
            
        return json.loads(text)
    
    def _parse_result(self, content: str) -> MemoryAnalysisResult:
        """解析 LLM 返回的 JSON"""
        try:
            data = self._extract_json(content)
            
            result = MemoryAnalysisResult(
                should_save_longterm=data.get("should_save", False),
                summary=data.get("summary", ""),
            )
            
            # 解析 entries
            for entry in data.get("entries", []):
                result.longterm_entries.append(MemoryEntry(
                    type=entry.get("type", "knowledge"),
                    title=entry.get("title", "未命名记忆")[:200],
                    content=entry.get("content", ""),
                    importance=min(max(entry.get("importance", 5), 1), 10),
                ))
            
            # 解析 conflicts
            for conflict in data.get("conflicts", []):
                result.conflicts.append(MemoryConflict(
                    old_memory_id=conflict.get("old_memory_id", 0),
                    old_title=conflict.get("old_title", ""),
                    new_content=conflict.get("new_content", ""),
                    reason=conflict.get("reason", ""),
                ))
            
            return result
            
        except Exception as e:
            logger.warning(f"MemoryAnalyzer parse failed: [{type(e).__name__}] {e}\nRaw response (first 500 chars): {content[:500] if isinstance(content, str) else repr(content)}")
            return MemoryAnalysisResult(summary="解析失败")
