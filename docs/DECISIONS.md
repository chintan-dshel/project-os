# Architecture Decisions — Project OS

This log shows key decisions made during the build. Strategic direction came from the user; technical execution was done by Claude. This is the collaboration story.

---

## D-001 — Single-app monorepo, two packages
**Decision:** Keep backend (`project-os`) and frontend (`project-os-ui`) as separate packages in one folder, not a true monorepo with workspaces.  
**Rationale:** Simpler for a solo dev. No build orchestration needed. Each runs independently with `npm run dev`.  
**User direction:** "Keep it simple — I don't need microservices."

---

## D-002 — PostgreSQL with raw SQL, no ORM
**Decision:** Use `pg` directly with parameterised queries. No Prisma, no Sequelize.  
**Rationale:** No abstraction overhead. SQL is readable and debuggable. Schema is explicit and version-controlled via migrations.  
**User direction:** User prioritised understanding over convenience.

---

## D-003 — Agent-per-stage architecture
**Decision:** Each project stage has its own agent module (intake, planning, execution, retro) rather than one general agent.  
**Rationale:** Each stage has very different goals, output formats, and validation logic. Separate agents are easier to iterate and tune independently.  
**Outcome:** This decision made the system much more reliable — each agent could be optimised for its specific job.

---

## D-004 — Idempotent migration runner with dollar-quote parser
**Decision:** Build a custom migration runner (`run_migration.js`) instead of using a library like `db-migrate` or `flyway`.  
**Rationale:** Need to support PostgreSQL dollar-quoted strings (`$$...$$`) in DO blocks, which standard splitters break on. Custom runner gives full control.  
**Technical detail:** Extended SQL statement splitter to track `inDollar`/`dollarTag` state alongside `inString` state.

---

## D-005 — Stage gates, not free navigation
**Decision:** Projects move through stages in sequence (intake → planning → execution...). Agents are locked to their stage.  
**Rationale:** Prevents the user from, e.g., trying to do a retro before execution has started. Gates catch errors early with clear messages.  
**User direction:** "I want the app to guide the user, not just let them click anything."

---

## D-006 — Kanban-centric execution workflow
**Decision:** Agent assignment actions (Run/Skip/Review) live directly on Kanban task cards, not just in a separate Agents tab.  
**Rationale:** The board is where execution happens. Requiring navigation to a separate tab creates friction. Agent actions should be where the work is.  
**User direction:** "User just needs to work on the kanban board, tackle tasks one by one."

---

## D-007 — Knowledge Hub with PostgreSQL full-text search
**Decision:** Use `tsvector` + `GIN` index for knowledge search. No embedding infrastructure, no vector DB.  
**Rationale:** Full-text search is sufficient for v1 — the corpus is small and keyword matching covers most use cases. Embeddings would add significant infrastructure cost and complexity.  
**Known limitation:** Stemming mismatches (e.g. "auth" ≠ "authentication"). Acceptable for v1; can upgrade to embeddings later.

---

## D-008 — Workspace as project-scoped file store
**Decision:** Project Workspace is separate from the Documents section (structured reports) and the Knowledge Hub (org-wide).  
**Rationale:** Three distinct jobs: Workspace = freeform working area; Documents = structured output; Knowledge Hub = reusable org knowledge. Merging them would create confusion.  
**User direction:** "When agents execute tasks they also need a place to store and save data."

---

## D-009 — Fire-and-forget agent assignment analysis
**Decision:** After each check-in, assignment analysis runs asynchronously with a 5-minute cooldown (bypassed by manual trigger).  
**Rationale:** The LLM call takes 3–8s. Making the user wait would degrade check-in UX. Frontend does a 6-second delayed re-fetch to pick up results.  
**Tradeoff:** Assignments may not appear instantly after check-in.

---

## D-010 — Agent knowledge injection on first session message only (execution)
**Decision:** Execution Agent fetches Knowledge Hub entries only on the first message of a session, not every turn.  
**Rationale:** Injecting into every message would bloat the context window and increase cost. The founder's behaviour patterns don't change turn-to-turn within a session.

---

## Human-AI Collaboration Summary

| Responsibility | Human (User) | AI (Claude) |
|---------------|--------------|-------------|
| Product vision | ✓ | |
| Feature prioritisation | ✓ | |
| UX decisions | ✓ | |
| Architecture direction | ✓ | |
| Technical implementation | | ✓ |
| Database design | | ✓ |
| Agent prompt engineering | | ✓ |
| Bug diagnosis and fixing | | ✓ |
| Code review | ✓ (approval) | ✓ (wrote) |
| Test execution | Both | Both |
