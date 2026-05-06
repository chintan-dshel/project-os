# ProjectOS — PATTERNS.md

*Per-project pattern index. Read this first when working on ProjectOS.*

---

## 1. What this project is

ProjectOS is an AI-powered project management platform for solo founders running early-stage software projects. It replaces a project manager across the full project lifecycle — intake, planning, execution tracking, and retrospective — through a conversational AI interface that routes each stage to a specialised agent. Founders get actionable outputs within three messages rather than filling in forms.

Architecturally, ProjectOS is a four-agent system (intake, planning, execution, retro) routed by a static `STAGE_AGENT` map in `agents.js`; every project flows through stages sequentially (`intake → planning → awaiting_approval → execution → milestone_retro → ship_retro → complete`) with no NLP intent classification anywhere in the routing path. All LLM calls pass through a single `callClaude()` wrapper that captures telemetry, fires a 15%-sampled production judge for quality monitoring, and applies a three-layer security stack. An orchestrator layer resolves A/B model variants and fallback chains before any agent call. A PostgreSQL tsvector knowledge store accumulates retrospective learnings and injects them into planning and execution agents, creating a compounding loop where better retros produce better plans.

---

## 2. Load-bearing patterns

[[Stage-Driven-Agent-Routing]] — originated here
The static `STAGE_AGENT` map routes every conversation to exactly one agent based on `project.stage`; no NLP classification exists anywhere in the routing path. Lyceum is the second confirmed implementation.

[[Knowledge-Injection-for-Agents]] — originated here
tsvector retrieval from a retro-populated store injected into planning and execution agents before every call; the compounding loop means each completed project improves quality for the next.

[[Auto-Populating-Knowledge-Stores]] — originated here
The retro agent calls `populateFromRetro()` on completion, writing learnings to the knowledge hub automatically; no manual curation is required for the loop to compound.

[[AI-Eval-Harness-Architecture]] — originated here
Two-layer harness: structural assertions run on every deploy; LLM-as-judge scores live traffic at 15% and promotes high-scoring traces to a golden dataset for CI gating.

[[Production-LLM-Judge]] — originated here
Live traffic sampled at 15%; anti-recursion guard (`meta.agent !== '__judge__'`) prevents the judge from scoring itself; golden candidates flow from production into the CI eval gate.

[[Model-Routing-and-AB-Orchestration]] — originated here
Rules-based model router (retro→Haiku, large-context→Opus) plus sticky A/B assigner sit in a shared orchestrator layer; A/B variant takes precedence over cost routing for active experiments.

[[Agent-Initiated-Conversations]] — originated here
Every stage transition fires an agent-generated opening message before any user input, eliminating the blank-chat dead-end at stage entry; the pattern is documented here as a cold-start UX solution.

[[LLM-Telemetry-Infrastructure]] — originated here
Fire-and-forget traces written in the `callClaude()` wrapper with snapshot pricing; migration guard returns a 200 with warning if the table doesn't exist. Lyceum inherited this unchanged.

[[LLM-Security-Middleware]] — originated here
`rateLimit → injectionDetection → piiAudit` ordering on the message route; per-user keying prevents bypass via multiple projects. Lyceum inherited this unchanged.

---

## 3. Patterns originating in this project

[[Stage-Driven-Agent-Routing]] — originated here as the first implementation of purely stage-based routing with no intent classification; the `STAGE_AGENT` map and static dispatcher are the canonical example.

[[AI-Eval-Harness-Architecture]] — originated here with the structural-plus-judge two-layer design and the insight that golden dataset growth should come from high-scoring production traces, not manual authoring.

[[Production-LLM-Judge]] — originated here; the 15% sampling rate, dynamic import to avoid circular dependency, anti-recursion guard, and golden candidate promotion pipeline are all first implementations.

[[Knowledge-Injection-for-Agents]] — originated here; the tsvector approach (no vector DB) and the retro-auto-population loop that makes knowledge self-sustaining are ProjectOS-specific design decisions with no prior analogue.

[[Auto-Populating-Knowledge-Stores]] — originated here in response to the observation that manual knowledge curation would never happen at the pace of product development; auto-populating from retro outputs makes the compounding loop self-sustaining without any human maintenance burden.

---

## 4. Conscious non-applications

[[Dual-Mode-Agent-Streaming]] — not applied because all agent outputs are structured JSON that must be fully received and validated before being written to the database; streaming partial JSON is incompatible with the parse-then-validate flow.

[[Lazy-Content-Generation]] — not applicable; all agent outputs are single structured documents generated in one call, not tiered content hierarchies that benefit from lazy access-time generation.

[[Learner-Memory-Extraction]] — not applied because ProjectOS has no cross-session per-user personalization need; organisational learning accumulates at the project level in the knowledge store, not as per-user factual memory.

---

## 5. Anti-patterns this project is at risk for

**In-memory concurrency guards** — currently present: the rate limiter uses an in-process Map keyed on userId; fails silently in multi-process deployments without a Redis migration.

**SQL injection via column name interpolation** — currently present: `updateProjectStage()` in `projects.queries.js` builds SET clauses from `Object.entries(extraFields)`; not exploitable at current call sites but violates defense-in-depth.

**Sub-resource ownership bypass** — fixed during 2026-05-05 audit: `assertProjectOwner` helper applied to all 13 sub-resource handlers; previously all 13 scoped by `project_id` without verifying `user_id`.

**Scattered LLM calls** — currently avoided: all Claude API calls route through single `callClaude()` wrapper; direct SDK use elsewhere is a code smell.

**Judge judging itself** — currently avoided: `meta.agent !== '__judge__'` guard in the sampling hook prevents recursive scoring and cost explosion.

---

## 6. How to use this file

When starting work on ProjectOS: read this file first, then CLAUDE.md. When the work involves a load-bearing pattern, read the wiki entry before changing the implementation. When introducing a new pattern, update this file and capture a wiki entry per the standing protocol.
