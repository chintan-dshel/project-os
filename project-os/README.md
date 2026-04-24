# Project OS — API

AI-powered project management backend. Express + PostgreSQL + Claude.

## Quick start

```bash
cp .env.example .env    # fill in DATABASE_URL, ANTHROPIC_API_KEY, JWT_SECRET
npm install
node run_migration.js   # apply migrations to prod DB
npm start
```

## Testing

Tests require a **separate** test database. Set `TEST_DATABASE_URL` in `.env` (see `.env.example`), then:

```bash
npm run test:db:setup   # create + migrate project_os_test (idempotent)
npm test                # run full test suite
npm run test:fast       # unit + integration only (no API tests)
npm run test:coverage   # with coverage report
```

The test database name must differ from `DATABASE_URL`. The setup script will refuse to run if they match.

## Eval / golden dataset

```bash
npm run eval            # structural assertions (no LLM cost)
npm run eval:judge      # + LLM quality scoring
npm run golden:seed     # seed hand-curated cases from eval/golden/cases/
npm run golden:run      # CI gate: score all active cases, exit 1 on failure
```
