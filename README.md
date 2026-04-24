# Project OS

AI-native project management for solo founders. A multi-agent system that coaches you through the full project lifecycle — from idea to retrospective — using Claude as the engine.

---

## How it works

Projects move through six stages. A different Claude agent handles each one:

| Stage | Agent | What it does |
| --- | --- | --- |
| `intake` | Intake | Turns a raw idea into a structured brief with success criteria, scope, and risks |
| `planning` | Planning | Builds a milestone-and-task execution plan calibrated to your weekly capacity |
| `awaiting_approval` | Planning | Holds for your sign-off before execution begins |
| `execution` | Execution | Coaches weekly progress, surfaces risks, updates momentum score |
| `milestone_retro` / `ship_retro` | Retro | Runs a structured retrospective; extracts forward-feed for the next cycle |
| `complete` | — | Project archived |

Every agent initiates the first message when a stage opens — no blank chats.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- An Anthropic API key (`claude-sonnet-4-*` or better)

---

## Quick start

```bash
git clone https://github.com/chintan-dshel/project-os.git
cd project-os

# Backend
cd project-os
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
node run_migration.js       # runs all 22 migrations in order
npm start                   # API on http://localhost:3000

# Frontend (new terminal)
cd ../project-os-ui
npm install
npm run dev                 # UI on http://localhost:5173
```

---

## Environment variables

Set in `project-os/.env`. All required unless noted.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | ≥32 char random string for signing tokens |
| `ANTHROPIC_API_KEY` | Yes | — | Anthropic API key |
| `PORT` | No | `3000` | API server port |
| `NODE_ENV` | No | `development` | Set to `production` to silence request logs |
| `JUDGE_SAMPLE_RATE` | No | `0.15` | Fraction of agent responses scored by the LLM judge (0.0–1.0) |
| `TEST_DATABASE_URL` | Test only | — | Separate DB for the test suite; must differ from `DATABASE_URL` |

---

## Migrations

```bash
node run_migration.js
```

Runs all migrations in `migrations/` in order. Safe to re-run — each migration is idempotent.

| Range | What it adds |
| --- | --- |
| 001–010 | Core schema: projects, tasks, documents, RAID, assignments, specialists, knowledge, workroom |
| 011 | Auth: users, password hashing, JWT |
| 012 | Telemetry: `agent_traces` (cost, latency, tokens per call) |
| 013 | PII audit: `pii_events` |
| 014–018 | Brief versioning, workroom updates, agent budgets, document ACL, integrations |
| 019 | Judge: `judge_scores`, `golden_candidates` |
| 020 | Golden dataset: `golden_cases`, `golden_runs` |
| 021 | A/B testing: `ab_variants`, `ab_assignments`, `routing_decisions` |
| 022 | Rate limiting: `rate_limit_events` |

---

## Test suite

```bash
# One-time: create and migrate the test database
npm run test:db:setup

# Run everything
npm test

# Subsets
npm run test:unit          # pure functions, no DB
npm run test:integration   # DB queries, judge, orchestrator, A/B assigner
npm run test:api           # full HTTP stack via supertest
npm run test:coverage      # with coverage report
```

Tests run against `project_os_test` (set `TEST_DATABASE_URL` in `.env`). All Anthropic calls are intercepted — no real API calls during tests.

---

## Eval harness

```bash
npm run eval               # all 4 agents against fixtures, structural assertions only
npm run eval:judge         # same + LLM-as-judge scoring (uses real API, ~$0.10)
npm run eval:intake        # single agent

npm run golden:seed        # load 12 hand-curated golden cases into the DB
npm run golden:run         # score all cases; exits 1 if any fail min_judge_score
npm run golden:run:dry     # print what would run without hitting the API
npm run golden:list        # list active golden cases
npm run golden:candidates  # list runtime responses flagged for promotion
```

The `eval-golden` CI job runs on every push to `main`. A golden case fails if its judge score falls below `min_judge_score`.

---

## A/B testing

```bash
# Create a variant
curl -X POST http://localhost:3000/ab/variants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"experiment_key":"intake-v2","variant_name":"treatment","agent":"intake","model":"claude-haiku-4-5-20251001","traffic_weight":20}'

# Read results
curl "http://localhost:3000/ab/results?experiment_key=intake-v2" \
  -H "Authorization: Bearer $TOKEN"
```

Assignment is sticky per project. New projects are weighted-randomly assigned; existing assignments are preserved even after a variant is deactivated.

---

## Telemetry

```bash
curl http://localhost:3000/telemetry/summary   -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/telemetry/by-agent  -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/telemetry/latency   -H "Authorization: Bearer $TOKEN"
```

Judge (`__judge__`) calls are tracked in `agent_traces` but excluded from user-facing telemetry endpoints.

---

## Security

- **Prompt injection:** 7 regex patterns block known injection techniques (ignore-previous-instructions, DAN, system-tag injection, etc.). Returns 403; no agent call made, no trace written.
- **PII audit:** email, phone, SSN, credit card detected and logged to `pii_events`. Message is never blocked — audit-only.
- **Rate limiting:** 20 requests/hour, 200/day per user. In-memory sliding window. Events logged to `rate_limit_events`.

---

## CI

| Job | Trigger | What it does |
| --- | --- | --- |
| `test` | Every push and PR | Full test suite + coverage report |
| `ui-test` | Every push and PR | Frontend Vitest suite + build check |
| `eval-golden` | Push to `main` only | Runs 12 golden cases against the real Anthropic API |

`eval-golden` requires `ANTHROPIC_API_KEY_CI` set as a GitHub Actions secret.

---

## Architecture

See [docs/AI-ARCHITECTURE.md](project-os/docs/AI-ARCHITECTURE.md) for the full AI system design — agent pipeline, model routing, A/B infrastructure, judge eval pipeline, and security layer.
