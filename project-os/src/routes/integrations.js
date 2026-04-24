/**
 * routes/integrations.js
 * Per-user integration connections.
 *
 * GET   /integrations           — list all 8 integration keys for the current user
 * PATCH /integrations/:key      — update status/config (connect, disconnect, fix)
 */

import { Router } from 'express'
import { query }  from '../db/pool.js'
import { badRequest } from '../middleware/errors.js'

const router = Router()

const ALL_KEYS = ['github', 'linear', 'slack', 'notion', 'figma', 'salesforce', 'jira', 'gdrive']

const DISPLAY = {
  github:     { name: 'GitHub',      icon: '🐙', description: 'Link repos, auto-close issues, sync PRs' },
  linear:     { name: 'Linear',      icon: '◆',  description: 'Sync tasks and sprints bi-directionally' },
  slack:      { name: 'Slack',       icon: '💬', description: 'Post updates and receive commands' },
  notion:     { name: 'Notion',      icon: '📄', description: 'Push docs and briefs to Notion pages' },
  figma:      { name: 'Figma',       icon: '✏️', description: 'Attach design files to project briefs' },
  salesforce: { name: 'Salesforce',  icon: '☁️', description: 'Pull CRM context into project briefs' },
  jira:       { name: 'Jira',        icon: '🔷', description: 'Import backlog and sync issue status' },
  gdrive:     { name: 'Google Drive',icon: '📁', description: 'Attach Drive docs to workspace' },
}

// ── GET /integrations ──────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id

    const { rows: saved } = await query(
      `SELECT * FROM integrations WHERE user_id = $1`, [userId]
    )

    const byKey = Object.fromEntries(saved.map(r => [r.key, r]))

    const integrations = ALL_KEYS.map(key => {
      const row = byKey[key]
      return {
        key,
        ...DISPLAY[key],
        status:       row?.status       ?? 'available',
        display_name: row?.display_name ?? null,
        last_sync_at: row?.last_sync_at ?? null,
        last_error:   row?.last_error   ?? null,
        id:           row?.id           ?? null,
      }
    })

    return res.json({ integrations })
  } catch (err) { next(err) }
})

// ── PATCH /integrations/:key ───────────────────────────────────────────────────

router.patch('/:key', async (req, res, next) => {
  try {
    const { key } = req.params
    const userId  = req.user.id

    if (!ALL_KEYS.includes(key)) throw badRequest(`key must be one of: ${ALL_KEYS.join(', ')}`)

    const { status, display_name, config, last_error } = req.body ?? {}

    const VALID_STATUSES = ['connected', 'error', 'available']
    if (status && !VALID_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    const { rows: [row] } = await query(
      `INSERT INTO integrations (user_id, key, status, display_name, config, last_error)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, key) DO UPDATE SET
         status       = COALESCE($3, integrations.status),
         display_name = COALESCE($4, integrations.display_name),
         config       = CASE WHEN $5::jsonb IS NOT NULL THEN $5::jsonb ELSE integrations.config END,
         last_error   = COALESCE($6, integrations.last_error),
         last_sync_at = CASE WHEN $3 = 'connected' THEN now() ELSE integrations.last_sync_at END,
         updated_at   = now()
       RETURNING *`,
      [
        userId,
        key,
        status       ?? 'available',
        display_name ?? null,
        config ? JSON.stringify(config) : null,
        last_error   ?? null,
      ]
    )

    return res.json({ integration: { ...row, ...DISPLAY[key] } })
  } catch (err) { next(err) }
})

// ── DELETE /integrations/:key ──────────────────────────────────────────────────

router.delete('/:key', async (req, res, next) => {
  try {
    const { key } = req.params
    const userId  = req.user.id

    if (!ALL_KEYS.includes(key)) throw badRequest(`key must be one of: ${ALL_KEYS.join(', ')}`)

    await query(
      `UPDATE integrations SET status = 'available', config = '{}', display_name = NULL,
              last_error = NULL, last_sync_at = NULL, updated_at = now()
       WHERE user_id = $1 AND key = $2`,
      [userId, key]
    )

    return res.json({ disconnected: true, key })
  } catch (err) { next(err) }
})

export default router
