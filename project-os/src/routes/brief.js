/**
 * routes/brief.js
 * Project Brief — versioned document tied to a project.
 *
 * GET    /projects/:id/brief                          — current brief + version list
 * POST   /projects/:id/brief/versions                 — save a new version (sections[])
 * GET    /projects/:id/brief/versions/:vid            — fetch a specific version
 * POST   /projects/:id/brief/versions/:vid/approve    — approve a version
 */

import { Router } from 'express'
import { query }  from '../db/pool.js'
import { badRequest, notFound } from '../middleware/errors.js'

const router = Router({ mergeParams: true })

// ── helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateBrief(projectId) {
  const { rows: [existing] } = await query(
    `SELECT * FROM briefs WHERE project_id = $1`, [projectId]
  )
  if (existing) return existing

  const { rows: [created] } = await query(
    `INSERT INTO briefs (project_id) VALUES ($1) RETURNING *`, [projectId]
  )
  return created
}

// ── GET /brief ─────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const brief = await getOrCreateBrief(projectId)

    const { rows: versions } = await query(
      `SELECT id, version, author_kind, agent_name, change_note,
              approved_at, approved_by, created_at
       FROM brief_versions
       WHERE brief_id = $1
       ORDER BY version DESC`,
      [brief.id]
    )

    // Current version sections
    const { rows: [current] } = await query(
      `SELECT * FROM brief_versions
       WHERE brief_id = $1
       ORDER BY version DESC LIMIT 1`,
      [brief.id]
    )

    return res.json({
      brief: {
        id:              brief.id,
        project_id:      brief.project_id,
        current_version: brief.current_version,
        created_at:      brief.created_at,
      },
      current: current ?? null,
      versions,
    })
  } catch (err) { next(err) }
})

// ── POST /brief/versions ───────────────────────────────────────────────────────

router.post('/versions', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const { sections, change_note, author_kind, agent_name } = req.body ?? {}

    if (!Array.isArray(sections)) throw badRequest('sections must be an array')

    const brief = await getOrCreateBrief(projectId)

    // Bump current_version and insert snapshot atomically
    const { rows: [updated] } = await query(
      `UPDATE briefs SET current_version = current_version + 1
       WHERE id = $1
       RETURNING current_version`,
      [brief.id]
    )
    const version = updated.current_version

    const { rows: [vrow] } = await query(
      `INSERT INTO brief_versions
         (brief_id, project_id, version, sections, author_kind, agent_name, change_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        brief.id,
        projectId,
        version,
        JSON.stringify(sections),
        author_kind ?? 'human',
        agent_name  ?? null,
        change_note ?? null,
      ]
    )

    return res.status(201).json({ version: vrow })
  } catch (err) { next(err) }
})

// ── GET /brief/versions/:vid ───────────────────────────────────────────────────

router.get('/versions/:vid', async (req, res, next) => {
  try {
    const { id: projectId, vid } = req.params

    const { rows: [vrow] } = await query(
      `SELECT bv.* FROM brief_versions bv
       JOIN briefs b ON b.id = bv.brief_id
       WHERE bv.id = $1 AND b.project_id = $2`,
      [vid, projectId]
    )
    if (!vrow) throw notFound('Brief version not found')

    return res.json({ version: vrow })
  } catch (err) { next(err) }
})

// ── POST /brief/versions/:vid/approve ─────────────────────────────────────────

router.post('/versions/:vid/approve', async (req, res, next) => {
  try {
    const { id: projectId, vid } = req.params
    const userId = req.user?.id ?? null

    const { rows: [vrow] } = await query(
      `UPDATE brief_versions
       SET approved_at = now(), approved_by = $3
       FROM briefs
       WHERE brief_versions.brief_id = briefs.id
         AND brief_versions.id = $1
         AND briefs.project_id = $2
       RETURNING brief_versions.*`,
      [vid, projectId, userId]
    )
    if (!vrow) throw notFound('Brief version not found')

    return res.json({ version: vrow })
  } catch (err) { next(err) }
})

export default router
