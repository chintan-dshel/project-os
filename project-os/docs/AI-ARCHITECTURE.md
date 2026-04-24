# AI Architecture — Project OS

Project OS is a multi-agent system built on top of the Claude API. This document covers every architectural decision in the AI layer: how agents are designed, how requests are routed, how the system learns from its own outputs, and how it defends against misuse.

---

## Request flow

Every user message to `/projects/:id/message` passes through this pipeline:

```mermaid
flowchart TD
    A([User message]) --> B[requireAuth]
    B --> C[rateLimit]
    C -- 429 --> D[(rate_limit_events)]
    C --> E[injectionDetection]
    E -- 403 --> F[warn + sha256 hash]
    E --> G[piiAudit]
    G -. fire & forget .-> H[(pii_events)]
    G --> I[messages route]
    I --> J[runWithOrchestration]
    J --> K{resolveVariant}
    K -. active experiment .-> L[(ab_assignments)]
    K --> M[routeModel]
    M --> N[runActiveAgent]
    N --> O[[Anthropic API]]
    O --> P[(agent_traces)]
    O -. fire & forget .-> Q[scoreAgentResponse]
    Q --> R[(judge_scores)]
    Q -. score ≥ 4.5 .-> S[(golden_candidates)]
    O -. fire & forget .-> T[(routing_decisions)]
    O --> U([Response])
```

Solid lines are awaited. Dashed lines are fire-and-forget — they never block the response.

---

## The agent pipeline

### Stage-agent mapping

```
intake → planning → awaiting_approval → execution → milestone_retro → ship_retro → complete
  ↑          ↑              ↑               ↑               ↑              ↑
Intake    Planning       Planning        Execution         Retro          Retro
```

The same agent handles multiple stages (`planning` and `awaiting_approval` both use the Planning agent; all retro stages use the Retro agent). This simplifies the dispatch table without losing stage-specific behaviour — agents inspect the project stage internally to adjust their prompt.

### Agent-initiated first messages

When a project enters a new stage, the first message comes from the agent, not from the user. This eliminates blank chats and ensures the user always has context on what the agent needs next. Implementation: the messages route checks `conversation_history` on entry; if empty for this agent, it calls the agent with a synthetic "start" message.

### Stateless agents, stateful context

Agents are stateless functions. All project state — conversation history, plan, RAID log, momentum score — lives in PostgreSQL and is injected at call time. This means agents are trivially restartable and the full conversation is always available as context (up to the last 40 messages for performance, configurable).

---

## Orchestration layer

`runWithOrchestration` is the single entry point for all agent calls. It does three things in order:

### 1. Variant resolution

Before routing, it checks whether an active A/B experiment exists for this agent. If a variant is found, its model and system prompt override the router's choice. This means experiments are fully transparent to the agent — the agent just sees a different model or different instructions; it doesn't know it's in a test.

```
variant?.model ?? routing.model
```

If variant resolution fails (DB error, no experiment), it falls back to the router silently.

### 2. Model routing

If no experiment is active, `routeModel` picks the model using four ordered rules:

| Priority | Rule | Condition | Model |
| --- | --- | --- | --- |
| 1 | `retro-default-haiku` | `agent === 'retro'` | Haiku |
| 2 | `large-context-opus` | `contextTokens > 8000` | Opus |
| 3 | `execution-many-tasks-sonnet` | `agent === 'execution' && taskCount >= 15` | Sonnet |
| 4 | `default-sonnet` | catch-all | Sonnet |

**Why this ordering:** Retro is the cheapest call (extracting patterns from a conversation), so Haiku first. Large contexts require Opus's extended window. Execution with many tasks benefits from Sonnet's reasoning. Everything else defaults to Sonnet. The rules are cheap enough to evaluate on every request — no caching needed.

The router also returns the full `inputs` object (`agent`, `stage`, `contextTokens`, `taskCount`) which is persisted to `routing_decisions` for observability. Every routing call is auditable.

### 3. Fallback chain

Each model has a fallback chain. If the primary model returns a retryable error (429, 502, 503), the orchestrator tries the next model in the chain:

