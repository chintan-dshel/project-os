#!/usr/bin/env node
/**
 * scripts/setup-test-db.js
 *
 * Idempotent: creates the test database if it doesn't exist, then runs all
 * pending migrations against it.
 *
 * Usage:
 *   npm run test:db:setup
 *   node scripts/setup-test-db.js
 *
 * Reads TEST_DATABASE_URL from .env (or environment).
 * Refuses to run if TEST_DATABASE_URL === DATABASE_URL (safety guard).
 */

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { Client } = pg;

const TEST_URL = process.env.TEST_DATABASE_URL;
const PROD_URL = process.env.DATABASE_URL;

if (!TEST_URL) {
  console.error('ERROR: TEST_DATABASE_URL is not set. Add it to .env (see .env.example).');
  process.exit(1);
}

if (TEST_URL === PROD_URL) {
  console.error('ERROR: TEST_DATABASE_URL must differ from DATABASE_URL. Refusing to run against prod DB.');
  process.exit(1);
}

// Parse the test DB name from the URL so we can CREATE DATABASE if needed.
const parsed = new URL(TEST_URL);
const testDbName = parsed.pathname.replace(/^\//, '');

if (!testDbName) {
  console.error('ERROR: Could not parse database name from TEST_DATABASE_URL.');
  process.exit(1);
}

console.log(`Test DB: ${testDbName} on ${parsed.host}`);
console.log('Prod DB differs: ✓');

// Connect to the postgres maintenance DB to create the test DB.
const adminUrl = new URL(TEST_URL);
adminUrl.pathname = '/postgres';

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();

const { rows } = await admin.query(
  `SELECT 1 FROM pg_database WHERE datname = $1`,
  [testDbName],
);

if (rows.length > 0) {
  console.log(`Database "${testDbName}" already exists — skipping CREATE.`);
} else {
  // Identifiers cannot be parameterised in DDL — testDbName is parsed from a URL we control.
  await admin.query(`CREATE DATABASE "${testDbName}"`);
  console.log(`Created database "${testDbName}".`);
}

await admin.end();

// Apply base schema if not yet applied (fresh DB has no projects table).
const testClient = new Client({ connectionString: TEST_URL });
await testClient.connect();

const { rows: tableRows } = await testClient.query(
  `SELECT 1 FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'projects'`,
);

if (tableRows.length === 0) {
  console.log('\nApplying base schema (schema.sql)…');
  const schemaPath = path.resolve(__dirname, '../../schema.sql');
  let schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // schema.sql uses `ADD CONSTRAINT IF NOT EXISTS` which is not valid PostgreSQL syntax.
  // On a fresh DB there are no pre-existing constraints, so we can safely drop the IF NOT EXISTS.
  schemaSql = schemaSql.replace(/ADD CONSTRAINT IF NOT EXISTS/gi, 'ADD CONSTRAINT');

  for (const stmt of splitStatements(schemaSql)) {
    await testClient.query(stmt);
  }
  console.log('Base schema applied ✓');
} else {
  console.log('\nBase schema already present — skipping.');
}

await testClient.end();

// Run migrations against the test DB.
console.log('\nRunning migrations…');
execSync(`node run_migration.js`, {
  env: { ...process.env, DATABASE_URL: TEST_URL },
  stdio: 'inherit',
  cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'),
});

console.log('\nTest DB ready.');

// ── SQL splitter (handles dollar-quoted blocks, single-quoted strings, -- comments) ──
function splitStatements(sql) {
  const stmts = [];
  let current = '', inString = false, inDollar = false, dollarTag = '', i = 0;
  while (i < sql.length) {
    const ch = sql[i], ch2 = sql[i + 1];
    if (inDollar) {
      const slice = sql.slice(i, i + dollarTag.length);
      if (ch === '$' && slice === dollarTag) {
        current += dollarTag; i += dollarTag.length; inDollar = false; dollarTag = '';
      } else { current += ch; i++; }
    } else if (inString) {
      if (ch === "'" && ch2 === "'") { current += "''"; i += 2; }
      else if (ch === "'") { inString = false; current += "'"; i++; }
      else { current += ch; i++; }
    } else {
      if (ch === '$') {
        let j = i + 1;
        while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
        if (j < sql.length && sql[j] === '$') {
          dollarTag = sql.slice(i, j + 1); current += dollarTag; i = j + 1; inDollar = true;
        } else { current += ch; i++; }
      } else if (ch === "'") { inString = true; current += "'"; i++; }
      else if (ch === '-' && ch2 === '-') { while (i < sql.length && sql[i] !== '\n') i++; }
      else if (ch === ';') { const s = current.trim(); if (s) stmts.push(s); current = ''; i++; }
      else { current += ch; i++; }
    }
  }
  const last = current.trim();
  if (last) stmts.push(last);
  return stmts;
}
