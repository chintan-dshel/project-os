/**
 * migrate-init.js — one-time script to mark already-applied migrations as done.
 *
 * Run this ONCE on an existing database that had migrations applied manually.
 * Then use migrate.js for all future migrations.
 *
 * Usage:  node migrate-init.js
 */

import pg   from 'pg';
import fs   from 'fs';
import path from 'path';
import url  from 'url';
import 'dotenv/config';

const { Client } = pg;
const __dirname  = path.dirname(url.fileURLToPath(import.meta.url));

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

// Mark every migration EXCEPT 010 as already applied
const skip = new Set([
  '010_smart_scores_change_requests.sql',
]);

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && !skip.has(f))
  .sort();

for (const file of files) {
  await client.query(
    `INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
    [file],
  );
  console.log(`marked  ${file}`);
}

console.log('\nDone. Now run:  node migrate.js');
await client.end();
