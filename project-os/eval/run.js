#!/usr/bin/env node
/**
 * eval/run.js — ProjectOS eval harness
 *
 * Usage:
 *   node eval/run.js                    run all agents, assertions only
 *   node eval/run.js --agent intake     run one agent
 *   node eval/run.js --judge            also run LLM-as-judge quality scoring
 *   node eval/run.js --agent exec --judge
 *
 * Exit code 0 = all assertions pass. Exit code 1 = one or more failures.
 */

import 'dotenv/config'
import { callClaude, extractJSON }          from '../src/lib/anthropic.js'
import { buildSystemPrompt as intakePrompt }   from '../src/lib/intake.agent.js'
import { buildSystemPrompt as planningPrompt } from '../src/lib/planning.agent.js'
import { buildSystemPrompt as execPrompt }     from '../src/lib/execution.agent.js'
import { buildMilestoneRetroPrompt, buildShipRetroPrompt } from '../src/lib/retro.agent.js'

import { fixtures as intakeFixtures }    from './fixtures/intake.js'
import { fixtures as planningFixtures }  from './fixtures/planning.js'
import { fixtures as executionFixtures } from './fixtures/execution.js'
import { fixtures as retroFixtures }     from './fixtures/retro.js'

import { assertIntake }    from './assert/intake.js'
import { assertPlanning }  from './assert/planning.js'
import { assertExecution } from './assert/execution.js'
import { assertRetro }     from './assert/retro.js'

import * as intakeJudge    from './judge/intake.js'
import * as planningJudge  from './judge/planning.js'
import * as executionJudge from './judge/execution.js'
import * as retroJudge     from './judge/retro.js'

import { printResults } from './report.js'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2)
const agentFilter = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : null
const withJudge   = args.includes('--judge')

// ── Agent definitions ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    name: 'intake',
    fixtures: intakeFixtures,
    buildPrompt: (f) => intakePrompt(f.project),
    extractOutput: (parsed) => parsed?.project_brief ?? null,
    assert: (output, fixture) => assertIntake(output),
    judge: intakeJudge,
    buildJudgeArgs: (f, output, reply) => [f, output],
  },
  {
    name: 'planning',
    fixtures: planningFixtures,
    buildPrompt: (f) => planningPrompt(f.project, []),
    extractOutput: (parsed) => parsed?.execution_plan ?? null,
    assert: (output, fixture) => assertPlanning(output, fixture),
    judge: planningJudge,
    buildJudgeArgs: (f, output, reply) => [f, output],
  },
  {
    name: 'execution',
    fixtures: executionFixtures,
    buildPrompt: (f) => execPrompt(f.project, f.state, []),
    extractOutput: (parsed) => parsed?.execution_update ?? null,
    assert: (output, fixture) => assertExecution(output, fixture),
    judge: executionJudge,
    buildJudgeArgs: (f, output, reply) => [f, output, reply],
  },
  {
    name: 'retro',
    fixtures: retroFixtures,
    buildPrompt: (f) => f.type === 'ship'
      ? buildShipRetroPrompt(f.project, f.state)
      : buildMilestoneRetroPrompt(f.project, f.state, f.milestoneName ?? 'Current Milestone'),
    extractOutput: (parsed) => parsed?.retro_complete ?? null,
    assert: (output, fixture) => assertRetro(output),
    judge: retroJudge,
    buildJudgeArgs: (f, output, reply) => [f, output],
  },
]

// ── Runner ────────────────────────────────────────────────────────────────────

async function runFixture(agent, fixture) {
  const systemPrompt = agent.buildPrompt(fixture)
  const messages = [
    ...fixture.history,
    { role: 'user', content: fixture.userMessage },
  ]

  const { text } = await callClaude({ system: systemPrompt, messages, max_tokens: 6000 })

  const parsed = extractJSON(text)
  const output = agent.extractOutput(parsed)
  const assertions = agent.assert(output, fixture)

  let judgeScores = null
  if (withJudge && output) {
    const judgeArgs = agent.buildJudgeArgs(fixture, output, text)
    const { system, userMessage } = agent.judge.buildJudgePrompt(...judgeArgs)
    const judgeResult = await callClaude({
      system,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 2000,
    })
    judgeScores = extractJSON(judgeResult.text)
  }

  return { agent: agent.name, fixture: fixture.name, assertions, judgeScores }
}

async function main() {
  const activeAgents = agentFilter
    ? AGENTS.filter(a => a.name.startsWith(agentFilter))
    : AGENTS

  if (activeAgents.length === 0) {
    console.error(`No agent matching "${agentFilter}". Options: intake, planning, execution, retro`)
    process.exit(1)
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  console.log(`\nProjectOS Eval Harness — ${timestamp}`)
  console.log(`Agents: ${activeAgents.map(a => a.name).join(', ')}  Judge: ${withJudge ? 'yes' : 'no'}`)
  console.log('─'.repeat(72))

  const allResults = []

  for (const agent of activeAgents) {
    for (const fixture of agent.fixtures) {
      process.stdout.write(`  Running ${agent.name}/${fixture.name} ... `)
      try {
        const result = await runFixture(agent, fixture)
        allResults.push(result)
        const fails = result.assertions.filter(a => !a.pass).length
        console.log(fails === 0 ? 'ok' : `${fails} FAILED`)
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
        allResults.push({
          agent: agent.name,
          fixture: fixture.name,
          assertions: [{ name: 'run_error', pass: false, detail: err.message }],
          judgeScores: null,
        })
      }
    }
  }

  console.log('─'.repeat(72))
  const exitCode = printResults(allResults, { judge: withJudge })
  console.log('')
  process.exit(exitCode)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
