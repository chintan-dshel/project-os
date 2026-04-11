# Installation Guide — Project OS

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18+ | Download from nodejs.org |
| PostgreSQL | 14+ | Local install **or** use [Neon](https://neon.tech) (free tier works) |
| Anthropic API Key | — | Get one at console.anthropic.com |

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/project-os.git
cd project-os/project-os-app
```

---

## Step 2 — Backend setup

```bash
cd project-os
npm install
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL=postgres://user:password@localhost:5432/project_os
PORT=3000
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-...
```

**Using Neon (recommended for quick start):**
1. Go to [neon.tech](https://neon.tech), create a free project
2. Copy the connection string from the Neon dashboard
3. Paste into `DATABASE_URL` in `.env`

---

## Step 3 — Database setup

### Option A: Run migrations (recommended)
```bash
# Apply the full schema via the migration runner
node run_migration.js
```

### Option B: Apply schema directly (fresh install)
```bash
psql $DATABASE_URL -f ../schema.sql
node run_migration.js   # applies any migrations on top
```

The migration runner is idempotent — safe to run multiple times. It handles:
- PostgreSQL dollar-quoted strings (`$$...$$`) in DO blocks
- Per-migration applied checks (won't re-run what's already applied)

---

## Step 4 — Start the backend

```bash
npm run dev
# Server starts on http://localhost:3000
# Test: curl http://localhost:3000/health
```

---

## Step 5 — Frontend setup

```bash
cd ../project-os-ui
npm install
npm run dev
# Frontend starts on http://localhost:5173
```

The Vite dev server proxies all `/projects`, `/registry`, and `/knowledge` requests to the backend automatically.

---

## Step 6 — Open the app

Visit **http://localhost:5173** — you'll see the project list page.

Click **+ New project** to start. The Intake Agent will guide you from there.

---

## Windows one-click launch

If you're on Windows, `setup.bat` handles everything:
1. Checks for Node.js and PostgreSQL
2. Installs dependencies
3. Prompts for your API key
4. Creates the database
5. Starts both servers
6. Opens the browser

```
Double-click setup.bat
```

---

## Verify your installation

After setup, confirm these work:

```bash
# Backend health
curl http://localhost:3000/health
# Expected: {"ok":true,"ts":"..."}

# Knowledge hub (migration 008)
curl http://localhost:3000/knowledge
# Expected: {"entries":[],"count":0}

# DB migrations
node run_migration.js
# Expected: ✓ 001...009 all shown as "already applied"
```

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `PORT` | No | API server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |

---

## Troubleshooting

**`relation "agent_assignments" does not exist`**  
Migration 007 wasn't applied. Run: `node run_migration.js 007`

**`unterminated dollar-quoted string`**  
You're using an older `migrate.js` — use `run_migration.js` instead (handles `$$` blocks).

**Port 3000 already in use**  
Set `PORT=3001` in `.env` and update `vite.config.js` proxy targets accordingly.

**Knowledge Hub / Workspace 404**  
These need migrations 008 and 009. Run `node run_migration.js` to apply pending migrations.
