/**
 * migrate.js — run pending SQL migrations against the configured DATABASE_URL
 *
 * Usage:  node migrate.js
 *
 * Tracks applied migrations in a `_migrations` table so it's safe to run
 * repeatedly — already-applied files are skipped.
 */

import pg     from 'pg';
import fs     from 'fs';
import path   from 'path';
import url    from 'url';
import 'dotenv/config';

const { Client } = pg;
const __dirname  = path.dirname(url.fileURLToPath(import.meta.url));

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

// Ensure tracking table exists
await client.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

// Collect already-applied filenames
const { rows } = await client.query(`SELECT filename FROM _migrations`);
const applied  = new Set(rows.map(r => r.filename));

// Find all .sql files in migrations/, sorted by name
const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) {
    console.log(`skip  ${file}`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
    await client.query('COMMIT');
    console.log(`✓     ${file}`);
    ran++;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`✗     ${file}\n      ${err.message}`);
    process.exit(1);
  }
}

if (ran === 0) console.log('Nothing to migrate.');
else console.log(`\nDone — ${ran} migration(s) applied.`);

await client.end();
