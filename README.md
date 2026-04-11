# Project OS — AI-Native Project Management for Solo Founders

> An AI project management system where agents handle planning, execution coaching, risk tracking, and retrospectives. Built entirely through human-AI collaboration — the user provided vision and strategy; Claude executed every line of code.

![Stage: Production-ready v1](https://img.shields.io/badge/stage-production--ready-green)
![Stack: Node.js + React + PostgreSQL](https://img.shields.io/badge/stack-Node.js%20%2B%20React%20%2B%20PostgreSQL-blue)
![AI: Claude Sonnet](https://img.shields.io/badge/AI-Claude%20Sonnet-purple)

---

## What is Project OS?

Project OS is a full-stack AI project management platform designed for solo founders. Unlike traditional PM tools, every stage of a project is guided by a dedicated AI agent:

| Stage | Agent | What it does |
|-------|-------|--------------|
| **Intake** | Intake Agent | Converts a rough idea into a complete project brief in 1–2 messages |
| **Planning** | Planning Agent | Generates a phased execution plan with tasks, milestones, and risk assessment |
| **Execution** | Execution Agent | Daily check-in partner — updates the Kanban board from your narrative |
| **Retrospective** | Retro Agent | Runs milestone and ship retros, extracts lessons |

Beyond the core agents, the system includes:

- **Specialist Agents** — coding, research, content, and QA agents that can be auto-assigned to tasks
- **RAID Log** — Risks, Assumptions, Issues, Decisions tracked automatically
- **Knowledge Hub** — Org-wide knowledge base that accumulates across every project. Future agents use it as context.
- **Project Workspace** — Freeform document storage for notes, specs, and agent outputs, with one-click promotion to the Knowledge Hub
- **EVM Analytics** — Earned Value Management charts for project health
- **Agent Registry** — Plug in custom agents with their own system prompts

---

## Demo

See [`docs/USER-MANUAL.md`](docs/USER-MANUAL.md) for a full walkthrough with screenshots.

**Live flow:** Create project → brief agent → plan generated → approve → Kanban board unlocks → daily check-ins → milestone retro → ship retro → Knowledge Hub auto-populated.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js (ESM), Express 4 |
| Database | PostgreSQL (Neon or local) |
| Frontend | React 18, Vite 5, React Router 7 |
| AI | Anthropic Claude API (claude-sonnet-4-5) |
| Migrations | Custom idempotent migration runner |

No ORM. No framework lock-in. Schema lives in `migrations/` and `schema.sql`.

---

## Quick Start

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for full setup.

**TL;DR:**
```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/project-os.git
cd project-os

# 2. Configure backend
cd project-os
cp .env.example .env
# Edit .env: set DATABASE_URL and ANTHROPIC_API_KEY

# 3. Run database migrations
node run_migration.js

# 4. Start backend
npm run dev

# 5. Start frontend (new terminal)
cd ../project-os-ui
npm install && npm run dev

# 6. Open http://localhost:5173
```

---

## Project Structure

```
project-os-app/
├── project-os/              # Express backend
│   ├── migrations/          # 009 idempotent SQL migrations
│   ├── src/
│   │   ├── lib/             # Agent logic (intake, planning, execution, retro, specialist, knowledge)
│   │   ├── routes/          # REST routes
│   │   ├── db/              # Query helpers
│   │   └── middleware/      # Error handling, gates
│   ├── run_migration.js     # Migration runner (handles $$ dollar-quote parsing)
│   └── schema.sql           # Full schema (for reference / fresh install)
│
├── project-os-ui/           # React frontend
│   ├── src/
│   │   ├── views/           # Dashboard, Chat, RAID, Workspace, Knowledge, Docs, Agents...
│   │   ├── components/      # KanbanBoard, SideNav, Chat, StageTimeline...
│   │   ├── hooks/           # useProject (state management)
│   │   └── lib/api.js       # All backend API calls
│   └── vite.config.js       # Dev proxy config
│
├── docs/                    # This documentation
├── schema.sql               # Full PostgreSQL schema
└── setup.bat                # Windows one-click setup & launcher
```

---

## Human-AI Collaboration Story

This project was built as a **portfolio demonstration of AI-assisted development**:

- **The user** provided: product vision, UX decisions, feature priorities, architectural direction
- **Claude** executed: every line of code, database design, agent prompts, bug fixes, QA

Key moments documented in [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [`docs/USER-MANUAL.md`](docs/USER-MANUAL.md) | How to use every feature |
| [`docs/INSTALLATION.md`](docs/INSTALLATION.md) | Local setup guide |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Architecture decisions and rationale |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Build history and future plans |
| [`docs/TEST-CASES.md`](docs/TEST-CASES.md) | UAT scenarios and results |

---

## License

MIT
