/**
 * routes/workspace.js
 * Project Workspace — freeform document storage
 *
 * GET    /projects/:id/workspace              — list all docs
 * POST   /projects/:id/workspace              — create a doc
 * PATCH  /projects/:id/workspace/:docId       — update title/content
 * DELETE /projects/:id/workspace/:docId       — delete a doc
 * POST   /projects/:id/workspace/:docId/to-knowledge  — promote to Knowledge Hub
 */

import { Router } from 'express'
import { query }  from '../db/pool.js'
import { badRequest, notFound } from '../middleware/errors.js'
import { addKnowledgeEntry } from '../lib/knowledge.js'

const router = Router({ mergeParams: true })

const VALID_TYPES = ['note', 'research', 'spec', 'code', 'report', 'agent_output', 'reference']

// ── GET /workspace ─────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const { type, task_key } = req.query

    const conditions = ['project_id = $1']
    const params     = [projectId]

    if (type) {
      if (!VALID_TYPES.includes(type)) throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`)
      params.push(type)
      conditions.push(`type = $${params.length}`)
    }

    if (task_key) {
      params.push(task_key)
      conditions.push(`task_key = $${params.length}`)
    }

    const { rows } = await query(
      `SELECT id, type, title, content, task_key, task_title,
              created_by, agent_slug, tags, created_at, updated_at
       FROM workspace_docs
       WHERE ${conditions.join(' AND ')}
       ORDER BY updated_at DESC`,
      params
    )

    return res.json({ docs: rows, count: rows.length })
  } catch (err) { next(err) }
})

// ── POST /workspace ────────────────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const { type, title, content, task_key, task_title, created_by, agent_slug, tags } = req.body ?? {}

    if (!title?.trim())   throw badRequest('title is required')
    if (type && !VALID_TYPES.includes(type)) throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`)

    const { rows: [doc] } = await query(
      `INSERT INTO workspace_docs
         (project_id, type, title, content, task_key, task_title,
          created_by, agent_slug, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        projectId,
        type         ?? 'note',
        title.trim(),
        content      ?? '',
        task_key     ?? null,
        task_title   ?? null,
        created_by   ?? 'user',
        agent_slug   ?? null,
        Array.isArray(tags) ? tags : [],
      ]
    )

    return res.status(201).json({ doc })
  } catch (err) { next(err) }
})

// ── PATCH /workspace/:docId ────────────────────────────────────────────────────

router.patch('/:docId', async (req, res, next) => {
  try {
    const { id: projectId, docId } = req.params
    const { title, content, type, tags } = req.body ?? {}

    const { rows: [existing] } = await query(
      `SELECT id FROM workspace_docs WHERE id = $1 AND project_id = $2`, [docId, projectId]
    )
    if (!existing) throw notFound('Workspace doc not found')

    const sets = ['updated_at = now()']
    const vals = [docId, projectId]

    if (title   != null) { sets.push(`title   = $${vals.length + 1}`); vals.push(title.trim()) }
    if (content != null) { sets.push(`content = $${vals.length + 1}`); vals.push(content) }
    if (type    != null) {
      if (!VALID_TYPES.includes(type)) throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`)
      sets.push(`type = $${vals.length + 1}`); vals.push(type)
    }
    if (tags != null) { sets.push(`tags = $${vals.length + 1}`); vals.push(Array.isArray(tags) ? tags : []) }

    const { rows: [doc] } = await query(
      `UPDATE workspace_docs SET ${sets.join(', ')} WHERE id = $1 AND project_id = $2 RETURNING *`,
      vals
    )

    return res.json({ doc })
  } catch (err) { next(err) }
})

// ── DELETE /workspace/:docId ───────────────────────────────────────────────────

router.delete('/:docId', async (req, res, next) => {
  try {
    const { id: projectId, docId } = req.params

    const { rows } = await query(
      `DELETE FROM workspace_docs WHERE id = $1 AND project_id = $2 RETURNING id`,
      [docId, projectId]
    )
    if (!rows.length) throw notFound('Workspace doc not found')

    return res.json({ deleted: true, id: parseInt(docId) })
  } catch (err) { next(err) }
})

// ── POST /workspace/:docId/to-knowledge ───────────────────────────────────────

router.post('/:docId/to-knowledge', async (req, res, next) => {
  try {
    const { id: projectId, docId } = req.params
    const { type: knowledgeType } = req.body ?? {}

    const { rows: [doc] } = await query(
      `SELECT wd.*, p.title AS project_name
       FROM workspace_docs wd
       JOIN projects p ON p.id = wd.project_id
       WHERE wd.id = $1 AND wd.project_id = $2`,
      [docId, projectId]
    )
    if (!doc) throw notFound('Workspace doc not found')

    // Map workspace type → knowledge type
    const TYPE_MAP = {
      note:         'lesson_learned',
      research:     'domain_knowledge',
      spec:         'domain_knowledge',
      code:         'domain_knowledge',
      report:       'lesson_learned',
      agent_output: 'lesson_learned',
      reference:    'domain_knowledge',
    }

    const entry = await addKnowledgeEntry({
      projectId:   projectId,
      projectName: doc.project_name,
      type:        knowledgeType ?? TYPE_MAP[doc.type] ?? 'domain_knowledge',
      title:       doc.title,
      content:     doc.content,
      sourceType:  'manual',
      tags:        doc.tags ?? [],
    })

    return res.status(201).json({ entry })
  } catch (err) { next(err) }
})

export default router
