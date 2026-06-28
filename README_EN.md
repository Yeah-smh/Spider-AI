**English** | [中文](./README.md)

<div align="center">

# Spider AI

**Learns while you rest, helps when you need.** — Your neighborhood AI.

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

An AI assistant that **learns on its own**. It thinks while you rest, and it's ready the moment you need it.

Not just a tool — a neighbor who understands you without getting in the way.

## Demo

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

## Capabilities

- **SSE Streaming Chat** — dual-answer parallel generation with live Markdown & KaTeX rendering
- **3-Level Memory** — sensory → working (Redis) → long-term (Qdrant vector retrieval)
- **MCP Hot-Plug Tools** — Dockerized MCP servers, loaded on demand from the capability marketplace
- **Sub-Agent Orchestration** — a supervisor spawns expert agents bound to MCP tools
- **Learning Engine** — full / incremental / scheduled modes with triple-dedup knowledge ingestion
- **Online IDE** — Monaco editor integrated, code-as-context chat, project-level agent collaboration

## Stack

`React 18` · `Vite` · `TailwindCSS` · `FastAPI` · `LangChain` · `SQLModel` · `openGauss` · `Redis` · `Qdrant` · `DashScope` · `vLLM` · `Docker`

## Architecture

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

## Quick Start

> Python ≥ 3.12 · Node.js ≥ 18 · openGauss · Redis · Qdrant

```bash
# Backend
cd spider_base
cp .env.example .env
uv sync
uvicorn main:app --reload --host 0.0.0.0 --port 9111

# Frontend
cd spider_front
npm install
npm run dev          # http://localhost:5173

# MCP Tools (optional)
cd spider_base/docker; .\start-mcp.ps1
```

## Structure

```
Spider_AI/
├── spider_base/      Backend FastAPI service (api · core · docker · main)
├── spider_front/     Frontend React app (components · api · App.jsx)
└── spider_man/       Learning Engine module
```

## Roadmap

- [ ] Proactive scheduled tasks & long-running autonomous projects
- [ ] Audio, video & generative multimodal integration
- [ ] Polish remaining modules & features
- [ ] Optimize data storage & virtualized deployment

## License

MIT © [Spider AI](https://github.com/Yeah-smh/Spider-AI)

<div align="center">

<sub>With great power comes great responsibility.</sub>

</div>
