# Spider AI - 前端

> Spider.AI 好邻居智能助手前端应用，基于 React 18 + Vite + TailwindCSS 构建。

## 核心特性

| 模块 | 说明 |
|------|------|
| **智能对话** | SSE 流式渲染 + 双答案并行模式 + Markdown/KaTeX 实时渲染 |
| **输入预测** | 蜘蛛感应（SpiderSense），本地 vLLM 驱动，自适应防抖 + 反馈机制 |
| **项目 IDE** | Monaco Editor 集成，代码选中附加对话，项目级子 Agent 协作 |
| **控制台** | Dashboard / Agents / Tools & Skills / Learning / Memory / Settings |
| **工作流画布** | 节点拖拽编排，拓扑执行引擎，模板库 |
| **认证系统** | JWT + 短信登录 + 路由守卫 + 登录态持久化 |
| **多模态交互** | 图片粘贴上传、语音按钮（待接入）、拖拽文件 |
| **主题系统** | 深色/浅色/系统 + 视频背景模式 + 蜘蛛侠品牌色 |

## 技术栈

- **框架**: React 18 (函数组件 + Hooks)
- **构建**: Vite 5
- **样式**: TailwindCSS + 毛玻璃效果 + 自定义主题
- **编辑器**: Monaco Editor (@monaco-editor/react)
- **图标**: Lucide React
- **HTTP**: Axios (REST) + fetch (SSE)
- **路由**: React Router v6 (嵌套路由 + 路由守卫)
- **状态**: React Context + localStorage 持久化
- **数学公式**: KaTeX

## 项目结构

```
spider_front/
├── src/
│   ├── api/
│   │   └── chat.js                # 统一 API 封装 (REST + SSE)
│   ├── components/
│   │   ├── ChatPage.jsx           # 聊天主页面 (SSE流式/双答案/预测/会话管理)
│   │   ├── ChatInterface.jsx      # 对话界面容器
│   │   ├── Message.jsx            # 消息气泡组件
│   │   ├── MarkdownRenderer.jsx   # 静态 Markdown 渲染
│   │   ├── StreamingMarkdownRenderer.jsx  # 流式增量渲染
│   │   ├── SpiderSense.jsx        # 输入预测建议
│   │   ├── Header.jsx             # 顶部导航
│   │   ├── Sidebar.jsx            # 侧边栏 (会话列表)
│   │   ├── LoginPage.jsx          # 登录/注册
│   │   ├── WelcomePage.jsx        # 欢迎页 (视频背景)
│   │   ├── WorkflowCanvas.jsx     # 工作流画布
│   │   ├── ProtectedRoute.jsx     # 路由守卫
│   │   ├── SpiderLogo.jsx         # Logo 组件
│   │   └── console/               # 控制台模块
│   │       ├── ConsoleLayout.jsx      # 控制台布局 + 侧边栏
│   │       ├── DashboardPage.jsx      # 仪表板
│   │       ├── AgentsPage.jsx         # 子代理管理
│   │       ├── ToolsSkillsPage.jsx    # MCP工具 + 技能
│   │       ├── ProjectsPage.jsx       # 项目 IDE (Monaco + Agent)
│   │       ├── LearningPage.jsx       # 学习引擎
│   │       ├── MemoryPage.jsx         # 记忆管理
│   │       └── SettingsPage.jsx       # 系统设置
│   ├── contexts/
│   │   └── AuthContext.jsx        # 认证上下文 (JWT/SMS/持久化)
│   ├── config/
│   │   └── theme.js               # 主题常量
│   ├── utils/
│   │   └── date.js                # 时间格式化
│   ├── App.jsx                    # 路由配置入口
│   ├── main.jsx                   # 应用入口
│   └── index.css                  # 全局样式 + TailwindCSS
├── public/                        # 静态资源 (SVG/Icon)
├── index.html                     # HTML 模板
├── vite.config.js                 # Vite 配置 + API 代理
├── tailwind.config.js             # TailwindCSS 主题扩展
├── package.json                   # 依赖管理
└── postcss.config.js              # PostCSS 配置
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (自动代理 /api → localhost:9111)
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview
```

开发服务器默认运行在 `http://localhost:5173`

## 路由结构

```
/                   → WelcomePage (公开)
/login              → LoginPage (公开)
/chat               → ChatPage (受保护)
/projects           → ProjectsPage (受保护)
/console            → ConsoleLayout (受保护, 嵌套路由)
  ├── /             → DashboardPage
  ├── /agents       → AgentsPage
  ├── /tools        → ToolsSkillsPage
  ├── /learning     → LearningPage
  ├── /memory       → MemoryPage
  └── /settings     → SettingsPage
```

路由守卫：未登录访问受保护路由会重定向到 `/login`，登录后自动跳回原目标。

## API 代理配置

```javascript
// vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:9111',  // 后端 FastAPI
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:9111',
      ws: true,
    }
  }
}
```

## 核心接口

### SSE 流式对话
- `POST /api/chat` — SSE 流式回复 (event: content/done/error)
- `POST /api/chat/predict` — 输入预测 SSE (event: token/done)
- `POST /api/chat/dual` — 双答案模式 SSE

### 会话管理
- `GET /api/sessions` — 会话列表
- `POST /api/sessions` — 创建会话
- `DELETE /api/sessions/:id` — 删除会话
- `PATCH /api/sessions/:id` — 重命名会话

### 项目
- `POST /api/projects/:id/chat` — 项目对话 SSE
- `GET /api/projects/:id/files` — 文件树

### 认证
- `POST /api/auth/login` — 账号密码登录
- `POST /api/auth/sms-login` — 短信登录
- `GET /api/auth/me` — 获取当前用户

## 开发规范

- **组件**: 函数组件 + Hooks，文件名 PascalCase
- **状态**: 局部 useState，跨组件 Context，持久化 localStorage
- **样式**: TailwindCSS 工具类优先，自定义样式写入 index.css
- **通信**: Props 向下传递，回调向上传递
- **SSE**: 使用 fetch + ReadableStream，支持 AbortController 中断
- **快捷键**: Enter 发送 / Shift+Enter 换行 / Ctrl+K 搜索 / Ctrl+Shift+L 代码附加

## 生产部署

```bash
npm run build
# 产物在 dist/ 目录，部署到 Nginx 或由后端 FastAPI 提供静态文件服务
```

Nginx 配置要点：
- SPA 路由: `try_files $uri $uri/ /index.html`
- API 代理: `location /api { proxy_pass http://backend:9111; }`
- 静态缓存: JS/CSS 设置长期缓存 + immutable

## 浏览器支持

Chrome >= 90 | Firefox >= 88 | Safari >= 14 | Edge >= 90

## License

MIT
