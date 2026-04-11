/**
 * retro.agent.js — full implementation
 * Milestone retro + ship retro + project close + archive
 */

import { callClaude, extractJSON }   from './anthropic.js';
import { query, transaction }        from '../db/pool.js';
import { populateFromRetro }         from './knowledge.js';

function buildMilestoneRetroPrompt(project, state, milestoneName) {
  const milestones = state?.phases?.flatMap(p => p.milestones ?? []) ?? []
  const ms         = milestones.find(m => m.title === milestoneName) ?? milestones[0] ?? {}
  const tasks      = ms.tasks ?? []
  const done       = tasks.filter(t => t.status === 'done').length
  const total      = tasks.length
  const estimated  = tasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0)
  const actual     = tasks.reduce((s, t) => s + (t.actual_hours ?? 0), 0)
  const variance   = actual > 0 ? (actual - estimated > 0 ? `+${(actual-estimated).toFixed(1)}h over` : `${(actual-estimated).toFixed(1)}h under`) : 'not logged'

  return `You are the Retro Agent for a solo founder AI project management system.
You are running a MILESTONE RETROSPECTIVE for: "${milestoneName}"

## MILESTONE DATA
Tasks: ${done}/${total} completed
Hours estimated: ${estimated}h | Actual: ${actual > 0 ? actual + 'h' : 'not logged'} | Variance: ${variance}

## PROJECT
Title: ${project.title}
Problem: ${project.core_problem ?? 'not set'}

## YOUR RULES
- Ask ONE question at a time. Wait for the answer before asking the next.
- Be specific — reference the milestone name and actual numbers.
- Be warm and direct. This is a debrief, not a form.

## THREE QUESTIONS (in order)
Q1: "What did you actually deliver in '${milestoneName}'? Walk me through it — what's working and testable right now?"
Q2: "What created the most friction on this milestone? Be specific — was it the task, the estimate, a dependency, or something about how you worked?"
Q3: "One thing you'd do differently on the next milestone?"

## FIRST MESSAGE RULE — CRITICAL
If the conversation history is empty or has only a short trigger message:
IMMEDIATELY ask Q1. Do not explain yourself. Do not say "let's begin". Just ask the question.

## WHEN DONE
Once you have meaningful answers to all three, output this JSON then your closing message:

\`\`\`json
{
  "retro_complete": {
    "type": "milestone_retro",
    "milestone_name": "${milestoneName}",
    "what_worked": "",
    "what_created_friction": "",
    "what_would_you_change": "",
    "patterns_detected": [],
    "estimated_hours": ${estimated},
    "actual_hours": ${actual > 0 ? actual : 'null'},
    "tasks_planned": ${total},
    "tasks_completed": ${done},
    "forward_feed": [
      {"feed_type": "estimate_adjustment", "content": "specific adjustment for next milestone"},
      {"feed_type": "behavioral_nudge", "content": "one concrete nudge based on what you learned"}
    ],
    "advance_stage": "execution",
    "closing_message": "2 sentences: acknowledge what was learned, then say the board is unlocked for the next milestone."
  }
}
\`\`\`

Only the closing_message content appears to the user. Strip the JSON from your visible reply.

## MEMORY — CRITICAL
Read the full conversation history before every response. Never re-ask a question already answered.
If all three answers exist in history, output the JSON immediately.`
}