```
Haiku  → [Haiku, Sonnet]
Sonnet → [Sonnet, Opus]
Opus   → [Opus]
```

Non-retryable errors (400, 401) bubble up immediately — no retry. The trace records the model that actually succeeded, and `routing_decisions.fallback_chain` records the full path so you can see how often fallback fires in production.

---

## A/B testing infrastructure

### Design goals

- Sticky per project (not per user) — a project always sees the same variant for its lifetime
- Weighted random on first assignment — supports gradual rollouts
- Works at the model level AND the prompt level — variants can change either or both
- Results feed directly into the judge eval pipeline

### Assignment flow

```
resolveVariant(projectId, agent)
  ↓
Check ab_assignments for existing assignment
  ↓ (none found)
Fetch active variants for this agent's experiments
  ↓
weightedPick(variants, Math.random() * totalWeight)
  ↓
INSERT INTO ab_assignments ON CONFLICT DO NOTHING
  ↓
Return {variantId, model, systemPrompt, temperature}
```

The `ON CONFLICT DO NOTHING` on `ab_assignments` is intentional: under concurrent requests for the same project, only one assignment wins. The other request reads the now-existing row on its next call.

### Results

`GET /ab/results?experiment_key=...` aggregates judge scores, latency, cost, and error counts per variant. A `sample_size_warning` fires when any variant has fewer than 50 judged responses — results below this threshold are directional, not statistically meaningful.

---

## LLM-as-judge eval pipeline

### Why a judge agent

Every agent response is automatically scored by a second Claude call (`__judge__`). This creates a continuous quality signal without human labelling — the judge evaluates the agent against a rubric, and the score feeds both the A/B results and the golden dataset.

The judge is a separate agent, not inline scoring. This keeps the production response path fast (judge runs fire-and-forget after the response is sent) and lets the judge use a different model than the primary agent.

### Per-agent rubrics

Each agent has a rubric tailored to its job:

| Agent | Dimensions evaluated |
| --- | --- |
| Intake | Inference quality, assumption transparency, success criteria quality, scope discipline |
| Planning | Task specificity, hour realism, plan coherence, scope fit |
| Execution | Status probing, risk awareness, scope discipline, momentum calibration |
| Retro | Pattern insight, friction specificity, forward-feed quality, honest accounting |

All rubrics share a common structure: 4 domain dimensions + `overall` with a summary sentence. Scores are 1–5. The judge is prompted to be rigorous — 5 means genuinely excellent, not merely acceptable.

### Golden candidates

When a judge score reaches ≥ 4.5, the trace is automatically inserted into `golden_candidates` with `status='pending'`. These are reviewed periodically and promoted to `golden_cases` for inclusion in the CI gate.

### Idempotency

`judge_scores` has a unique constraint on `agent_trace_id`. The INSERT uses `ON CONFLICT DO NOTHING`, so re-running the judge on the same trace is safe.

### Cost segregation

Judge calls appear in `agent_traces` with `agent = '__judge__'`. All telemetry endpoints filter on `agent != '__judge__'`, so judge costs are visible in the admin DB view but hidden from user-facing analytics. This prevents the judge from inflating a user's apparent usage.

---

## Golden dataset and CI gate

### The problem it solves

Unit tests verify that code runs. They don't verify that the agent is actually useful. The golden dataset solves this: it's a curated set of input/output pairs where a human has verified the output is high quality. The CI gate fails the build if the current model scores below threshold on these cases.

### Structure

```
eval/golden/cases/
  intake_01.json    # {input: {...}, expected: {min_judge_score: 4.0, ...}}
  intake_02.json
  ...               # 12 cases total: 3 per agent
```

Each case specifies the full agent input and a `min_judge_score`. The golden runner calls the agent live, scores with the judge, and exits non-zero if any case fails. This runs on every push to `main` via the `eval-golden` CI job.

### Shadow eval loop

The runtime → judge → golden_candidates flow creates a flywheel:

```
Production call → judge scores it → if ≥ 4.5 → golden_candidates
                                                      ↓
                                              Human reviews
                                                      ↓
                                         Promoted to golden_cases
                                                      ↓
                                           CI gate gets stronger
```

