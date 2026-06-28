"""长期记忆 - DB 持久化 + Qdrant 向量检索"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import dashscope
from sqlmodel import Session as DBSession, select

from core.config import settings
from core.models import LongtermMemory
from core.memory.qdrant_client import get_qdrant_client, ensure_collection

logger = logging.getLogger(__name__)

# 设置 DashScope API Key
dashscope.api_key = settings.DASHSCOPE_API_KEY


def _get_embedding(text: str) -> list[float] | None:
    """
    调用 DashScope MultiModalEmbedding API 获取文本向量。
    使用 tongyi-embedding-vision-flash-2026-03-06 模型，dimension=768 匹配 Qdrant。
    # 原配置：qwen3-vl-embedding, dimension=1024
    返回 None 表示调用失败。
    """
    try:
        resp = dashscope.MultiModalEmbedding.call(
            model=settings.MEMORY_EMBEDDING_MODEL,
            input=[{"text": text[:2000]}],  # 截断防超长
            dimension=768,  # 匹配 Qdrant collection 维度（原 1024）
        )
        if resp.status_code == 200:
            return resp.output["embeddings"][0]["embedding"]
        else:
            logger.warning(f"Embedding API failed: status={resp.status_code}, msg={resp.message}")
            return None
    except Exception as e:
        logger.warning(f"Embedding API failed: {e}")
        return None


class LongtermMemoryStore:
    """长期记忆存储：DB 持久化 + Qdrant 向量检索"""
    
    def save(self, db: DBSession, user_id: int, type: str, title: str, 
             content: str, importance: int = 5, source: str = "auto") -> LongtermMemory | None:
        """
        保存一条长期记忆：
        1. 去重检查：同用户下相同 title 的记忆已存在则更新
        2. 写入 DB（longterm_memories 表）
        3. 向量化后存入 Qdrant（异步容错，失败不影响 DB 存储）
        """
        try:
            # 1. 去重检查：同用户下是否已有相同 title 的记忆
            existing = db.exec(
                select(LongtermMemory).where(
                    LongtermMemory.user_id == user_id,
                    LongtermMemory.title == title
                )
            ).first()
            
            if existing:
                # 已存在，更新内容而不是新建
                existing.content = content
                existing.importance = max(existing.importance, importance)
                existing.updated_at = datetime.now(timezone.utc)
                existing.source = source  # 更新来源
                db.add(existing)
                db.commit()
                db.refresh(existing)
                # 更新 Qdrant 向量
                self._upsert_vector(existing)
                logger.info(f"LongtermMemory updated (dedup): id={existing.id}, title='{title}'")
                return existing
            
            # 2. 不存在，创建新记录
            memory = LongtermMemory(
                user_id=user_id,
                type=type,
                title=title,
                content=content,
                importance=importance,
                source=source,
            )
            db.add(memory)
            db.commit()
            db.refresh(memory)
            
            # 3. Qdrant 向量存储
            self._upsert_vector(memory)
            
            logger.info(f"LongtermMemory saved: id={memory.id}, title='{title}'")
            return memory
        except Exception as e:
            logger.error(f"LongtermMemory save failed: {e}")
            db.rollback()
            return None
    
    def _upsert_vector(self, memory: LongtermMemory):
        """将记忆向量化后存入 Qdrant"""
        try:
            ensure_collection()
            client = get_qdrant_client()
            if not client:
                logger.warning("Qdrant client is None, skip upsert")
                return
            
            # 用 title + content 前200字 做向量化
            text = f"{memory.title}。{memory.content[:200]}"
            logger.info(f"[Qdrant] Embedding text: {text[:50]}...")
            embedding = _get_embedding(text)
            if not embedding:
                logger.warning("[Qdrant] Embedding returned None, skip upsert")
                return
            
            logger.info(f"[Qdrant] Got embedding dim={len(embedding)}, upserting id={memory.id}")
            from qdrant_client.models import PointStruct
            client.upsert(
                collection_name=settings.QDRANT_COLLECTION,
                points=[
                    PointStruct(
                        id=memory.id,
                        vector=embedding,
                        payload={
                            "user_id": memory.user_id,
                            "memory_id": memory.id,
                            "type": memory.type,
                            "title": memory.title,
                        },
                    )
                ],
            )
            print(f"✅ [Qdrant] Upsert success: id={memory.id}, title='{memory.title}'")
        except Exception as e:
            logger.warning(f"Qdrant upsert failed: {e}")
            import traceback
            traceback.print_exc()
    
    def search(self, user_id: int, query: str, db: DBSession, 
               top_k: int = 5, score_threshold: float = 0.3) -> list[LongtermMemory]:
        """
        语义检索长期记忆：
        1. query 向量化
        2. Qdrant 搜索（按 user_id 过滤）
        3. 用返回的 memory_id 从 DB 加载完整记录
        4. 更新 access_count 和 last_accessed_at
        5. 过滤低相关度记忆（score < threshold）
        
        如果 Qdrant 不可用，fallback 到 DB LIKE 搜索
        
        Args:
            user_id: 用户 ID
            query: 查询文本
            db: 数据库 session
            top_k: 返回数量上限
            score_threshold: 相似度阈值（0-1），低于此值的结果被过滤
        
        Returns:
            记忆列表，按相似度降序排列
        """
        # 尝试向量检索
        client = get_qdrant_client()
        logger.info(f"Memory search: user_id={user_id}, query='{query[:50]}', qdrant_client={'ok' if client else 'None'}")
        if client:
            try:
                embedding = _get_embedding(query)
                logger.info(f"Memory search: embedding={'ok' if embedding else 'None'}")
                if embedding:
                    from qdrant_client.models import Filter, FieldCondition, MatchValue
                    # qdrant-client >= 1.12 使用 query_points 替代已移除的 search
                    response = client.query_points(
                        collection_name=settings.QDRANT_COLLECTION,
                        query=embedding,
                        query_filter=Filter(
                            must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
                        ),
                        limit=top_k,
                        score_threshold=score_threshold,  # Qdrant 服务端过滤
                        with_payload=True,
                    )
                    results = response.points
                    logger.info(f"Qdrant search returned {len(results)} hits: {[(h.id, round(h.score, 3)) for h in results]}")
                    if results:
                        memories = []
                        for hit in results:
                            # 二次过滤：确保 score >= threshold（防御性）
                            if hit.score < score_threshold:
                                continue
                            mid = hit.payload.get("memory_id")
                            if not mid:
                                continue
                            mem = db.get(LongtermMemory, mid)
                            if mem and mem.user_id == user_id:
                                # 更新访问记录
                                mem.access_count += 1
                                mem.last_accessed_at = datetime.now(timezone.utc)
                                db.add(mem)
                                memories.append(mem)
                        db.commit()
                        return memories
            except Exception as e:
                logger.warning(f"Qdrant search failed, falling back to DB: {e}")
        
        # Fallback: DB LIKE 搜索
        return self._db_search_fallback(user_id, query, db, top_k)
    
    def _db_search_fallback(self, user_id: int, query: str, db: DBSession, limit: int) -> list[LongtermMemory]:
        """DB fallback 搜索（简单 LIKE 匹配）"""
        try:
            stmt = (
                select(LongtermMemory)
                .where(
                    LongtermMemory.user_id == user_id,
                    (LongtermMemory.title.contains(query)) | (LongtermMemory.content.contains(query))
                )
                .order_by(LongtermMemory.importance.desc(), LongtermMemory.updated_at.desc())
                .limit(limit)
            )
            return list(db.exec(stmt).all())
        except Exception as e:
            logger.warning(f"DB search fallback failed: {e}")
            return []
    
    def list_by_user(self, user_id: int, db: DBSession, limit: int = 50) -> list[LongtermMemory]:
        """获取用户所有长期记忆"""
        stmt = (
            select(LongtermMemory)
            .where(LongtermMemory.user_id == user_id)
            .order_by(LongtermMemory.updated_at.desc())
            .limit(limit)
        )
        return list(db.exec(stmt).all())
    
    def delete(self, memory_id: int, user_id: int, db: DBSession) -> bool:
        """删除一条长期记忆（DB + Qdrant）"""
        try:
            mem = db.get(LongtermMemory, memory_id)
            if not mem or mem.user_id != user_id:
                return False
            
            # 删除 DB 记录
            db.delete(mem)
            db.commit()
            
            # 删除 Qdrant 向量
            try:
                client = get_qdrant_client()
                if client:
                    from qdrant_client.models import PointIdsList
                    client.delete(
                        collection_name=settings.QDRANT_COLLECTION,
                        points_selector=PointIdsList(points=[memory_id]),
                    )
            except Exception as e:
                logger.warning(f"Qdrant delete failed: {e}")
            
            return True
        except Exception as e:
            logger.error(f"LongtermMemory delete failed: {e}")
            db.rollback()
            return False
    
    def get_titles(self, user_id: int, db: DBSession, limit: int = 20) -> list[dict]:
        """获取用户长期记忆标题列表（轻量级，供分析器使用）"""
        stmt = (
            select(LongtermMemory.id, LongtermMemory.title, LongtermMemory.type)
            .where(LongtermMemory.user_id == user_id)
            .order_by(LongtermMemory.importance.desc())
            .limit(limit)
        )
        results = db.exec(stmt).all()
        return [{"id": r[0], "title": r[1], "type": r[2]} for r in results]
