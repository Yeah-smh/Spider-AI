"""Qdrant 向量数据库客户端封装"""
import logging
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PayloadSchemaType

from core.config import settings

logger = logging.getLogger(__name__)

_client = None


def get_qdrant_client() -> QdrantClient | None:
    """获取 Qdrant 单例连接"""
    global _client
    if _client is None:
        try:
            _client = QdrantClient(url=settings.QDRANT_URL, timeout=5)
        except Exception as e:
            logger.warning(f"Qdrant connection failed: {e}")
            return None
    return _client


def ensure_collection() -> bool:
    """确保 collection 存在，不存在则创建"""
    client = get_qdrant_client()
    if not client:
        return False
    try:
        collections = [c.name for c in client.get_collections().collections]
        if settings.QDRANT_COLLECTION not in collections:
            # 原配置：size=1024 配合 qwen3-vl-embedding
            # 现配置：size=768 配合 tongyi-embedding-vision-flash-2026-03-06
            client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=VectorParams(size=768, distance=Distance.COSINE),
            )
            # 创建 user_id payload 索引
            client.create_payload_index(
                collection_name=settings.QDRANT_COLLECTION,
                field_name="user_id",
                field_schema=PayloadSchemaType.INTEGER,
            )
            logger.info(f"Created Qdrant collection: {settings.QDRANT_COLLECTION}")
        return True
    except Exception as e:
        logger.warning(f"Qdrant ensure_collection failed: {e}")
        return False


def qdrant_available() -> bool:
    """检查 Qdrant 是否可用"""
    client = get_qdrant_client()
    if not client:
        return False
    try:
        client.get_collections()
        return True
    except Exception:
        return False
