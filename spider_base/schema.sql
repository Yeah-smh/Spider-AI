-- =============================================================================
-- 项目名称: Spider_AI - 基于 MCP 的乐于助人好邻居 Agents 系统
-- 文件说明: 数据库建表脚本 (PostgreSQL / openGauss 兼容)
-- 生成日期: 2026-05-21
-- 数据库版本: PostgreSQL 14+ / openGauss 5.0+
-- 字符编码: UTF-8
-- 说明: 本脚本依据 SQLModel 模型定义生成，按外键依赖顺序排列。
--       所有表均使用 IF NOT EXISTS 创建，可重复执行。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 表: users
-- 用途: 用户基础信息表，存储账号、密码哈希、邮箱、手机号等核心身份字段。
--       所有业务数据 (会话、项目、记忆等) 均通过 user_id 与本表关联。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL          PRIMARY KEY,                              -- 用户主键，自增
    username        VARCHAR(50)     NOT NULL UNIQUE,                          -- 用户名，全局唯一
    password_hash   TEXT            DEFAULT NULL,                             -- 密码哈希值
    email           VARCHAR(100)    DEFAULT NULL,                             -- 邮箱地址
    phone           VARCHAR(20)     DEFAULT NULL UNIQUE,                      -- 手机号，全局唯一
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP -- 创建时间 (UTC)
);

-- -----------------------------------------------------------------------------
-- 表: chat_sessions
-- 用途: 聊天会话表，记录用户与主 Agent 的对话会话元信息。
--       使用 UUID 作为主键，便于前后端无状态生成。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          VARCHAR(36)     PRIMARY KEY,                                  -- 会话 ID (UUID 字符串)
    user_id     INTEGER         NOT NULL,                                     -- 所属用户 ID
    title       VARCHAR(200)    NOT NULL DEFAULT 'New Chat',                  -- 会话标题
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
    CONSTRAINT fk_chat_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: messages
-- 用途: 主聊天消息表，存储每条用户/助手消息的内容、token 统计与多模态附件。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
    id              SERIAL          PRIMARY KEY,                              -- 消息主键
    session_id      VARCHAR(36)     NOT NULL,                                 -- 所属会话 ID
    role            VARCHAR(20)     NOT NULL,                                 -- 角色: user / assistant
    content         TEXT            NOT NULL,                                 -- 消息内容
    token_count     INTEGER         NOT NULL DEFAULT 0,                       -- 兼容旧字段，token 计数
    input_tokens    INTEGER         NOT NULL DEFAULT 0,                       -- 输入 token 数
    output_tokens   INTEGER         NOT NULL DEFAULT 0,                       -- 输出 token 数
    total_tokens    INTEGER         NOT NULL DEFAULT 0,                       -- 总 token 数
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    images          TEXT            DEFAULT NULL,                             -- 图片附件 JSON 数组 (base64 data URL)
    CONSTRAINT fk_messages_session
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: projects
-- 用途: 项目表，承载用户在工作区内创建的独立项目空间。
--       Skills / MCP Servers / SubAgents 可在项目维度内私有化绑定。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id          SERIAL          PRIMARY KEY,                                  -- 项目主键
    user_id     INTEGER         NOT NULL,                                     -- 所属用户 ID
    name        VARCHAR(200)    NOT NULL,                                     -- 项目名称
    description TEXT            DEFAULT NULL,                                 -- 项目描述
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
    CONSTRAINT fk_projects_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: project_chat_messages
