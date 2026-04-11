/**
 * routes/knowledge.js
 * Knowledge Hub API
 *
 * GET  /knowledge                   — list / search all entries
 * POST /knowledge                   — create a manual entry
 *
 * Query params for GET:
 *   ?q=text          full-text search
 *   ?type=...        filter by type
 *   ?project_id=N    filter to a project (also returns project_id IS NULL entries)
 *   ?limit=N         max results (default 50, cap 200)
 */

import { Router } from 'express'
import { badRequest } from '../middleware/errors.js'
import { addKnowledgeEntry, searchKnowledge } from '../lib/knowledge.js'

const router = Router()

const VALID_TYPES    = ['lesson_learned', 'friction_point', 'decision', 'risk_insight', 'domain_knowledge']
const VALID_SOURCES  = ['retro', 'decision_log', 'risk_register', 'manual']

// ── GET /knowledge ─────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { q, type, project_id, limit = '50' } = req.query

    if (type && !VALID_TYPES.includes(type)) {
      throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`)
    }

    const entries = await searchKnowledge({
      q:         q ?? null,
      type:      type ?? null,
      projectId: project_id ?? null,  // UUID string
      limit:     Math.min(parseInt(limit) || 50, 200),
    })

    return res.json({ entries, count: entries.length })
  } catch (err) {
    next(err)
  }
})

// ── POST /knowledge ────────────────────────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const { project_id, project_name, type, title, content, source_type, tags } = req.body ?? {}

    if (!title?.trim())   throw badRequest('title is required')
    if (!content?.trim()) throw badRequest('content is required')

    if (type && !VALID_TYPES.includes(type)) {
      throw badRequest(`type must be one of: ${VALID_TYPES.join(', ')}`)
    }
    if (source_type && !VALID_SOURCES.includes(source_type)) {
      throw badRequest(`source_type must be one of: ${VALID_SOURCES.join(', ')}`)
    }

    const entry = await addKnowledgeEntry({
      projectId:   project_id   ?? null,
      projectName: project_name ?? null,
      type:        type         ?? 'domain_knowledge',
      title:       title.trim(),
      content:     content.trim(),
      sourceType:  source_type  ?? 'manual',
      tags:        Array.isArray(tags) ? tags : [],
    })

    return res.status(201).json({ entry })
  } catch (err) {
    next(err)
  }
})

export default router
