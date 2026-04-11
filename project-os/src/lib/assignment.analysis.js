/**
 * lib/assignment.analysis.js
 *
 * Analyses a project's unassigned TODO tasks and suggests which registry
 * agent (if any) should handle each one.
 *
 * Called:
 *   - POST /projects/:id/assignments/analyze  (on demand)
 *   - Fire-and-forget after execution agent check-in
 */

import { callClaude } from './anthropic.js'
import { query }      from '../db/pool.js'

const ANALYSIS_COOLDOWN_MINUTES = 5   // fire-and-forget cooldown only

// ── Fetch unassigned tasks (todo + in_progress) ───────────────────────────────

async function getUnassignedTasks(projectId) {
  const { rows } = await query(
    `SELECT t.id, t.task_key, t.title, t.description, t.priority, t.estimated_hours, t.status
     FROM tasks t
     WHERE t.project_id = $1
       AND t.status IN ('todo', 'in_progress')
       AND t.task_key NOT IN (
         SELECT task_key FROM agent_assignments
         WHERE project_id = $1
           AND status NOT IN ('rejected')
       )`,
    [projectId]
  )
  return rows
}

// ── Fetch active registry agents ──────────────────────────────────────────────

async function getActiveAgents() {
  const { rows } = await query(
    `SELECT id, slug, name, description, output_format FROM agent_registry WHERE is_active = TRUE ORDER BY created_at ASC`
  )
  return rows
}

// ── Check cooldown ────────────────────────────────────────────────────────────

async function isOnCooldown(projectId) {
  const { rows } = await query(
    `SELECT last_assignment_analysis_at FROM projects WHERE id = $1`,
    [projectId]
  )
  const lastAt = rows[0]?.last_assignment_analysis_at
  if (!lastAt) return false
  const mins = (Date.now() - new Date(lastAt)) / 60000
  return mins < ANALYSIS_COOLDOWN_MINUTES
}

async function markAnalyzed(projectId) {
  await query(
    `UPDATE projects SET last_assignment_analysis_at = now() WHERE id = $1`,
    [projectId]
  )
}

// ── Claude analysis call ──────────────────────────────────────────────────────

async function analyseWithClaude(tasks, agents) {
  const agentDescriptions = agents.map(a =>
    `- slug: "${a.slug}" | name: "${a.name}" | description: "${a.description}"`
  ).join('\n')

  const taskDescriptions = tasks.map(t =>
    `- task_key: "${t.task_key}" | title: "${t.title}" | description: "${t.description ?? 'not provided'}" | priority: "${t.priority}" | est_hours: ${t.estimated_hours ?? '?'}`
  ).join('\n')

  const system = `You are a project management assistant. Given a list of tasks and a list of AI specialist agents, determine which agent (if any) is best suited to handle each task.

Rules:
- Only suggest an agent if the task is genuinely suitable for AI assistance (coding, research, content creation, QA review)
- Tasks that require founder judgment, stakeholder decisions, human relationships, or real-world actions should be "assigned_to_user"
- Be conservative — if you're unsure, assign to user
- Match output format to what the task actually needs (coding tasks → coding agent, research → research agent, etc.)
- Write the suggested_prompt as the actual brief the agent will receive — specific, actionable, with enough context
- Keep analysis_reason to 1 sentence explaining why

You MUST respond with ONLY a JSON array, no prose. Example:
[
  {"task_key": "task_1", "registry_slug": "coding", "suggested_prompt": "Write a...", "analysis_reason": "Requires code implementation."},
  {"task_key": "task_2", "assigned_to_user": true, "analysis_reason": "Requires founder's personal network."}
]`

  const userMessage = `Available agents:\n${agentDescriptions}\n\nTasks to analyse:\n${taskDescriptions}\n\nReturn JSON array only.`

  const { text } = await callClaude({
    system,
    messages: [{ role: 'user', content: userMessage }],
    max_tokens: 2048,
  })

  // Extract JSON array
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Claude did not return a valid JSON array')
  return JSON.parse(match[0])
}

// ── Write assignments to DB ───────────────────────────────────────────────────

async function writeAssignments(projectId, analysisResults, tasks, agents) {
  const taskMap  = Object.fromEntries(tasks.map(t => [t.task_key, t]))
  const agentMap = Object.fromEntries(agents.map(a => [a.slug, a]))
  const created  = []

  for (const result of analysisResults) {
    const task = taskMap[result.task_key]
    if (!task) continue

    if (result.assigned_to_user) {
      const { rows } = await query(
        `INSERT INTO agent_assignments
           (project_id, task_id, task_key, status, analysis_reason)
         VALUES ($1, $2, $3, 'assigned_to_user'::assignment_status, $4)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [projectId, task.id, result.task_key, result.analysis_reason ?? null]
      )
      if (rows[0]) created.push(rows[0])
    } else if (result.registry_slug) {
      const agent = agentMap[result.registry_slug]
      if (!agent) continue
      const { rows } = await query(
        `INSERT INTO agent_assignments
           (project_id, task_id, task_key, registry_agent_id, suggested_prompt, status, analysis_reason)
         VALUES ($1, $2, $3, $4, $5, 'pending_review'::assignment_status, $6)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [projectId, task.id, result.task_key, agent.id, result.suggested_prompt ?? null, result.analysis_reason ?? null]
      )
      if (rows[0]) created.push(rows[0])
    }
  }

  return created
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * @param {string} projectId
 * @param {{ force?: boolean }} [opts]  force=true bypasses cooldown (use for manual triggers)
 */
export async function triggerAssignmentAnalysis(projectId, { force = false } = {}) {
  if (!force && await isOnCooldown(projectId)) {
    console.log(`[assignments] Skipping analysis for ${projectId} — on cooldown`)
    return { skipped: true }
  }

  const [tasks, agents] = await Promise.all([
    getUnassignedTasks(projectId),
    getActiveAgents(),
  ])

  if (tasks.length === 0) {
    console.log(`[assignments] No unassigned tasks for ${projectId}`)
    return { created: [], reason: 'no_unassigned_tasks' }
  }

  if (agents.length === 0) {
    console.log(`[assignments] No active agents for ${projectId}`)
    return { created: [], reason: 'no_active_agents' }
  }

  console.log(`[assignments] Analysing ${tasks.length} tasks for ${projectId}`)

  const analysisResults = await analyseWithClaude(tasks, agents)
  const created         = await writeAssignments(projectId, analysisResults, tasks, agents)

  await markAnalyzed(projectId)

  console.log(`[assignments] Created ${created.length} assignments for ${projectId}`)
  return { created }
}
