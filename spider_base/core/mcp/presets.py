"""预置公共 MCP Server 定义"""

from core.config import settings

# MCP 容器名称（用于 docker exec 执行 MCP Server）
MCP_CONTAINER_NAME = "spider-mcp"

# MCP 容器所在 VM 的 SSH 地址（需提前配置免密登录）
MCP_SSH_TARGET = f"{settings.WORKSPACE_SSH_USER}@{settings.WORKSPACE_SSH_HOST}"

PRESET_MCP_SERVERS = [
    {
        "name": "github",
        "display_name": "GitHub",
        "description": "操作 GitHub 仓库、Issue、Pull Request、代码搜索",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env_keys": ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    },
    {
        "name": "fetch",
        "display_name": "Fetch (网页抓取)",
        "description": "抓取网页内容、URL 获取、HTML 转 Markdown",
        "transport": "stdio",
        "command": "uvx",
        "args": ["mcp-server-fetch"],
        "env_keys": [],
    },
    {
        "name": "filesystem",
        "display_name": "Filesystem (文件系统)",
        "description": "文件读写、目录操作",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        "env_keys": [],
    },
    {
        "name": "memory",
        "display_name": "Memory (知识图谱)",
        "description": "持久化记忆存储、知识图谱、关系查询",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "env_keys": [],
    },
    {
        "name": "sequential-thinking",
        "display_name": "Sequential Thinking",
        "description": "动态思维链、反思性问题解决、复杂推理",
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
        "env_keys": [],
    },
]


def get_preset_list(enabled_names: list[str] | None = None) -> list[dict]:
    """返回预置列表，含是否已启用状态
    
    Args:
        enabled_names: 用户已启用的 preset name 列表
    """
    enabled = set(enabled_names or [])
    result = []
    for preset in PRESET_MCP_SERVERS:
        result.append({
            **preset,
            "is_enabled": preset["name"] in enabled,
        })
    return result
