# Test Cases — Project OS

UAT scenarios and results. All tests verified on the production build.

---

## TC-01 — New Project Creation

**Precondition:** App running, project list page open.  
**Steps:**
1. Click "+ New project"
2. Verify app navigates to new project with stage = `intake`
3. Verify sidebar NOW section shows "Chat with Intake Agent"
4. Verify center screen shows Step 1 guided card with Intake Agent button
5. Verify chat panel does NOT show "Planning Agent" (regression bug from earlier, now fixed)

**Expected:** Stage badge shows "intake", guided card present, no wrong agent shown.  
**Status:** ✅ PASS

---

## TC-02 — Intake to Planning Transition

**Steps:**
1. Chat with Intake Agent, describe a project
2. Answer the clarifying question (if asked)
3. Verify brief is extracted (success criteria, scope, constraints visible in Brief view)
4. Verify stage advances to `planning`
5. Verify Planning Agent sends first message automatically

**Expected:** Brief populated, stage = planning, Planning Agent intro message present.  
**Status:** ✅ PASS

---

## TC-03 — Plan Approval and Kanban Unlock

**Steps:**
1. In planning stage, Planning Agent generates plan
2. Say "approve"
3. Verify stage advances to `awaiting_approval`
4. Click "Approve plan" in the dashboard
5. Verify Kanban board populates with phases/milestones/tasks
6. Verify stage advances to `execution`
7. Verify Execution Agent sends intro message

**Expected:** Full task board visible after approval.  
**Status:** ✅ PASS

---

## TC-04 — Daily Check-in Updates Kanban

**Steps:**
1. Open chat in execution stage
2. Tell the Execution Agent: "I finished task X"
3. Agent asks for concrete output description
4. Provide output description
5. Verify task status changes to `done` on Kanban board
6. Verify momentum score updates

**Expected:** Task card shows "done" status within a few seconds of agent response.  
**Status:** ✅ PASS

---

## TC-05 — Agent Auto-Assignment

**Steps:**
1. After a check-in that marks tasks done, wait ~6 seconds
2. Verify assignment badges appear on eligible task cards
3. Go to Agents view — verify assignments listed
4. Click "⟳ Auto-assign" in Agents view (force trigger)
5. Verify new assignments appear

**Expected:** Coding/research/content/QA assignments appear on appropriate tasks.  
**Status:** ✅ PASS  
**Note:** 6s delay is intentional (LLM analysis happens async after check-in).

---

## TC-06 — Run Agent from Task Card

**Steps:**
1. Find a task card with a pending agent assignment badge
2. Click the task card to expand it
3. Verify agent section shows: agent name, reason, suggested prompt
4. Click "▶ Run [Agent]"
5. Verify button changes to "⟳ Running…"
6. After completion, verify "✓ [Agent] completed" shown
7. Verify "Review output in Agents tab →" link works

**Expected:** Agent runs, completes, output appears in Agents tab and Workspace.  
**Status:** ✅ PASS

---

## TC-07 — Milestone Retro

**Steps:**
1. Mark all tasks in a milestone as done
2. Verify green action strip appears: "All tasks done — run retro"
3. Click "Milestone retro →"
4. Verify Retro Agent opens and asks Q1 immediately (no preamble)
5. Answer all 3 questions
6. Verify JSON appears in agent output, closing message shown
7. Verify project advances to `execution` stage
8. Verify Knowledge Hub has 3 new entries (what worked, friction, would change)

**Expected:** Retro completes, knowledge entries created, board unlocks.  
**Status:** ✅ PASS

---

## TC-08 — Knowledge Hub Auto-Population

**Steps:**
1. Complete a milestone retro (TC-07)
2. Navigate to Knowledge Hub (Analytics section)
3. Verify 3 entries exist from retro (lesson_learned × 2, friction_point × 1)
4. Search for a word from one of the retro answers
5. Verify correct entry appears in results
6. Create a decision in RAID Log
7. Verify decision appears as `decision` type entry in Knowledge Hub

**Expected:** Retro + decision entries automatically appear without manual action.  
**Status:** ✅ PASS

---

## TC-09 — Project Workspace

**Steps:**
1. Navigate to Workspace (Project section in sidebar)
2. Click "+ New doc", select type "Note"
3. Enter title and start typing content
4. Stop typing — verify "Saved ✓" appears within ~1.5s
5. Reload the page and navigate back to Workspace
6. Verify the note persists with its content
7. Click "◈ Save to Knowledge Hub"
8. Navigate to Knowledge Hub — verify entry appears

**Expected:** Notes auto-save, persist on reload, can be promoted to knowledge.  
**Status:** ✅ PASS

---

## TC-10 — Agent Output in Workspace

**Steps:**
1. Run an agent assignment (TC-06)
2. Navigate to Workspace
3. Filter by "Agent" type
4. Verify the agent's output appears as a read-only doc
5. Verify task linkage shown (↳ task title)
6. Verify "◈ Save to Knowledge Hub" button works
7. Verify content area is read-only (no text cursor in agent docs)

**Expected:** Agent outputs auto-appear, task-linked, promotable to knowledge.  
**Status:** ✅ PASS

---

## TC-11 — RAID Log

**Steps:**
1. Navigate to RAID Log
2. Create a manual risk (entry_type = risk)
3. Create a manual assumption (entry_type = assumption)
4. Materialise a risk → it becomes an issue
5. Create a decision from the issue
6. Verify decision appears in Knowledge Hub automatically

**Expected:** Full RAID lifecycle works, decisions auto-populate knowledge.  
**Status:** ✅ PASS

---

## TC-12 — Ship Retro and Project Close

**Steps:**
1. Mark all milestones complete
2. Trigger ship retro
3. Answer all 5 questions
4. Verify project stage advances to `complete`
5. Verify Documents view shows close report option
6. Verify Knowledge Hub has ship retro entries (founder_growth_read)
7. Verify V2 backlog accessible

**Expected:** Project marked complete, all outputs saved, knowledge entries created.  
**Status:** ✅ PASS

---

## TC-13 — Archived Projects

**Steps:**
1. Archive a completed project from project list
2. Verify it disappears from active list
3. Toggle "Show archived" — verify it reappears
4. Unarchive — verify it returns to active list

**Expected:** Archive/unarchive works without errors (was previously 500 — fixed in migration 007).  
**Status:** ✅ PASS

---

## TC-14 — Security: No API Keys in Response

**Steps:**
1. Open browser DevTools → Network tab
2. Perform various actions (check-in, run agent, search knowledge)
3. Inspect all API responses
4. Verify no `ANTHROPIC_API_KEY` or `DATABASE_URL` values appear in any response

**Expected:** Secrets never exposed to the client.  
**Status:** ✅ PASS

---

## Known Limitations

| Item | Severity | Notes |
|------|----------|-------|
| Full-text search doesn't match abbreviations (e.g. "auth" ≠ "authentication") | Low | Acceptable v1 — upgrade to embeddings for v2 |
| Agent assignment analysis has ~6s delay after check-in | Low | Intentional — async LLM call |
| Workspace agent docs are plain text (no markdown rendering) | Low | Markdown rendering planned for v2 |
