# User Manual — Project OS

## Overview

Project OS guides a solo founder through their entire project lifecycle using AI agents. Each stage has a dedicated agent. You work conversationally — the system updates the board, logs risks, and builds your knowledge base automatically.

---

## Navigation

The sidebar has four sections:

| Section | Items |
|---------|-------|
| **NOW** | Context-aware — shows the action most relevant right now |
| **PROJECT** | Brief · Kanban · Workspace · RAID Log · Agents · Documents |
| **ANALYTICS** | EVM Analytics · Knowledge Hub |
| **SETTINGS** | Agent Marketplace |

---

## Stage 1 — Intake

**Goal:** Turn your idea into a structured project brief.

1. Click **+ New project** on the home screen
2. The Intake Agent opens in the chat panel
3. Describe your idea in plain English — the agent asks at most one clarifying question
4. The agent produces a full brief: one-liner, success criteria, scope (in/out), constraints, risks
5. Once the brief is confirmed the project advances to **Planning**

**What gets created:**
- Project record with all brief fields
- Risk register seeded with early assumption risks

---

## Stage 2 — Planning

**Goal:** Get a full execution plan you can approve and start.

1. The Planning Agent automatically generates a plan on first message
2. Review: phases, milestones, tasks, estimated hours, methodology
3. Any scope warnings are surfaced upfront (e.g. "you have 60h but plan needs 90h")
4. Say "approve" or "looks good" to lock it in
5. Project advances to **awaiting approval**

**What gets created:**
- Phases → Milestones → Tasks in the database
- Risks from the plan seeded into the RAID log
- Past learnings from the Knowledge Hub are injected into the agent's context

---

## Stage 3 — Execution

**Goal:** Ship the plan, one check-in at a time.

### Daily check-in
1. Open the **Chat** panel (sidebar: "Check in" button)
2. Tell the Execution Agent what you worked on: "I finished the login flow and started on the dashboard"
3. The agent probes for completeness — only marks tasks "done" if you describe a concrete output
4. The Kanban board updates automatically
5. Every response ends with a **→ Next:** action

### Kanban board
- Drag tasks between **To Do / In Progress / Done / Blocked**
- Click any task card to expand it — log hours, add notes, view agent assignment
- Agent-assigned tasks show a badge with the agent name

### Auto-assignment
After each check-in, the system analyses all tasks and assigns suitable agents:
- `coding` — implementation tasks
- `research` — investigation tasks
- `content` — writing tasks
- `qa` — review tasks

Review assignments in the **Agents** view. Run them directly from the task card (▶ Run) or from the Agents tab.

### Risk management (RAID Log)
The execution agent flags risks in every check-in. View them in **RAID Log**:
- High risks (score 7–9) shown in red — need attention
- Materialise a risk → it becomes an issue → create a decision or action task
- All decisions auto-populate the **Knowledge Hub**

---

## Stage 4 — Milestone Retro

**Goal:** Debrief before starting the next milestone.

Triggered automatically when all tasks in a milestone are done.

The Retro Agent asks three questions:
1. What did you actually deliver?
2. What created friction?
3. What would you change on the next milestone?

After answering, the board unlocks for the next milestone. The answers are automatically saved to the **Knowledge Hub** as lessons learned.

---

## Stage 5 — Ship Retro

**Goal:** Final debrief — what you built, what you learned, what goes in v2.

Five questions:
1. What did you actually build?
2. Did you hit your success criteria?
3. What slowed you down most?
4. What did you learn about yourself as a builder?
5. What's going in the v2 backlog?

After the retro, the project is marked **complete** and all outputs are saved.

---

## Workspace

Every project has a **Workspace** — a freeform document store.

**Creating docs:**
- Click **+ New doc** in the Workspace view
- Types: Note, Research, Spec, Code, Report, Reference
- Notes auto-save as you type (1.2s debounce)

**Agent outputs:**
- When a specialist agent completes a task, its output is saved here automatically
- Agent docs are read-only but can be promoted to the Knowledge Hub

**Promoting to Knowledge Hub:**
- Any doc can be sent to the Knowledge Hub with one click: **◈ Save to Knowledge Hub**
- Choose the knowledge type (Lesson Learned, Decision, etc.)

---

## Knowledge Hub

The Knowledge Hub is your organisation's growing brain.

**What gets added automatically:**
- Retro answers (what worked, friction points, what to change)
- Decisions from the RAID log
- Any workspace doc you promote

**Browsing:**
- Filter by type: Lessons · Friction Points · Decisions · Risk Insights · Knowledge
- Search across all entries with full-text search
- Entries show which project they came from

**How agents use it:**
- Planning Agent: fetches top-5 relevant entries when building a new plan
- Execution Agent: fetches top-4 relevant entries on first check-in of each session
- Entries appear in the "PAST LEARNINGS" section of the agent's context

---

## Documents

Structured project documents, auto-assembled from what's already in the DB:

| Document | Available when |
|----------|---------------|
| Project Charter | Any stage |
| Execution Plan | After planning |
| Risk Register | Any stage |
| Decision Log | Any stage |
| Retro Report | After first retro |

**AI-generated reports:**
- Milestone Report — detailed progress summary with task breakdown
- Close Report — final project analysis with lessons and v2 opportunities

---

## Agent Marketplace

The **Marketplace** (Settings → Marketplace) shows available specialist agents. Toggle any agent on/off. Custom agents can be added via the Agent Registry API.

Pre-built agents include: coding, research, content, QA, DB schema, API design, testing, DevOps, security, UX, SEO, and analytics.

---

## EVM Analytics

Earned Value Management charts show project health:
- Planned Value (PV) vs Actual Cost (AC) vs Earned Value (EV)
- Schedule Performance Index (SPI) and Cost Performance Index (CPI)
- Forecast at Completion (EAC)
