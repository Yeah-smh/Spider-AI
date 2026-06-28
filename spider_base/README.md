# Spider.AI 后端服务（spider_base）

> Spider.AI 好邻居智能助手后端服务，基于 **FastAPI + LangChain + SQLModel** 构建，提供 SSE 流式对话、三级记忆、学习引擎、MCP 工具市场与子代理编排等核心能力。

---

## 一、核心能力

| 模块 | 说明 |
|------|------|
| SSE 流式对话 | 双答案并行生成 + 工具调用 + Token 用量统计 |
| 输入预测 | 本地 vLLM (Qwen3-0.6B) 驱动，缓存池 + 记忆预缓存 + 行为反馈 |
| 三级记忆 | 感觉记忆 → 工作记忆 (Redis TTL) → 长期记忆 (Qdrant 向量检索) |
| 学习引擎 | 全量 / 增量 / 定时三种模式，LLM 批量分析，三重去重入库 |
| MCP 工具市场 | 预置 + 自定义 MCP Server，Docker 容器化 stdio 传输 |
| 子代理编排 | Supervisor 模式动态创建专家代理，绑定 MCP 工具执行任务 |
| 项目管理 | 文件树 / 读写 / 上传 / 运行代码 + 项目级 Agent 对话 |
| 认证系统 | JWT + 短信验证码 + Redis 限流 + 多维度防暴力破解 |

---

## 二、技术栈

- **框架**：FastAPI（异步、lifespan 生命周期）
- **ORM**：SQLModel + SQLAlchemy
- **数据库**：openGauss / PostgreSQL（启动自动迁移、版本兼容）
- **缓存**：Redis（会话上下文 / 限流 / 降级）
- **向量库**：Qdrant（长期记忆语义检索）
- **AI 模型**：LangChain + DashScope API（qwen-plus / qwen-vl）
- **本地推理**：vLLM（Qwen3-0.6B，输入预测）
- **Agent**：deepagents + langchain-mcp-adapters
- **认证**：PyJWT + bcrypt + OAuth2
- **配置**：Pydantic Settings（.env）
- **依赖管理**：uv

---

## 三、项目结构

```
spider_base/
├── main.py                    # 应用入口 (lifespan + CORS + 路由注册)
├── api/                       # API 路由层
│   ├── __init__.py
│   ├── auth.py                # 认证 (注册/登录/短信登录/me)
│   ├── sessions.py            # 会话管理 (CRUD)
│   ├── llm_chat.py            # 聊天 (SSE/双答案/预测/图片)
│   ├── dashboard.py           # 仪表板统计
│   ├── projects.py            # 项目管理 (文件操作/代码执行/Agent对话)
│   ├── skills.py              # 技能管理
│   ├── mcp.py                 # MCP 服务器管理
│   ├── sub_agents.py          # 子代理管理
│   ├── memory.py              # 长期记忆 API
│   └── learning.py            # 学习引擎 API
├── core/                      # 核心业务层
│   ├── __init__.py
│   ├── config.py              # 配置中心 (Pydantic Settings)
│   ├── database.py            # 数据库引擎 + 自动迁移 + openGauss兼容
│   ├── models.py              # 数据模型 (SQLModel ORM)
│   ├── redis_client.py        # Redis 连接池 + 健康检查
│   ├── deps.py                # 依赖注入 (JWT认证/DB会话)
│   ├── security.py            # JWT 生成/验证 + 密码哈希
│   ├── rate_limiter.py        # Redis 固定窗口限流 (多维度)
│   ├── sms_store.py           # 短信验证码存储与校验
│   ├── ssh_backend.py         # SSH 远程执行后端
│   ├── workspace.py           # 远程工作空间文件操作
│   ├── learning_engine.py     # 学习引擎核心 (全量/增量/定时)
│   ├── tools/                 # 内置工具
│   │   └── __init__.py
│   ├── agent/                 # 子代理服务
│   │   ├── __init__.py
│   │   ├── base_agent.py      # Agent 基类 (deepagents)
│   │   ├── models.py          # 代理数据模型
│   │   └── service.py         # 创建/执行/工具装配
│   ├── memory/                # 三级记忆系统
│   │   ├── __init__.py
│   │   ├── Sensory_Memory.py  # 感觉记忆
│   │   ├── Working_Memory.py  # 工作记忆 (Redis TTL)
│   │   ├── Longterm_Memory.py # 长期记忆存储
│   │   ├── memory_service.py  # 上下文组装 + 异步分析触发
│   │   ├── memory_analyzer.py # 记忆分析器 (LLM提取)
│   │   ├── cross_context.py   # 跨上下文记忆集成
│   │   ├── memory_tool.py     # 记忆工具 (Agent可调用)
│   │   └── qdrant_client.py   # Qdrant 向量客户端
│   ├── mcp/                   # MCP 工具系统
│   │   ├── __init__.py
│   │   ├── models.py          # MCP 数据模型
│   │   ├── service.py         # CRUD + 连接构建 (docker/http/sse)
│   │   ├── loader.py          # 工具动态加载
│   │   └── presets.py         # 预置 MCP Server 定义
│   └── skills/                # 技能系统
│       ├── __init__.py
│       ├── models.py          # 技能数据模型
│       └── service.py         # 技能 CRUD
├── docker/                    # Docker 配置
│   ├── Dockerfile.mcp         # MCP 容器镜像
│   └── start-mcp.ps1          # 容器启动脚本
├── model/Qwen3-0.6B/          # 本地轻量模型 (输入预测)
├── pyproject.toml             # 依赖管理 (uv)
├── .env                       # 环境变量配置
└── schema.sql                 # 完整建表脚本
```

---

## 四、快速启动

