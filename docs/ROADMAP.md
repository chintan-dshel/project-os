# Build Roadmap — Project OS

Chronological record of what was built and when. Shows the evolution from idea to production-ready system.

---

## Phase 1 — Core Agent Loop (March 2026)

**Goal:** Get the basic intake → plan → execute cycle working end-to-end.

| Milestone | What was built |
|-----------|---------------|
| Schema v1 | Projects, phases, milestones, tasks, conversations tables |
| Intake Agent | Brief extraction, success criteria, scope definition |
| Planning Agent | Phased execution plan with task breakdown and risk detection |
| Execution Agent | Daily check-in, task status inference, momentum scoring |
| React Frontend | Project shell, chat panel, basic Kanban board |

**Key technical challenge:** Getting agents to output structured JSON reliably. Solved with retry logic and a correction message on validation failure.

---

## Phase 2 — RAID Log + Retros (March–April 2026)

**Goal:** Close the project lifecycle loop with retros and structured risk management.

| Milestone | What was built |
|-----------|---------------|
| RAID Log | Risk register, assumptions, issues, decisions, actions |
| Retro Agent | Milestone retro (3 questions) and ship retro (5 questions) |
| Stage gates | Middleware preventing invalid stage transitions |
| EVM Analytics | Planned Value / Earned Value / Actual Cost charts |
| V2 Backlog | Ship retro harvests out-of-scope items into a backlog |

**Key decision:** Agent-per-stage architecture (D-003) — separating agents by lifecycle stage made each one more focused and reliable.

---

## Phase 3 — Specialist Agents + Agent Registry (April 2026)

**Goal:** Let agents do actual work, not just advise.

| Milestone | What was built |
|-----------|---------------|
| Specialist agents | Coding, Research, Content, QA types |
| Agent Registry | Custom agent marketplace with configurable system prompts |
| 12 pre-built agents | DB schema, API design, testing, DevOps, security, UX, SEO, analytics |
| Assignment analysis | Auto-assigns tasks to best-fit agents after check-ins |
| Agents view | Review assignments, run agents, see outputs |

**Key decision:** Fire-and-forget assignment analysis (D-009) — async so check-ins stay fast.

---

## Phase 4 — Kanban-Centric Workflow (April 2026)

**Goal:** Make the board the single workspace — no context-switching to run agents.

| Milestone | What was built |
|-----------|---------------|
| Inline agent actions | Run/Skip/Review agent assignments directly on task cards |
| Assignment badges | Task cards show which agent is assigned |
| Stage-aware empty states | Board shows step-by-step guidance before plan is generated |
| Guided stage cards | Dashboard shows the next action for every project stage |
| Action strips | Compact inline prompts replace full-page cards for execution stages |

**Key technical work:** Threading `onRunAgent`/`onSkipAgent`/`onViewAgents` props through 5 component levels (KanbanBoard → PhaseGroup → MilestoneBoard → KanbanColumn → TaskCard).

---

## Phase 5 — Knowledge Hub + Project Workspace (April 2026)

**Goal:** Make execution knowledge reusable across projects.

| Milestone | What was built |
|-----------|---------------|
| Knowledge Hub (migration 008) | `knowledge_entries` table with full-text search |
| Auto-populate from retros | Retro answers → knowledge entries automatically |
| Auto-populate from decisions | RAID decision log → knowledge entries |
| Agent injection | Planning + Execution agents receive top-N relevant entries as context |
| Knowledge Hub UI | Searchable, filterable, grouped by type, with manual entry |
| Project Workspace (migration 009) | `workspace_docs` table — user notes + agent outputs |
| Agent output saving | Specialist agents auto-save to workspace on completion |
| Promote to Knowledge Hub | One-click promotion from any workspace doc |
| Workspace UI | Master-detail layout, auto-save, type filters |

---

## What's next (v2 ideas)

- **Embeddings-based knowledge search** — semantic matching beyond keyword overlap
- **Project templates** — start from a pre-built plan for common project types
- **Multi-project dashboard** — momentum scores and risks across all active projects
- **Webhook integrations** — GitHub PR → task auto-update, Stripe event → risk card
- **Team mode** — assign tasks to named people, not just self
- **Mobile check-in** — lightweight PWA for quick status updates
