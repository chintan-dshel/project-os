/**
 * routes/budgets.js
 * Per-project agent budget caps and global kill switch.
 *
 * GET    /projects/:id/budgets                  — list all budgets + current spend + kill-switch status
 * PUT    /projects/:id/budgets/:slug            — upsert budget for agent slug
 * GET    /projects/:id/budgets/kill-switch      — kill-switch status
 * POST   /projects/:id/budgets/kill-switch      — pause all agents on this project
 * DELETE /projects/:id/budgets/kill-switch      — resume all agents
 */

import { Router } from 'express'
import { query }  from '../db/pool.js'
import { badRequest } from '../middleware/errors.js'

const router = Router({ mergeParams: true })

// ── GET /budgets ───────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { id: projectId } = req.params

    const { rows: budgets } = await query(
      `SELECT pab.*,
              COALESCE(daily.cost,   0) AS spent_today_usd,
              COALESCE(monthly.cost, 0) AS spent_month_usd
       FROM project_agent_budgets pab
       LEFT JOIN (
         SELECT agent, SUM(cost_usd) AS cost
         FROM agent_traces
         WHERE project_id = $1
           AND created_at >= date_trunc('day', now())
         GROUP BY agent
       ) daily   ON daily.agent = pab.agent_slug
       LEFT JOIN (
         SELECT agent, SUM(cost_usd) AS cost
         FROM agent_traces
         WHERE project_id = $1
           AND created_at >= date_trunc('month', now())
         GROUP BY agent
       ) monthly ON monthly.agent = pab.agent_slug
       WHERE pab.project_id = $1
       ORDER BY pab.agent_slug`,
      [projectId]
    )

    const { rows: [killSwitch] } = await query(
      `SELECT * FROM agent_kill_switch
       WHERE project_id = $1 AND resumed_at IS NULL
       ORDER BY paused_at DESC LIMIT 1`,
      [projectId]
    )

    return res.json({
      budgets,
      paused:      killSwitch != null,
      kill_switch: killSwitch ?? null,
    })
  } catch (err) { next(err) }
})

// ── PUT /budgets/:slug ─────────────────────────────────────────────────────────

router.put('/:slug', async (req, res, next) => {
  try {
    const { id: projectId, slug: agentSlug } = req.params
    const { daily_limit_usd, monthly_limit_usd, enabled } = req.body ?? {}

    const { rows: [budget] } = await query(
      `INSERT INTO project_agent_budgets
         (project_id, agent_slug, daily_limit_usd, monthly_limit_usd, enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, agent_slug) DO UPDATE SET
         daily_limit_usd   = EXCLUDED.daily_limit_usd,
         monthly_limit_usd = EXCLUDED.monthly_limit_usd,
         enabled           = EXCLUDED.enabled,
         updated_at        = now()
       RETURNING *`,
      [
        projectId,
        agentSlug,
        daily_limit_usd   ?? null,
        monthly_limit_usd ?? null,
        enabled ?? true,
      ]
    )

    return res.json({ budget })
  } catch (err) { next(err) }
})

// ── GET /budgets/kill-switch ───────────────────────────────────────────────────

router.get('/kill-switch', async (req, res, next) => {
  try {
    const { id: projectId } = req.params

    const { rows: [active] } = await query(
      `SELECT * FROM agent_kill_switch
       WHERE project_id = $1 AND resumed_at IS NULL
       ORDER BY paused_at DESC LIMIT 1`,
      [projectId]
    )

    return res.json({ paused: active != null, kill_switch: active ?? null })
  } catch (err) { next(err) }
})

// ── POST /budgets/kill-switch ──────────────────────────────────────────────────

router.post('/kill-switch', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const { reason } = req.body ?? {}
    const userId = req.user?.id ?? null

    const { rows: [existing] } = await query(
      `SELECT id FROM agent_kill_switch WHERE project_id = $1 AND resumed_at IS NULL`,
      [projectId]
    )
    if (existing) return res.json({ paused: true, message: 'Already paused' })

    const { rows: [ks] } = await query(
      `INSERT INTO agent_kill_switch (project_id, user_id, reason)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [projectId, userId, reason ?? null]
    )

    return res.status(201).json({ paused: true, kill_switch: ks })
  } catch (err) { next(err) }
})

// ── DELETE /budgets/kill-switch ────────────────────────────────────────────────

router.delete('/kill-switch', async (req, res, next) => {
  try {
    const { id: projectId } = req.params

    await query(
      `UPDATE agent_kill_switch SET resumed_at = now()
       WHERE project_id = $1 AND resumed_at IS NULL`,
      [projectId]
    )

    return res.json({ paused: false })
  } catch (err) { next(err) }
})

export default router
