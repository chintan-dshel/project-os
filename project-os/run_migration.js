/**
 * run_migration.js
 * Runs pending migrations using DATABASE_URL from .env — no psql needed.
 *
 * Usage:
 *   node run_migration.js          ← detects and runs only missing migrations
 *   node run_migration.js 006      ← force-run a specific migration number
 */

import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── What each migration creates (used to detect if it's already applied) ───────
const MIGRATION_CHECKS = {
  '001': `SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'tasks_project_task_key_unique' AND table_name = 'tasks'`,
  '002': `SELECT 1 FROM pg_indexes WHERE indexname = 'milestones_project_id_idx'`,
  '003': `SELECT 1 FROM information_schema.columns
          WHERE table_name = 'risk_register' AND column_name = 'entry_type'`,
  '004': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'specialist_outputs'`,
  '005': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'agent_registry'`,
  '006': `SELECT COUNT(*) AS n FROM agent_registry WHERE slug = 'db-schema'`,
  '007': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'agent_assignments'`,
  '008': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'knowledge_entries'`,
  '009': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'workspace_docs'`,
  '010': `SELECT 1 FROM information_schema.columns
          WHERE table_name = 'success_criteria' AND column_name = 'smart_score'`,
  '011': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'users'`,
  '012': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'agent_traces'`,
  '013': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'pii_events'`,
  '014': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'briefs'`,
  '015': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'log_entries'`,
  '016': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'project_agent_budgets'`,
  '017': `SELECT 1 FROM information_schema.columns
          WHERE table_name = 'workspace_docs' AND column_name = 'acl'`,
  '018': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'integrations'`,
  '019': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'judge_scores'`,
  '020': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'golden_cases'`,
  '021': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ab_variants'`,
  '022': `SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'routing_decisions'`,
}

async function isApplied(client, num) {
  const check = MIGRATION_CHECKS[num]
  if (!check) return false
  try {
    const { rows } = await client.query(check)
    if (num === '006') return parseInt(rows[0]?.n ?? '0') > 0
    return rows.length > 0
  } catch {
    return false
  }
}

// State-machine SQL splitter.
// Handles:
//   - Single-quoted strings: 'text', with '' as escaped quote
//   - Dollar-quoted strings: $$body$$ or $tag$body$tag$ (used by DO blocks, functions)
//   - Line comments: -- to end of line
//   - ; outside any string is the statement boundary
function splitStatements(sql) {
  const statements = []
  let current       = ''
  let inString      = false
  let inDollar      = false
  let dollarTag     = ''
  let i = 0

  while (i < sql.length) {
    const ch  = sql[i]
    const ch2 = sql[i + 1]

    // ── Inside a dollar-quoted block ($$ or $tag$) ──────────────────────────
    if (inDollar) {
      if (ch === '$') {
        // Check whether the closing tag matches the opening tag
        const slice = sql.slice(i, i + dollarTag.length)
        if (slice === dollarTag) {
          current += dollarTag
          i += dollarTag.length
          inDollar = false
          dollarTag = ''
        } else {
          current += ch
          i++
        }
      } else {
        current += ch
        i++
      }

    // ── Inside a single-quoted string ────────────────────────────────────────
    } else if (inString) {
      if (ch === "'" && ch2 === "'") {
        current += "''"
        i += 2
      } else if (ch === "'") {
        inString = false
        current += "'"
        i++
      } else {
        current += ch
        i++
      }

    // ── Normal (unquoted) context ────────────────────────────────────────────
    } else {
      if (ch === '$') {
        // Try to match a dollar-quote opener: $[A-Za-z0-9_]*$
        let j = i + 1
        while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++
        if (j < sql.length && sql[j] === '$') {
          dollarTag = sql.slice(i, j + 1)   // e.g. "$$" or "$body$"
          current  += dollarTag
          i = j + 1
          inDollar = true
        } else {
          current += ch
          i++
        }
      } else if (ch === "'") {
        inString = true
        current += "'"
        i++
      } else if (ch === '-' && ch2 === '-') {
        // Line comment — skip to end of line
        while (i < sql.length && sql[i] !== '\n') i++
      } else if (ch === ';') {
        const stmt = current.trim()
        if (stmt.length > 0) statements.push(stmt)
        current = ''
        i++
      } else {
        current += ch
        i++
      }
    }
  }

  const last = current.trim()
  if (last.length > 0) statements.push(last)

  return statements
}

async function runFile(client, filepath) {
  const sql = fs.readFileSync(filepath, 'utf8')

  // Run each statement individually so ALTER TYPE ADD VALUE commits before
  // any subsequent use of the new enum value (PostgreSQL requirement).
  for (const stmt of splitStatements(sql)) {
    await client.query(stmt)
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL not set in .env')
    process.exit(1)
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  console.log('Connected.\n')

  const migrationsDir = path.join(__dirname, 'migrations')
  const allFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()

  // Optional: force a specific migration number
  const forceNum = process.argv[2]?.padStart(3, '0')

  let applied = 0, skipped = 0

  for (const file of allFiles) {
    const num = file.slice(0, 3)
    if (forceNum && num !== forceNum) continue

    const filepath = path.join(migrationsDir, file)
    const alreadyDone = await isApplied(client, num)

    if (alreadyDone && !forceNum) {
      console.log(`  ✓ ${file} — already applied`)
      skipped++
      continue
    }

    process.stdout.write(`  → ${file} ... `)
    try {
      await runFile(client, filepath)
      console.log('done ✓')
      applied++
    } catch (err) {
      console.log(`FAILED\n    ${err.message}`)
      console.error('\nStopped at failed migration.')
      await client.end()
      process.exit(1)
    }
  }

  console.log(`\n${applied} applied, ${skipped} already done.`)
  await client.end()
}

main().catch(err => {
  console.error('Unexpected error:', err.message)
  process.exit(1)
})
