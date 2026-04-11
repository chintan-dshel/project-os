/**
 * lib/knowledge.js
 * Knowledge Hub — write and query the organisation's accumulated learnings.
 *
 * Entry types:
 *   lesson_learned   — "what worked" and "what would you change" from retros
 *   friction_point   — "what created friction" from retros
 *   decision         — entries from decision_log (via RAID or execution agent)
 *   risk_insight     — materialised/closed risks with lessons
 *   domain_knowledge — manual entries by the founder
 */

import { query } from '../db/pool.js'

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Insert a knowledge entry.
 * Computes the full-text search vector from title + content + tags.
 * Errors are caught and logged — never throw from here (auto-populate is non-critical).
 */
export async function addKnowledgeEntry({
  projectId,
  projectName,
  type = 'lesson_learned',
  title,
  content,
  sourceType = 'manual',
  sourceId = null,
  tags = [],
}) {
  if (!title?.trim() || !content?.trim()) return null

  const searchText = `${title} ${content} ${tags.join(' ')}`

  try {
    const { rows } = await query(
      `INSERT INTO knowledge_entries
         (project_id, project_name, type, title, content,
          source_type, source_id, tags, search_vector)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_tsvector('english', $9))
       RETURNING *`,
      [
        projectId ?? null,
        projectName ?? null,
        type,
        title.trim(),
        content.trim(),
        sourceType,
        sourceId ?? null,
        tags,
        searchText,
      ],
    )
    return rows[0]
  } catch (e) {
    console.warn('[knowledge] addKnowledgeEntry failed:', e.message)
    return null
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Search / list knowledge entries.
 * All filters are optional.
 * When q is provided, results are ranked by full-text relevance.
 */
export async function searchKnowledge({ q = null, type = null, projectId = null, limit = 50 } = {}) {
  const conditions = []
  const params = []

  if (q && q.trim()) {
    params.push(q.trim())
    conditions.push(`search_vector @@ plainto_tsquery('english', $${params.length})`)
  }

  if (type) {
    params.push(type)
    conditions.push(`type = $${params.length}`)
  }

  if (projectId != null) {
    params.push(projectId)  // UUID string
    conditions.push(`(project_id = $${params.length}::uuid OR project_id IS NULL)`)
  }

  const where    = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const hasQuery = !!(q && q.trim())
  const rankExpr = hasQuery
    ? `, ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank`
    : ''
  const orderBy  = hasQuery
    ? 'ORDER BY rank DESC, created_at DESC'
    : 'ORDER BY created_at DESC'

  params.push(Math.min(parseInt(limit) || 50, 200))

  try {
    const { rows } = await query(
      `SELECT *${rankExpr} FROM knowledge_entries ${where} ${orderBy} LIMIT $${params.length}`,
      params,
    )
    return rows
  } catch (e) {
    console.warn('[knowledge] searchKnowledge failed:', e.message)
    return []
  }
}

/**
 * Fetch the top-N most relevant entries for a free-text query.
 * Used by planning and execution agents to inject past learnings into context.
 */
export async function getRelevantKnowledge(queryText, limit = 5) {
  if (!queryText?.trim()) return []
  return searchKnowledge({ q: queryText, limit })
}

// ── Helpers for auto-population ───────────────────────────────────────────────

/**
 * Populate knowledge entries from a completed retro.
 * Creates up to 4 entries: what_worked, friction, change, and (ship only) growth read.
 */
export async function populateFromRetro(projectId, projectName, retro, retroId) {
  const base = { projectId, projectName, sourceType: 'retro', sourceId: retroId }
  const label = retro.milestone_name
    ? `[${retro.milestone_name}]`
    : retro.type === 'ship_retro' ? '[Ship]' : ''

  const entries = [
    retro.what_worked && {
      ...base,
      type: 'lesson_learned',
      title: `What worked ${label}`,
      content: retro.what_worked,
      tags: ['retro', retro.type ?? 'milestone_retro'],
    },
    retro.what_created_friction && {
      ...base,
      type: 'friction_point',
      title: `Friction ${label}`,
      content: retro.what_created_friction,
      tags: ['retro', 'friction', retro.type ?? 'milestone_retro'],
    },
    retro.what_would_you_change && {
      ...base,
      type: 'lesson_learned',
      title: `Would change ${label}`,
      content: retro.what_would_you_change,
      tags: ['retro', 'improvement', retro.type ?? 'milestone_retro'],
    },
    retro.type === 'ship_retro' && retro.founder_growth_read && {
      ...base,
      type: 'domain_knowledge',
      title: `Founder growth read ${label}`,
      content: retro.founder_growth_read,
      tags: ['retro', 'growth', 'ship_retro'],
    },
  ].filter(Boolean)

  for (const entry of entries) {
    await addKnowledgeEntry(entry)
  }
}

/**
 * Populate a knowledge entry from a decision_log row.
 */
export async function populateFromDecision(projectId, projectName, decision) {
  if (!decision?.decision) return
  const content = [
    decision.decision,
    decision.rationale ? `Rationale: ${decision.rationale}` : null,
    decision.outcome   ? `Outcome: ${decision.outcome}`     : null,
  ].filter(Boolean).join('\n')

  await addKnowledgeEntry({
    projectId,
    projectName,
    type: 'decision',
    title: decision.decision.slice(0, 120),
    content,
    sourceType: 'decision_log',
    sourceId: decision.id ?? null,
    tags: ['decision'],
  })
}