```bash
# 1. 安装依赖（推荐 uv）
uv sync

# 2. 配置环境变量
cp .env.example .env   # 按需修改

# 3. 启动后端服务（自动初始化数据库 + Redis 检查）
uv run uvicorn main:app --host 0.0.0.0 --port 9111 --reload

# 4. 启动本地 vLLM 预测服务（可选，用于输入预测）
vllm serve D:\Spider_AI\spider_base\model\Qwen3-0.6B --port 8100 --max-model-len 4096 --enforce-eager --gpu-memory-utilization 0.8 --served-model-name Qwen3-0.6B

# 5. 访问 API 文档
# http://localhost:9111/docs
```

---

## 五、环境变量配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | openGauss / PostgreSQL 连接串 | 必填 |
| `SECRET_KEY` | JWT 签名密钥 | 必填 |
| `DASHSCOPE_API_KEY` | 通义千问 API Key | 必填 |
| `DASHSCOPE_BASE_URL` | DashScope 基础 URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `DASHSCOPE_MODEL` | 主模型 | `qwen-plus` |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379` |
| `QDRANT_URL` | Qdrant 向量库地址 | `http://localhost:6333` |
| `QDRANT_COLLECTION` | 向量集合名 | `spider_memory` |
| `PREDICT_MODEL` | 本地预测模型名 | `Qwen3-0.6B` |
| `PREDICT_BASE_URL` | vLLM 预测服务地址 | `http://localhost:8100/v1` |
| `WORKSPACE_SSH_HOST` | 远程工作区地址 | - |
| `WORKSPACE_SSH_USER` | SSH 用户名 | - |
| `MEMORY_WORKING_TTL` | 工作记忆 TTL（秒） | `3600` |
| `MEMORY_ANALYSIS_MODEL` | 记忆分析模型 | - |
| `MEMORY_EMBEDDING_MODEL` | 向量嵌入模型 | - |
| `MEMORY_MAX_CONTEXT_TOKENS` | 最大上下文 Token | - |

---

## 六、API 路由总览

| 前缀 | 标签 | 端点数 | 功能 |
|------|------|--------|------|
| `/auth` | Auth | 6 | 注册、登录、短信登录、获取当前用户 |
| `/sessions` | Sessions | 5 | 会话 CRUD、消息历史 |
| （无前缀） | Chat | 15+ | SSE 流式对话、双答案、输入预测、图片理解 |
| （无前缀） | Dashboard | 1 | 统计数据 |
| （无前缀） | Projects | 20+ | 项目 CRUD、文件操作、代码执行、Agent 对话 |
| （无前缀） | Skills | 4 | 技能 CRUD |
| （无前缀） | MCP | 10+ | MCP 服务器管理（预置/自定义/启用/删除） |
| （无前缀） | SubAgents | 5 | 子代理 CRUD + 任务执行 |
| `/memory` | Memory | 5 | 长期记忆查询、搜索、删除、固定 |
| `/learning` | Learning | 12+ | 学习引擎控制（启动/状态/数据源/会话） |
| `/health` | - | 1 | 健康检查 |

---

## 七、架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (spider_front)                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼────────────────────────────────┐
│              API 层（薄）— 参数校验 / 鉴权                │
│   auth · sessions · chat · projects · mcp · memory ...  │
└────────────────────────┬────────────────────────────────┘
                         │ Depends 注入
┌────────────────────────▼────────────────────────────────┐
│                  服务层（厚）— 核心业务                   │
│  MemoryService · LearningEngine · AgentService · MCP    │
└──┬──────────────┬─────────────┬──────────────┬──────────┘
   │              │             │              │
┌──▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌──────▼─────┐
│openGauss│ │   Redis   │ │   Qdrant  │ │ DashScope  │
│ (主库)  │ │ (会话/限流)│ │ (长期记忆) │ │ vLLM (本地) │
└─────────┘ └───────────┘ └───────────┘ └────────────┘
```

**设计原则**：

- **API 层薄，服务层厚** — 路由只做参数校验、鉴权、调用服务层
- **依赖注入** — DB 会话、当前用户、Redis 通过 FastAPI `Depends` 注入
- **异步优先** — SSE 流式、后台线程记忆分析、并行双答案生成
- **降级容错** — Redis 不可用时回退 DB，外部 API 超时有兜底

---

## 八、核心服务

- **MemoryService**：上下文组装（跨源摘要 + 工作记忆 + 当前输入），异步触发记忆分析
- **LearningEngine**：批量采集对话与项目数据，LLM 分析生成长期记忆，按用户维度跟踪运行状态与进度
- **Agent Service**：创建 / 执行子代理，动态构建 MCP 工具列表（stdio / http / sse），执行任务
- **MCP Service**：预置 / 自定义 MCP Server 管理，Docker 容器连接构建
- **Skills Service**：技能 CRUD，文件格式遵循 StateBackend FileData 结构

---

## 九、MCP 工具容器

MCP Server 通过 Docker 容器以 stdio 协议运行，镜像与启动脚本位于 `docker/` 目录：

- `docker/Dockerfile.mcp` — 通用 MCP 容器镜像
- `docker/start-mcp.ps1` — Windows 容器启动脚本

预置 MCP Server 定义见 [`core/mcp/presets.py`](core/mcp/presets.py)，自定义可通过 `/mcp` API 注册。

---

## 十、数据库

- 使用 **openGauss / PostgreSQL**，通过 `SQLModel` 进行 ORM 映射
- 启动时由 [`core/database.py`](core/database.py) 自动检查并迁移，兼容 openGauss 与 PostgreSQL 语法差异
- 完整建表脚本见 [`schema.sql`](schema.sql)

---

## 十一、健康检查

```bash
curl http://localhost:8000/health
```

返回服务运行状态及关键依赖（DB / Redis / Qdrant）连通性。

---

## License

MIT © Spider.AI Team