The golden dataset improves automatically as the system runs in production.

---

## Security layer

Middleware order on `/projects/:id/message`:

```
requireAuth → rateLimit → injectionDetection → piiAudit → messagesRouter
```

Order is load-bearing:

1. **requireAuth** — rejects unauthenticated requests before any compute happens
2. **rateLimit** — enforces per-user quotas before reaching security checks (injection attempts consume rate limit budget — this is intentional)
3. **injectionDetection** — blocks 403 with no agent call, no DB write. The message is hashed (SHA-256) for the audit log — raw message is never stored
4. **piiAudit** — detects PII and writes to `pii_events`, but never blocks the request. The message reaches the agent unchanged; this is audit-only

### Injection patterns

Seven regex patterns cover the known attack surface:

```
/ignore\s+(all\s+|the\s+)?(previous|above|prior)\s+(instructions?|prompts?|messages?)/i
/disregard\s+(all\s+|the\s+)?(previous|above|prior)/i
/you\s+are\s+(now\s+|actually\s+)?(DAN|a\s+different|no\s+longer)/i
/\bjailbreak\b/i
/system\s*:\s*you\s+are/i
/###\s*(system|instruction|admin)/i
/<\/?(system|instructions?)>/i
```

Each pattern targets a distinct injection class: instruction override, DAN persona swap, jailbreak keyword, fake system prompt injection via markdown headers, and HTML/XML system tag injection.

### Rate limiter design

In-memory sliding window using a `Map<userId, {hour: timestamp[], day: timestamp[]}>`. Limits: 20/hour, 200/day. The factory pattern (`createRateLimiter({ now, hourMax, dayMax })`) allows clock injection for unit tests without mocking `Date.now` globally.

The current implementation is intentionally single-process. The comment in the code flags the Redis migration path: `// TODO: move to Redis if multi-instance`.

---

## Observability

Every AI call produces a record in `agent_traces`:

```sql
agent_traces (
  id, project_id, user_id, variant_id,
  agent, model, status,
  input_tokens, output_tokens, cost_usd, latency_ms,
  created_at
)
```

This gives per-project, per-agent, per-model cost and latency visibility across the full request history. Combined with `routing_decisions`, you can answer: which rule fired, did it fall back, how much did the fallback cost compared to the primary?

---

## Key tradeoffs

**Raw SQL vs ORM**
The codebase uses `pg` directly with SQL strings. This gives full control over query shape and is explicit about what hits the DB. The cost is migration-code drift — column names in migrations can diverge from column names in query code, and the compiler won't catch it. The test suite addresses this by running real INSERT/SELECT round-trips against the actual schema. If you use an ORM like Prisma or Drizzle, you get codegen-time safety at the cost of expressiveness.

**In-memory rate limiting**
The current rate limiter is fast and zero-dependency, but resets on restart and doesn't work across multiple processes. Redis is the obvious upgrade path for horizontal scaling or persistence across deploys.

**Fire-and-forget writes**
Judge scoring, routing decisions, and PII events are all fire-and-forget. The production response is never held waiting for telemetry. The cost: a server crash mid-write loses that record. For a system where the primary value is the agent response (not the telemetry), this is the right tradeoff. Any future streaming implementation should keep this property.

**JUDGE_SAMPLE_RATE**
Scoring every response in production would double API costs. The default 15% sample rate gives enough signal to track quality trends without burning budget. Set to 1.0 when running the post-ship verification protocol or during active A/B experiments.

---

## What I'd build next

- **Streaming responses** — pipe Anthropic's streaming API to the client; record latency on stream close
- **Redis rate limiter** — prerequisite for running multiple API instances
- **Drizzle ORM** — eliminates migration-code drift without giving up query control
- **Variant-level cost tracking** — surface per-variant cost in A/B results so experiments can be evaluated on ROI, not just quality score
- **Judge caching** — identical inputs produce identical judge scores; memoising on `(agent_trace_id, rubric_version)` eliminates redundant API calls when re-scoring historical data
