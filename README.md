[English](./README_EN.md) | **中文**

<div align="center">

# Spider AI

**平凡学习，非凡帮助** — 你的好邻居 AI

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

一个会**自主学习**的 AI 助手。当你休息时它在思考，当你需要时它早已就位。

不止是工具，更像一位懂你不打扰的好邻居。

## 演示

<table>
<tr>
<td><video src="https://github.com/user-attachments/assets/3457436b-6ded-4c2d-97c6-9b39581ed60e" width="100%"></video></td>
<td><video src="https://github.com/user-attachments/assets/2f4e1374-799e-411e-b523-a2d5555df6dc" width="100%"></video></td>
</tr>
<tr>
<td><video src="https://github.com/user-attachments/assets/25b5813c-2f58-45f3-a7d3-bc9fbebdb09a" width="100%"></video></td>
<td><video src="https://github.com/user-attachments/assets/d5eda935-7de0-44a2-be84-263c71a001f6" width="100%"></video></td>
</tr>
</table>

## 核心能力

- **SSE 流式对话** —— 双答案并行生成，Markdown 与 KaTeX 实时渲染
- **三级记忆系统** —— 感觉 → 工作（Redis）→ 长期（Qdrant 向量检索）
- **MCP 工具热插拔** —— Docker 化 MCP Server，能力市场按需加载
- **子代理编排** —— Supervisor 动态派遣专家代理，绑定工具完成复杂任务
- **学习引擎** —— 全量 / 增量 / 定时三模式，三重去重沉淀长期知识
- **在线 IDE** —— Monaco 编辑器集成，代码即对话，项目级 Agent 协作

## 技术栈

`React 18` · `Vite` · `TailwindCSS` · `FastAPI` · `LangChain` · `SQLModel` · `openGauss` · `Redis` · `Qdrant` · `DashScope` · `vLLM` · `Docker`

## 架构

```
        Frontend  (React · Vite · Tailwind)
               │
        API Gateway  (FastAPI)
  Auth · Chat(SSE) · Memory · Learn · MCP · Agents
               │
     ┌─────────┼──────────┐
     ▼         ▼          ▼
 openGauss   Redis     Qdrant
               │
   Inference: DashScope  +  Local vLLM
```

## 快速启动

> Python ≥ 3.12 · Node.js ≥ 18 · openGauss · Redis · Qdrant

```bash
# 后端
cd spider_base
cp .env.example .env
uv sync
uvicorn main:app --reload --host 0.0.0.0 --port 9111

# 前端
cd spider_front
npm install
npm run dev          # http://localhost:5173

# MCP 工具（可选）
cd spider_base/docker; .\start-mcp.ps1
```

## 项目结构

```
Spider_AI/
├── spider_base/      后端 FastAPI 服务（api · core · docker · main）
├── spider_front/     前端 React 应用（components · api · App.jsx）
└── spider_man/       学习引擎模块
```

## Roadmap

- [ ] 主动定时任务与长期自主执行项目
- [ ] 音视频与生成式多模态集成
- [ ] 完善剩余模块与功能
- [ ] 优化数据存储与虚拟化部署
- [ ] 补全README文档和vllm部署等环境的使用

## License

MIT © [Spider AI](https://github.com/Yeah-smh/Spider-AI)

<div align="center">

<sub>能力越大，责任越大。</sub>

</div>
