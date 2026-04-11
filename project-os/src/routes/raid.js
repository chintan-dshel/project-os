/**
 * routes/raid.js — RAID Log management
 *
 * Risks → Assumptions → Issues → Decisions → Actions
 *
 * PATCH /projects/:id/raid/risks/:riskId          — update risk status/fields
 * POST  /projects/:id/raid/risks/:riskId/materialise — risk becomes an issue
 * POST  /projects/:id/raid/issues/:riskId/decide  — create decision from issue
 * POST  /projects/:id/raid/issues/:riskId/action  — create task from issue
 * POST  /projects/:id/raid/decisions              — create manual decision
 * POST  /projects/:id/raid/risks                  — create manual risk/assumption
 */

import { Router } from 'express'
import { query }  from '../db/pool.js'
import { badRequest, notFound } from '../middleware/errors.js'
import { populateFromDecision } from '../lib/knowledge.js'

const router = Router({ mergeParams: true })

// Guard: check if migration 003 columns exist before using them
async function hasEntryTypeColumn() {
  try {
    await query(`SELECT entry_type FROM risk_register LIMIT 0`)
    return true
  } catch { return false }
}

// ── Update risk status / fields ───────────────────────────────────────────────
router.patch('/risks/:riskId', async (req, res, next) => {
  try {
    const { id: projectId, riskId } = req.params
    const { status, mitigation, contingency, owner, entry_type } = req.body ?? {}

    const { rows: [existing] } = await query(
      `SELECT id FROM risk_register WHERE id = $1 AND project_id = $2`, [riskId, projectId]
    )
    if (!existing) throw notFound('Risk not found')

    const VALID_STATUSES = ['open', 'mitigated', 'accepted', 'closed', 'materialised']
    if (status && !VALID_STATUSES.includes(status)) throw badRequest(`Invalid status: ${status}`)

    const sets = ['updated_at = now()']
    const vals = [projectId, riskId]

    if (status)      { sets.push(`status = $${vals.length+1}::risk_status`); vals.push(status) }
    if (mitigation)  { sets.push(`mitigation = $${vals.length+1}`); vals.push(mitigation) }
    if (contingency) { sets.push(`contingency = $${vals.length+1}`); vals.push(contingency) }
    if (owner)       { sets.push(`owner = $${vals.length+1}::risk_owner`); vals.push(owner) }
    if (entry_type && ['risk','assumption'].includes(entry_type)) {
      sets.push(`entry_type = $${vals.length+1}`)
      vals.push(entry_type)
    }

    const { rows } = await query(
      `UPDATE risk_register SET ${sets.join(', ')} WHERE project_id = $1 AND id = $2 RETURNING *`,
      vals
    )
    return res.json({ risk: rows[0] })
  } catch (err) { next(err) }
})

// ── Materialise a risk → issue ────────────────────────────────────────────────
// The moment the risk became real. Captures what actually happened.
router.post('/risks/:riskId/materialise', async (req, res, next) => {
  try {
    const { id: projectId, riskId } = req.params
    const { issue_description } = req.body ?? {}

    if (!issue_description?.trim()) throw badRequest('issue_description is required')

    const { rows: [risk] } = await query(
      `SELECT * FROM risk_register WHERE id = $1 AND project_id = $2`, [riskId, projectId]
    )
    if (!risk) throw notFound('Risk not found')

    // Try materialised status (requires migration 003 to have run)
    // Fall back to 'closed' if enum value doesn't exist yet
    let rows
    try {
      const result = await query(
        `UPDATE risk_register
         SET status = 'materialised'::risk_status,
             issue_description = $3,
             materialised_at = now(),
             updated_at = now()
         WHERE id = $1 AND project_id = $2
         RETURNING *`,
        [riskId, projectId, issue_description.trim()]
      )
      rows = result.rows
    } catch (enumErr) {
      // Migration 003 not run — use 'closed' as fallback
      const result = await query(
        `UPDATE risk_register
         SET status = 'closed'::risk_status,
             updated_at = now()
         WHERE id = $1 AND project_id = $2
         RETURNING *`,
        [riskId, projectId]
      )
      rows = result.rows
    }
    return res.json({ risk: rows[0], message: 'Risk has materialised into an issue' })
  } catch (err) { next(err) }
})

