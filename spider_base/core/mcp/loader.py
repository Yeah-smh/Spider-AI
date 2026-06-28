"""MCP 工具加载器 — 封装 langchain-mcp-adapters 异步调用"""
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def _load_mcp_tools_async(connections: dict) -> list[Any]:
    """异步加载 MCP 工具
    
    Args:
        connections: MultiServerMCPClient 连接配置字典
        
    Returns:
        LangChain Tool 对象列表
    """
    if not connections:
        return []
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient
        logger.info(f"正在连接 MCP Server: {list(connections.keys())}")
        client = MultiServerMCPClient(connections)
        tools = await client.get_tools()
        logger.info(f"已加载 {len(tools)} 个 MCP 工具: {[t.name for t in tools]}")
        return tools
    except Exception as e:
        # 递归解包 ExceptionGroup/TaskGroup 暴露最底层异常
        def _unwrap(exc, depth=0):
            parts = [f"{'  '*depth}{type(exc).__name__}: {exc}"]
            if hasattr(exc, 'exceptions'):
                for sub in exc.exceptions:
                    parts.extend(_unwrap(sub, depth+1))
            if exc.__cause__:
                parts.extend(_unwrap(exc.__cause__, depth+1))
            return parts
        detail = "\n".join(_unwrap(e))
        logger.error(f"加载 MCP 工具失败 (详细):\n{detail}")
        return []


def load_mcp_tools_sync(connections: dict) -> list[Any]:
    """同步包装（供 SSE 流式调用链使用）
    
    在 FastAPI 的同步 SSE 生成器中调用此函数加载 MCP 工具。
    自动检测事件循环状态，选择合适的执行方式。
    
    Args:
        connections: MultiServerMCPClient 连接配置字典
        
    Returns:
        LangChain Tool 对象列表
    """
    if not connections:
        return []
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # 在已有事件循环中（如 FastAPI 异步上下文），用新线程执行
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(
                    asyncio.run, _load_mcp_tools_async(connections)
                ).result(timeout=60)  # 增加超时到60s，首次uvx需下载依赖
        else:
            return loop.run_until_complete(_load_mcp_tools_async(connections))
    except RuntimeError:
        return asyncio.run(_load_mcp_tools_async(connections))
    except Exception as e:
        logger.error(f"同步加载 MCP 工具失败: {e}")
        return []
