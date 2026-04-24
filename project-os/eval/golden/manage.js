#!/usr/bin/env node
/**
 * eval/golden/manage.js — Golden dataset CLI
 *
 * Usage:
 *   node eval/golden/manage.js list
 *   node eval/golden/manage.js candidates
 *   node eval/golden/manage.js promote <candidate_id>
 *   node eval/golden/manage.js reject  <candidate_id>
 *   node eval/golden/manage.js add     <case.json>
 *   node eval/golden/manage.js import  <cases.json>   (array)
 *   node eval/golden/manage.js export                 (stdout)
 *   node eval/golden/manage.js deactivate <case_id>
 */

import 'dotenv/config'
import pg from 'pg'
import fs from 'fs'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const [,, cmd, arg] = process.argv

async function list() {
  const { rows } = await client.query(
    `SELECT id, agent, source, min_judge_score, active, created_at
     FROM golden_cases ORDER BY agent, created_at`)
  if (!rows.length) { console.log('No golden cases.'); return }
  for (const r of rows) {
    const flag = r.active ? '  ' : '[inactive] '
    console.log(`${flag}${r.id}  ${r.agent.padEnd(10)}  min=${r.min_judge_score}  src=${r.source}  ${r.created_at.toISOString().slice(0,10)}`)
  }
}

async function candidates() {
  const { rows } = await client.query(
    `SELECT gc.id, gc.agent_trace_id, gc.status, gc.created_at,
            js.score_overall, at.agent
     FROM golden_candidates gc
     JOIN agent_traces at ON at.id = gc.agent_trace_id
     LEFT JOIN judge_scores js ON js.agent_trace_id = gc.agent_trace_id
     WHERE gc.status = 'pending'
     ORDER BY js.score_overall DESC NULLS LAST`)
  if (!rows.length) { console.log('No pending candidates.'); return }
  for (const r of rows) {
    console.log(`${r.id}  trace=${r.agent_trace_id}  agent=${r.agent}  score=${r.score_overall ?? '?'}  ${r.created_at.toISOString().slice(0,10)}`)
  }
}

async function promote(candidateId) {
  const { rows } = await client.query(
    `SELECT gc.agent_trace_id, at.agent,
            js.score_overall, js.score_breakdown
     FROM golden_candidates gc
     JOIN agent_traces at ON at.id = gc.agent_trace_id
     LEFT JOIN judge_scores js ON js.agent_trace_id = gc.agent_trace_id
     WHERE gc.id = $1`, [candidateId])
  if (!rows.length) { console.error('Candidate not found:', candidateId); process.exit(1) }
  const { agent_trace_id, agent, score_overall } = rows[0]
  const { rows: inserted } = await client.query(
    `INSERT INTO golden_cases (agent, input_payload, min_judge_score, source)
     SELECT at.agent,
            jsonb_build_object('messages', '[]'::jsonb, 'trace_id', at.id),
            GREATEST(COALESCE($2::numeric, 3.5) - 0.5, 3.0),
            'promoted-from-prod'
     FROM agent_traces at WHERE at.id = $1
     RETURNING id`,
    [agent_trace_id, score_overall])
  await client.query(
    `UPDATE golden_candidates SET status = 'promoted' WHERE id = $1`,
    [candidateId])
  console.log(`Promoted → golden_case ${inserted[0].id}  (agent=${agent}, score=${score_overall})`)
}

async function reject(candidateId) {
  const { rowCount } = await client.query(
    `UPDATE golden_candidates SET status = 'rejected' WHERE id = $1`, [candidateId])
  if (!rowCount) { console.error('Candidate not found:', candidateId); process.exit(1) }
  console.log(`Rejected candidate ${candidateId}`)
}

async function addCase(filepath) {
  const raw = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  const { agent, input_payload, min_judge_score = 3.5, source = 'hand-curated' } = raw
  if (!agent || !input_payload) { console.error('Case must have agent and input_payload'); process.exit(1) }
  const { rows } = await client.query(
    `INSERT INTO golden_cases (agent, input_payload, min_judge_score, source)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [agent, JSON.stringify(input_payload), min_judge_score, source])
  console.log(`Added golden case ${rows[0].id}  (agent=${agent})`)
}

async function importCases(filepath) {
  const cases = JSON.parse(fs.readFileSync(filepath, 'utf8'))
  if (!Array.isArray(cases)) { console.error('Expected a JSON array'); process.exit(1) }
  let count = 0
  for (const c of cases) {
    const { agent, input_payload, min_judge_score = 3.5, source = 'hand-curated' } = c
    if (!agent || !input_payload) { console.warn('Skipping invalid entry:', JSON.stringify(c).slice(0,80)); continue }
    await client.query(
      `INSERT INTO golden_cases (agent, input_payload, min_judge_score, source)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [agent, JSON.stringify(input_payload), min_judge_score, source])
    count++
  }
  console.log(`Imported ${count} / ${cases.length} cases`)
}

async function exportCases() {
  const { rows } = await client.query(
    `SELECT agent, input_payload, min_judge_score, source FROM golden_cases WHERE active = true`)
  process.stdout.write(JSON.stringify(rows, null, 2) + '\n')
}

async function deactivate(caseId) {
  const { rowCount } = await client.query(
    `UPDATE golden_cases SET active = false WHERE id = $1`, [caseId])
  if (!rowCount) { console.error('Case not found:', caseId); process.exit(1) }
  console.log(`Deactivated golden case ${caseId}`)
}

async function seed(dir) {
  const target = dir ?? new URL('./cases', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
  const files  = fs.readdirSync(target).filter(f => f.endsWith('.json'))
  let count = 0
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(`${target}/${file}`, 'utf8'))
    const { agent, input_payload, min_judge_score = 3.5, source = 'hand-curated' } = raw
    if (!agent || !input_payload) { console.warn('Skipping invalid:', file); continue }
    await client.query(
      `INSERT INTO golden_cases (agent, input_payload, min_judge_score, source)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [agent, JSON.stringify(input_payload), min_judge_score, source])
    console.log(`  seeded ${file}  (agent=${agent})`)
    count++
  }
  console.log(`\nSeeded ${count} / ${files.length} cases`)
}

const COMMANDS = { list, candidates, promote, reject, add: addCase, import: importCases, export: exportCases, deactivate, seed }

if (!cmd || !COMMANDS[cmd]) {
  console.error(`Usage: manage.js <${Object.keys(COMMANDS).join('|')}> [arg]`)
  process.exit(1)
}

await COMMANDS[cmd](arg)
await client.end()