-- 用途: 项目级聊天消息表，与 messages 区分，按项目隔离记录对话历史。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_chat_messages (
    id          SERIAL          PRIMARY KEY,                                  -- 消息主键
    project_id  INTEGER         NOT NULL,                                     -- 所属项目 ID
    user_id     INTEGER         NOT NULL,                                     -- 所属用户 ID
    session_id  VARCHAR(36)     NOT NULL,                                     -- 会话 ID (UUID)
    role        VARCHAR(20)     NOT NULL,                                     -- 角色: user / assistant
    content     TEXT            NOT NULL DEFAULT '',                          -- 消息内容
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    CONSTRAINT fk_project_chat_messages_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_chat_messages_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: longterm_memories
-- 用途: 长期记忆表，存储用户偏好、知识、决策、经验类记忆条目。
--       与向量库 (Qdrant) 协同：本表存原文与元数据，向量库存 embedding。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS longterm_memories (
    id                  SERIAL          PRIMARY KEY,                          -- 记忆主键
    user_id             INTEGER         NOT NULL,                             -- 所属用户 ID
    type                VARCHAR(30)     NOT NULL,                             -- 类型: preference/knowledge/decision/experience
    title               VARCHAR(200)    NOT NULL,                             -- 标题
    content             TEXT            NOT NULL,                             -- 完整内容
    summary             TEXT            DEFAULT NULL,                         -- 摘要
    importance          INTEGER         NOT NULL DEFAULT 5,                   -- 重要度 (1-10)
    source              VARCHAR(20)     NOT NULL DEFAULT 'auto',              -- 来源: auto/user/system
    access_count        INTEGER         NOT NULL DEFAULT 0,                   -- 被访问次数
    last_accessed_at    TIMESTAMP WITH TIME ZONE DEFAULT NULL,                -- 最近访问时间
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    CONSTRAINT fk_longterm_memories_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: learning_sessions
-- 用途: 学习引擎会话表，记录每一次记忆学习/抽取任务的执行情况与统计信息。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS learning_sessions (
    id                  SERIAL          PRIMARY KEY,                          -- 学习会话主键
    user_id             INTEGER         NOT NULL,                             -- 所属用户 ID
    start_time          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 开始时间
    end_time            TIMESTAMP WITH TIME ZONE DEFAULT NULL,                -- 结束时间
    duration_seconds    INTEGER         DEFAULT NULL,                         -- 耗时 (秒)
    data_processed      INTEGER         NOT NULL DEFAULT 0,                   -- 已处理的数据源数
    memories_generated  INTEGER         NOT NULL DEFAULT 0,                   -- 生成的记忆数
    status              VARCHAR(20)     NOT NULL DEFAULT 'running',           -- 状态: running/completed/failed
    mode                VARCHAR(20)     NOT NULL DEFAULT 'incremental',       -- 模式: full/incremental
    CONSTRAINT fk_learning_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: skills
-- 用途: 技能表，存储 SKILL.md 格式的可复用技能定义，支持公共与私有共存。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id          SERIAL          PRIMARY KEY,                                  -- 技能主键
    user_id     INTEGER         NOT NULL,                                     -- 所属用户 ID
    project_id  INTEGER         DEFAULT NULL,                                 -- 所属项目 ID (可空：用户级技能)
    name        VARCHAR(100)    NOT NULL,                                     -- 技能标识 (kebab-case)
    description TEXT            NOT NULL DEFAULT '',                          -- 简短描述
    content     TEXT            NOT NULL,                                     -- SKILL.md 完整内容
    is_public   BOOLEAN         NOT NULL DEFAULT FALSE,                       -- 是否公共
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 创建时间
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- 更新时间
    CONSTRAINT fk_skills_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_skills_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: mcp_servers
-- 用途: MCP Server 配置表，统一管理 stdio / http 两种传输方式的服务接入。
--       支持预置公共服务 (is_public=true) 与用户自定义服务共存。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mcp_servers (
    id              SERIAL          PRIMARY KEY,                              -- MCP Server 主键
    user_id         INTEGER         NOT NULL,                                 -- 所属用户 ID
    project_id      INTEGER         DEFAULT NULL,                             -- 所属项目 ID (可空)
    name            VARCHAR(100)    NOT NULL,                                 -- 唯一标识 (如 github / filesystem)
    display_name    VARCHAR(200)    NOT NULL,                                 -- 显示名称
    description     TEXT            NOT NULL DEFAULT '',                      -- 描述
    transport       VARCHAR(20)     NOT NULL DEFAULT 'stdio',                 -- 传输方式: stdio | http
    command         TEXT            DEFAULT NULL,                             -- stdio 启动命令: npx/python/uvx
    args            TEXT            DEFAULT NULL,                             -- stdio 参数 (JSON 数组字符串)
    env             TEXT            DEFAULT NULL,                             -- 环境变量 (JSON 对象字符串)
    url             TEXT            DEFAULT NULL,                             -- http 服务 URL
    headers         TEXT            DEFAULT NULL,                             -- http 请求头 (JSON 对象字符串)
    is_enabled      BOOLEAN         NOT NULL DEFAULT TRUE,                    -- 是否启用
    is_public       BOOLEAN         NOT NULL DEFAULT FALSE,                   -- 是否预置公共 Server
    source          VARCHAR(20)     NOT NULL DEFAULT 'custom',                -- 来源: preset | custom
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    CONSTRAINT fk_mcp_servers_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_mcp_servers_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- 表: sub_agents
-- 用途: 子代理 (SubAgent) 配置表，定义专业化子 Agent 及其绑定的 MCP Server 集合。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sub_agents (
    id              SERIAL          PRIMARY KEY,                              -- 子代理主键
    user_id         INTEGER         NOT NULL,                                 -- 所属用户 ID
    project_id      INTEGER         DEFAULT NULL,                             -- 所属项目 ID (可空)
    name            VARCHAR(100)    NOT NULL,                                 -- 子代理标识 (kebab-case)
    display_name    VARCHAR(200)    NOT NULL,                                 -- 显示名称
    description     TEXT            NOT NULL DEFAULT '',                      -- 描述
    system_prompt   TEXT            NOT NULL DEFAULT '',                      -- 子代理系统提示词
    mcp_server_ids  TEXT            NOT NULL DEFAULT '[]',                    -- 绑定的 MCP Server ID 列表 (JSON 数组)
    is_enabled      BOOLEAN         NOT NULL DEFAULT TRUE,                    -- 是否启用
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 创建时间
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- 更新时间
    CONSTRAINT fk_sub_agents_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_agents_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- =============================================================================
-- 索引创建 (从模型 index=True 字段提取)
-- 说明: UNIQUE 约束已在表定义中创建对应索引，此处仅创建非唯一普通索引。
-- =============================================================================

-- users 表: username / phone 已由 UNIQUE 约束自动建立索引

-- chat_sessions 表
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- messages 表
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- projects 表
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- project_chat_messages 表
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_project_id ON project_chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_user_id    ON project_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_project_chat_messages_session_id ON project_chat_messages(session_id);

-- longterm_memories 表
CREATE INDEX IF NOT EXISTS idx_longterm_memories_user_id ON longterm_memories(user_id);

-- learning_sessions 表
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_id ON learning_sessions(user_id);

-- skills 表
CREATE INDEX IF NOT EXISTS idx_skills_user_id    ON skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_project_id ON skills(project_id);

-- mcp_servers 表
CREATE INDEX IF NOT EXISTS idx_mcp_servers_user_id    ON mcp_servers(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_project_id ON mcp_servers(project_id);

-- sub_agents 表
CREATE INDEX IF NOT EXISTS idx_sub_agents_user_id    ON sub_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_agents_project_id ON sub_agents(project_id);

-- =============================================================================
-- 建表脚本结束
-- =============================================================================

-- ============================================================
-- 二、DML 数据操作语句（Data Manipulation Language）
-- 系统运行时典型的增删改查操作
-- ============================================================

-- ---------- 用户认证模块 ----------

-- 注册新用户（密码经bcrypt哈希后存储）
INSERT INTO users (username, password_hash, email)
VALUES ('testuser01', '$2b$12$LJ3XrQ9zKp7Ym1WfAbCdEf...', 'test@example.com');

-- 用户名登录查询
SELECT * FROM users WHERE username = 'testuser01';

-- 手机号登录/注册查询
SELECT * FROM users WHERE phone = '13800138001';

-- ---------- 会话管理模块 ----------

-- 创建新会话
INSERT INTO chat_sessions (id, user_id, title)
VALUES ('uuid-xxx', 1, 'New Chat');

-- 获取用户所有会话（按更新时间倒序）
SELECT * FROM chat_sessions WHERE user_id = 1 ORDER BY updated_at DESC;

-- 重命名会话
UPDATE chat_sessions SET title = '讨论Python', updated_at = CURRENT_TIMESTAMP
WHERE id = 'uuid-xxx' AND user_id = 1;

-- 删除会话（级联删除消息）
DELETE FROM messages WHERE session_id = 'uuid-xxx';
DELETE FROM chat_sessions WHERE id = 'uuid-xxx';

-- ---------- 智能对话模块 ----------

-- 存储用户消息
INSERT INTO messages (session_id, role, content, token_count, input_tokens, output_tokens, total_tokens)
VALUES ('uuid-xxx', 'user', '请介绍Python的GIL机制', 0, 0, 0, 0);

-- 存储AI回复（含token用量）
INSERT INTO messages (session_id, role, content, token_count, input_tokens, output_tokens, total_tokens)
VALUES ('uuid-xxx', 'assistant', 'GIL是...', 500, 100, 400, 500);

-- 加载会话历史消息（按时间正序）
SELECT * FROM messages WHERE session_id = 'uuid-xxx' ORDER BY created_at ASC;

-- ---------- 记忆管理模块 ----------

-- 写入长期记忆（MemoryAnalyzer提取后）
INSERT INTO longterm_memories (user_id, type, title, content, importance, source)
VALUES (1, 'preference', '编辑器偏好', '用户习惯使用VS Code编写Python代码', 7, 'auto');

-- 按用户查询所有记忆
SELECT * FROM longterm_memories WHERE user_id = 1 ORDER BY created_at DESC;

-- 按类型筛选记忆
SELECT * FROM longterm_memories WHERE user_id = 1 AND type = 'knowledge';

-- 更新记忆访问计数（被检索时）
UPDATE longterm_memories SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP
WHERE id = 42;

-- 删除记忆（需同步删除Qdrant向量）
DELETE FROM longterm_memories WHERE id = 42 AND user_id = 1;

-- ---------- 学习引擎模块 ----------

-- 创建学习会话
INSERT INTO learning_sessions (user_id, mode, status)
VALUES (1, 'full', 'running');

-- 更新学习进度
UPDATE learning_sessions SET data_processed = 50, memories_generated = 12
WHERE id = 1;

-- 学习完成
UPDATE learning_sessions SET status = 'completed', end_time = CURRENT_TIMESTAMP,
    duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))::INTEGER
WHERE id = 1;

-- Incremental模式：查询上次学习结束时间作为增量基线
SELECT end_time FROM learning_sessions
WHERE user_id = 1 AND status = 'completed'
ORDER BY end_time DESC LIMIT 1;

-- ---------- 项目管理模块 ----------

-- 创建项目
INSERT INTO projects (user_id, name, description)
VALUES (1, 'demo-project', '猜数字游戏');

-- 项目内AI对话消息持久化
INSERT INTO project_chat_messages (project_id, user_id, session_id, role, content)
VALUES (1, 1, 'proj-session-uuid', 'user', '帮我写一个猜数字游戏');

-- 删除项目（需先级联删除子表）
DELETE FROM project_chat_messages WHERE project_id = 1;
DELETE FROM sub_agents WHERE project_id = 1;
DELETE FROM mcp_servers WHERE project_id = 1;
DELETE FROM skills WHERE project_id = 1;
DELETE FROM projects WHERE id = 1;

-- ---------- MCP工具管理模块 ----------

-- 启用预置MCP Server
INSERT INTO mcp_servers (user_id, name, display_name, description, transport, command, args, is_enabled, is_public, source)
VALUES (1, 'github', 'GitHub', '操作GitHub仓库', 'stdio',
    'npx', '["-y", "@modelcontextprotocol/server-github"]',
    TRUE, TRUE, 'preset');

-- 查询用户可用的MCP Server（含公共预置 + 项目级）
SELECT * FROM mcp_servers
WHERE user_id = 1 AND (project_id IS NULL OR project_id = 1);

-- ---------- 子代理模块 ----------

-- 主Agent创建子代理
INSERT INTO sub_agents (user_id, project_id, name, display_name, description, system_prompt, mcp_server_ids)
VALUES (1, 1, 'game-developer', '游戏开发者', '负责编写游戏逻辑代码',
    '你是一个专业的游戏开发者...', '[1, 3]');

-- 查询项目下的子代理
SELECT * FROM sub_agents WHERE user_id = 1 AND (project_id IS NULL OR project_id = 1);

-- ---------- 技能模块 ----------

-- 创建技能
INSERT INTO skills (user_id, project_id, name, description, content, is_public)
VALUES (1, 1, 'code-review', '代码审查', '# Code Review Skill\n...', FALSE);

-- 查询可用技能（用户自己的 + 公共的 + 当前项目的）
SELECT * FROM skills
WHERE user_id = 1 OR is_public = TRUE OR project_id = 1;