function buildShipRetroPrompt(project, state) {
  const allTasks  = (state?.phases ?? []).flatMap(p => p.milestones ?? []).flatMap(m => m.tasks ?? [])
  const done      = allTasks.filter(t => t.status === 'done').length
  const total     = allTasks.length
  const estimated = allTasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0)
  const actual    = allTasks.reduce((s, t) => s + (t.actual_hours ?? 0), 0)
  const criteria  = (project.success_criteria ?? []).map(s => typeof s === 'string' ? s : s.criterion)
  const outScope  = (project.scope_items ?? []).filter(s => !s.in_scope).map(s => s.description)
  const openRisks = (state?.risk_register ?? []).filter(r => r.status === 'open' && !r.description?.startsWith('ASSUMPTION:'))

  const scorecardTemplate = criteria.map(c =>
    `{"criterion_text": "${c.replace(/"/g, "'")}", "outcome": "met", "contributing_factors": "", "what_would_change_it": ""}`
  ).join(',\n      ')

  const backlogTemplate = outScope.map(s =>
    `{"description": "${s.replace(/"/g, "'")}", "source": "out_of_scope"}`
  ).join(',\n      ')

  return `You are the Retro Agent for a solo founder AI project management system.
You are running the FINAL SHIP RETROSPECTIVE for: "${project.title}"

## FULL PROJECT SUMMARY
Tasks completed: ${done}/${total}
Hours: ${estimated}h estimated | ${actual > 0 ? actual + 'h' : 'not fully logged'} actual
Success criteria: ${criteria.length > 0 ? criteria.join(' · ') : 'none defined'}
Deferred to v2: ${outScope.length > 0 ? outScope.join(', ') : 'nothing'}
Open risks at close: ${openRisks.length}

## FIVE QUESTIONS (one at a time)
Q1: "You've shipped ${project.title}. Walk me through what you actually built — what does a user get right now?"
Q2: "Against your success criteria${criteria[0] ? ` (${criteria[0]})` : ''} — where did you land? Be honest."
Q3: "What was the single biggest thing that slowed you down across the whole project?"
Q4: "What's the most important thing you learned about yourself as a builder?"
Q5: "What's going in the v2 backlog beyond the items I already have deferred?"

## FIRST MESSAGE RULE — CRITICAL
Ask Q1 immediately if history is empty or has only a trigger message.

## WHEN DONE — output JSON then closing message

\`\`\`json
{
  "retro_complete": {
    "type": "ship_retro",
    "what_worked": "",
    "what_created_friction": "",
    "what_would_you_change": "",
    "founder_growth_read": "",
    "patterns_detected": [],
    "estimated_hours": ${estimated},
    "actual_hours": ${actual > 0 ? actual : 'null'},
    "tasks_planned": ${total},
    "tasks_completed": ${done},
    "scorecard": [
      ${scorecardTemplate || '{"criterion_text": "success criteria", "outcome": "met", "contributing_factors": "", "what_would_change_it": ""}'}
    ],
    "v2_backlog": [
      ${backlogTemplate || '{"description": "item", "source": "parked_idea"}'}
    ],
    "forward_feed": [
      {"feed_type": "estimate_adjustment", "content": "calibration for next project"},
      {"feed_type": "behavioral_nudge", "content": "key behavioural insight"}
    ],
    "advance_stage": "complete",
    "closing_message": "3-4 sentences. Celebrate specifically. Give the honest growth read. End forward-looking. Tell them the project is now archived."
  }
}
\`\`\`

Only the closing_message appears to the user.

## MEMORY — CRITICAL
Never re-ask answered questions. If all 5 answers are in history, output the JSON now.`
}