// ── Create a decision from an issue ──────────────────────────────────────────
router.post('/issues/:riskId/decide', async (req, res, next) => {
  try {
    const { id: projectId, riskId } = req.params
    const { decision, rationale, outcome } = req.body ?? {}

    if (!decision?.trim()) throw badRequest('decision is required')

    // Accept risks in either 'materialised' or 'closed' status (migration 003 fallback)
    const { rows: [issue] } = await query(
      `SELECT * FROM risk_register WHERE id = $1 AND project_id = $2 AND status IN ('materialised','closed')`,
      [riskId, projectId]
    )
    if (!issue) throw notFound('Issue not found (open a risk row first to materialise it)')

    const { rows: [proj] } = await query(
      `SELECT title FROM projects WHERE id = $1 LIMIT 1`, [projectId]
    ).catch(() => ({ rows: [{}] }))

    const { rows } = await query(
      `INSERT INTO decision_log (project_id, decision, rationale, outcome, source_risk_id, decided_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [projectId, decision.trim(), rationale ?? null, outcome ?? null, riskId]
    )

    // Auto-populate knowledge hub (fire-and-forget)
    populateFromDecision(projectId, proj?.title ?? null, rows[0])
      .catch(() => {})

    // Resolve the issue now that a decision has been made
    await query(
      `UPDATE risk_register SET status = 'closed'::risk_status, updated_at = now() WHERE id = $1`,
      [riskId]
    ).catch(() => {})

    return res.json({ decision: rows[0] })
  } catch (err) { next(err) }
})

// ── Create an action (task) from an issue ─────────────────────────────────────
router.post('/issues/:riskId/action', async (req, res, next) => {
  try {
    const { id: projectId, riskId } = req.params
    const { milestone_id, title, description, estimated_hours, priority } = req.body ?? {}

    if (!title?.trim()) throw badRequest('title is required')
    if (!milestone_id)  throw badRequest('milestone_id is required — which milestone does this action belong to?')

    const { rows: [issue] } = await query(
      `SELECT * FROM risk_register WHERE id = $1 AND project_id = $2 AND status = 'materialised'`,
      [riskId, projectId]
    )
    if (!issue) throw notFound('Issue not found')

    // Generate a task_key
    const taskKey = `action_${Date.now()}`

    const { rows } = await query(
      `INSERT INTO tasks
         (project_id, milestone_id, task_key, title, description,
          estimated_hours, priority, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7::priority_level, 'todo'::task_status, $8)
       RETURNING *`,
      [projectId, milestone_id, taskKey, title.trim(), description ?? null,
       estimated_hours ?? null, priority ?? 'high',
       `Action created from issue: ${issue.issue_description ?? issue.description}`]
    )

    return res.json({ task: rows[0] })
  } catch (err) { next(err) }
})

// ── Create manual decision ────────────────────────────────────────────────────
router.post('/decisions', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const { decision, rationale, outcome, source_risk_id } = req.body ?? {}

    if (!decision?.trim()) throw badRequest('decision is required')

    const { rows: [proj] } = await query(
      `SELECT title FROM projects WHERE id = $1 LIMIT 1`, [projectId]
    ).catch(() => ({ rows: [{}] }))

    const { rows } = await query(
      `INSERT INTO decision_log (project_id, decision, rationale, outcome, source_risk_id, decided_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [projectId, decision.trim(), rationale ?? null, outcome ?? null, source_risk_id ?? null]
    )

    // Auto-populate knowledge hub (fire-and-forget)
    populateFromDecision(projectId, proj?.title ?? null, rows[0])
      .catch(() => {})

    return res.json({ decision: rows[0] })
  } catch (err) { next(err) }
})

// ── Create manual risk or assumption ─────────────────────────────────────────
router.post('/risks', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const {
      entry_type = 'risk', description, likelihood = 'medium', impact = 'medium',
      risk_score, mitigation, contingency, owner = 'founder'
    } = req.body ?? {}

    if (!description?.trim()) throw badRequest('description is required')
    if (!['risk','assumption'].includes(entry_type)) throw badRequest('entry_type must be risk or assumption')

    const score = risk_score ?? ({'low':1,'medium':3,'high':6}[likelihood] * {'low':1,'medium':2,'high':3}[impact])
    const desc  = entry_type === 'assumption' && !description.startsWith('ASSUMPTION:')
      ? `ASSUMPTION: ${description.trim()}`
      : description.trim()

    const useEntryType = await hasEntryTypeColumn()
    const { rows } = useEntryType
      ? await query(
          `INSERT INTO risk_register
             (project_id, entry_type, description, likelihood, impact, risk_score,
              mitigation, contingency, owner, status, source_agent)
           VALUES ($1,$2,$3,$4::risk_likelihood,$5::risk_impact,$6,$7,$8,$9::risk_owner,'open',null)
           RETURNING *`,
          [projectId, entry_type, desc, likelihood, impact, score, mitigation ?? null, contingency ?? null, owner]
        )
      : await query(
          `INSERT INTO risk_register
             (project_id, description, likelihood, impact, risk_score,
              mitigation, contingency, owner, status, source_agent)
           VALUES ($1,$2,$3::risk_likelihood,$4::risk_impact,$5,$6,$7,$8::risk_owner,'open',null)
           RETURNING *`,
          [projectId, desc, likelihood, impact, score, mitigation ?? null, contingency ?? null, owner]
        )
    return res.json({ risk: rows[0] })
  } catch (err) { next(err) }
})

export default router
