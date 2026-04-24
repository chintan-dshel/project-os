#!/usr/bin/env node
/**
 * eval/golden/run.js — Golden dataset CI gate
 *
 * Runs every active golden case against the current model, scores with the
 * production judge, stores results in golden_runs, then exits 0 (all pass)
 * or 1 (any fail).
 *
 * Usage:
 *   node eval/golden/run.js                   run all active cases
 *   node eval/golden/run.js --agent intake    run only intake cases
 *   node eval/golden/run.js --dry-run         score but don't persist to DB
 */

import 'dotenv/config'
import pg from 'pg'
import { randomUUID } from 'crypto'

import { callClaude, extractJSON } from '../../src/lib/anthropic.js'
import { scoreAgentResponse }      from '../../src/lib/judge.js'
import { buildSystemPrompt as buildIntakePrompt }    from '../../src/lib/intake.agent.js'
import { buildSystemPrompt as buildPlanningPrompt }  from '../../src/lib/planning.agent.js'
import { buildSystemPrompt as buildExecutionPrompt } from '../../src/lib/execution.agent.js'
import { buildMilestoneRetroPrompt, buildShipRetroPrompt } from '../../src/lib/retro.agent.js'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const args      = process.argv.slice(2)
const agentFilter = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : null
const dryRun    = args.includes('--dry-run')
const runId     = randomUUID()

// ── System prompt builders ────────────────────────────────────────────────────

function buildSystemPrompt(agent, payload) {
  const { project, state, retro_type, milestone_name } = payload
  switch (agent) {
    case 'intake':    return buildIntakePrompt(project)
    case 'planning':  return buildPlanningPrompt(project, [])
    case 'execution': return buildExecutionPrompt(project, state, [])
    case 'retro':
      return retro_type === 'ship'
        ? buildShipRetroPrompt(project, state)
        : buildMilestoneRetroPrompt(project, state, milestone_name ?? 'Current Milestone')
    default:
      throw new Error(`Unknown agent: ${agent}`)
  }
}

// ── Judge scoring wrapper that doesn't write to agent_traces ─────────────────
// Golden run judge scores go into golden_runs directly, not judge_scores.

async function runJudge(agent, input, output, rubricVersion) {
  const { scoreAgentResponse: _score } = await import('../../src/lib/judge.js')

  // Call the judge directly via the rubric builders in eval/judge/*
  const { buildJudgePrompt } = await import(`../judge/${agent}.js`)
  const judgeInput = buildJudgePromptForRuntime(buildJudgePrompt, agent, input, output)
  if (!judgeInput) return null

  const { text } = await callClaude({
    system:   judgeInput.system,
    messages: [{ role: 'user', content: judgeInput.userMessage }],
    meta:     { agent: '__judge__' },
  })
  const parsed = extractJSON(text)
  if (!parsed?.overall?.score) return null
  return parsed.overall.score
}

function buildJudgePromptForRuntime(builderFn, agent, input, output) {
  const lastUserMsg = [...input.messages].reverse().find(m => m.role === 'user')?.content ?? ''
  const fakeFixture = { userMessage: lastUserMsg, history: input.messages.slice(0, -1) ?? [], project: input.project ?? {}, state: input.state ?? {} }
  try {
    return builderFn(fakeFixture, output)
  } catch {
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { rows: cases } = await client.query(
  `SELECT id, agent, input_payload, min_judge_score
   FROM golden_cases
   WHERE active = true
   ${agentFilter ? `AND agent = '${agentFilter.replace(/'/g,'')}'` : ''}
   ORDER BY agent, created_at`)

if (!cases.length) {
  console.log(`No active golden cases${agentFilter ? ` for agent "${agentFilter}"` : ''}.`)
  await client.end()
  process.exit(0)
}

const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
console.log(`\nGolden Eval — ${timestamp}   run_id: ${runId}`)
console.log(`Cases: ${cases.length}   dry-run: ${dryRun}`)
console.log('─'.repeat(72))

let passed = 0, failed = 0

for (const c of cases) {
  const payload = c.input_payload
  process.stdout.write(`  ${c.agent.padEnd(10)} case=${c.id} ... `)

  let judgeScore = null
  let actualOutput = null
  let ok = false

  try {
    const system   = buildSystemPrompt(c.agent, payload)
    const messages = payload.messages ?? []

    const { text } = await callClaude({ system, messages, max_tokens: 4096, meta: { agent: c.agent } })
    actualOutput = text

    judgeScore = await runJudge(c.agent, { system, messages, ...payload }, text, `${c.agent}-v1`)
    ok = judgeScore !== null && judgeScore >= c.min_judge_score
  } catch (err) {
    console.log(`ERROR: ${err.message}`)
    failed++
    continue
  }

  const passStr = ok ? 'PASS' : 'FAIL'
  console.log(`${passStr}  score=${judgeScore?.toFixed(2) ?? '?'}  min=${c.min_judge_score}`)

  if (!dryRun) {
    await client.query(
      `INSERT INTO golden_runs
         (run_id, case_id, model, actual_output, judge_score, passed)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [runId, c.id, 'claude-sonnet-4-20250514', actualOutput?.slice(0, 4000) ?? '', judgeScore, ok])
  }

  if (ok) passed++; else failed++
}

console.log('─'.repeat(72))
console.log(`${passed} passed  ${failed} failed   run_id: ${runId}`)
console.log('')

await client.end()
process.exit(failed > 0 ? 1 : 0)