async function writeRetroToDB(project, retro, state) {
  const projectId   = project.id
  const projectName = project.title ?? null
  const {
    type, milestone_name,
    what_worked, what_created_friction, what_would_you_change,
    founder_growth_read, patterns_detected = [],
    estimated_hours, actual_hours, tasks_planned, tasks_completed,
    scorecard = [], v2_backlog = [], forward_feed = [],
    advance_stage,
  } = retro

  await transaction(async (client) => {
    // Find milestone id
    let milestoneId = null
    if (type === 'milestone_retro' && milestone_name) {
      const { rows } = await client.query(
        `SELECT m.id FROM milestones m
         JOIN phases ph ON ph.id = m.phase_id
         WHERE ph.project_id = $1 AND m.title = $2
         LIMIT 1`,
        [projectId, milestone_name],
      )
      milestoneId = rows[0]?.id ?? null
      if (milestoneId) {
        await client.query(
          `UPDATE milestones SET completed_at = now() WHERE id = $1 AND completed_at IS NULL`,
          [milestoneId],
        )
      }
    }

    // Insert retro
    const { rows: retroRows } = await client.query(
      `INSERT INTO retrospectives
         (project_id, milestone_id, retro_type,
          what_worked, what_created_friction, what_would_you_change,
          founder_growth_read, patterns_detected,
          estimated_hours, actual_hours, tasks_planned, tasks_completed)
       VALUES ($1,$2,$3::retro_type,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        projectId, milestoneId, type,
        what_worked ?? '', what_created_friction ?? '', what_would_you_change ?? '',
        founder_growth_read ?? null,
        JSON.stringify(patterns_detected),
        estimated_hours ?? null, actual_hours ?? null,
        tasks_planned ?? null, tasks_completed ?? null,
      ],
    )
    const retroId = retroRows[0].id

    // Forward feed
    for (const ff of forward_feed) {
      if (!ff.content) continue
      await client.query(
        `INSERT INTO retro_forward_feed (retro_id, feed_type, content) VALUES ($1,$2,$3)`,
        [retroId, ff.feed_type ?? 'behavioral_nudge', ff.content],
      ).catch(() => {})
    }

    // Scorecard (ship retro)
    for (const sc of scorecard) {
      if (!sc.criterion_text) continue
      const validOutcomes = ['met', 'partially_met', 'not_met']
      const outcome = validOutcomes.includes(sc.outcome) ? sc.outcome : 'partially_met'
      await client.query(
        `INSERT INTO retro_scorecard
           (retro_id, criterion_text, outcome, contributing_factors, what_would_change_it)
         VALUES ($1,$2,$3::criterion_outcome,$4,$5)`,
        [retroId, sc.criterion_text, outcome, sc.contributing_factors ?? null, sc.what_would_change_it ?? null],
      ).catch(() => {})
    }

    // v2 backlog (ship retro)
    for (const item of v2_backlog) {
      if (!item.description) continue
      const validSources = ['parked_idea', 'out_of_scope', 'open_risk']
      const source = validSources.includes(item.source) ? item.source : 'parked_idea'
      await client.query(
        `INSERT INTO v2_backlog (project_id, retro_id, description, source) VALUES ($1,$2,$3,$4)`,
        [projectId, retroId, item.description, source],
      ).catch(() => {})
    }

    // Advance stage
    if (advance_stage) {
      await client.query(
        `UPDATE projects SET stage = $2::project_stage, updated_at = now() WHERE id = $1`,
        [projectId, advance_stage],
      ).catch(e => console.error('[retro] stage advance failed:', e.message))
    }

    // Archive on complete
    if (advance_stage === 'complete') {
      const archiveNote = `Archived: ${tasks_completed ?? '?'}/${tasks_planned ?? '?'} tasks, ` +
        `${actual_hours ?? '?'}h/${estimated_hours ?? '?'}h. Key learning: ${what_would_you_change ?? 'not recorded'}`
      await client.query(
        `INSERT INTO decision_log (project_id, decision, rationale, decided_at)
         VALUES ($1, 'Project archived and closed', $2, now())`,
        [projectId, archiveNote],
      ).catch(() => {})
    }
  })

  // Auto-populate knowledge hub from retro answers (fire-and-forget, non-critical)
  populateFromRetro(projectId, projectName, retro, null).catch(e =>
    console.warn('[retro] knowledge populate failed:', e.message)
  )
}

function detectMilestoneName(state) {
  const milestones = (state?.phases ?? []).flatMap(p => p.milestones ?? [])
  // Most recently completable milestone: all tasks done, not yet marked complete
  const candidate = milestones.find(m =>
    !m.completed_at &&
    (m.tasks ?? []).length > 0 &&
    (m.tasks ?? []).every(t => t.status === 'done')
  )
  return candidate?.title ?? milestones[milestones.length - 1]?.title ?? 'Current Milestone'
}

export async function runRetroAgent({ project, state, history, userMessage }) {
  const isMilestone = project.stage === 'milestone_retro'
  const isShip      = project.stage === 'ship_retro'
  const milestoneName = isMilestone ? detectMilestoneName(state) : null

  const system = isShip
    ? buildShipRetroPrompt(project, state)
    : buildMilestoneRetroPrompt(project, state, milestoneName ?? 'Current Milestone')

  const messages = [...history, { role: 'user', content: userMessage }]

  const { text, inputTokens, outputTokens } = await callClaude({
    system, messages, max_tokens: 3000,
  })

  const parsed   = extractJSON(text)
  const retroData = parsed?.retro_complete ?? null

  if (retroData && (retroData.what_worked || retroData.what_created_friction)) {
    await writeRetroToDB(project, retroData, state)
      .catch(e => console.error('[retro] DB write failed:', e.message))

    const visibleReply = retroData.closing_message ??
      text.replace(/```json[\s\S]*?```/g, '').trim()

    return {
      reply:         visibleReply,
      retrospective: retroData,
      advance_stage: retroData.advance_stage ?? null,
      inputTokens,
      outputTokens,
    }
  }

  return {
    reply: text,
    retrospective: null,
    advance_stage: null,
    inputTokens,
    outputTokens,
  }
}
