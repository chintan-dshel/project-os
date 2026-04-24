/**
 * routes/workroom.js
 * Project Workroom — activity timeline + persistent agent chat.
 *
 * GET  /projects/:id/workroom/log             — list log entries (most recent first)
 * POST /projects/:id/workroom/log             — append a log entry
 * GET  /projects/:id/workroom/chat/:agent     — get/init thread + last N messages
 * POST /projects/:id/workroom/chat/:agent     — send message, get AI reply
 */

import { Router }    from 'express'
import { query }     from '../db/pool.js'
import { callClaude } from '../lib/anthropic.js'
import { badRequest, notFound } from '../middleware/errors.js'
import { findProjectById } from '../db/projects.queries.js'

const router = Router({ mergeParams: true })

const LOG_PAGE = 50

// ── GET /workroom/log ──────────────────────────────────────────────────────────

router.get('/log', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const limit  = Math.min(parseInt(req.query.limit  ?? LOG_PAGE, 10), 200)
    const before = req.query.before ?? null

    const conditions = ['project_id = $1']
    const params     = [projectId]

    if (before) {
      params.push(before)
      conditions.push(`id < $${params.length}`)
    }

    const { rows } = await query(
      `SELECT id, kind, author, body, delta_summary, source_ref, created_at
       FROM log_entries
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1}`,
      [...params, limit]
    )

    return res.json({ entries: rows, count: rows.length })
  } catch (err) { next(err) }
})

// ── POST /workroom/log ─────────────────────────────────────────────────────────

router.post('/log', async (req, res, next) => {
  try {
    const { id: projectId } = req.params
    const { kind, author, body, delta_summary, source_ref } = req.body ?? {}

    if (!body?.trim()) throw badRequest('body is required')
    const VALID_KINDS = ['user', 'agent', 'system']
    if (kind && !VALID_KINDS.includes(kind)) throw badRequest(`kind must be one of: ${VALID_KINDS.join(', ')}`)

    const userId = req.user?.id ?? null

    const { rows: [entry] } = await query(
      `INSERT INTO log_entries
         (project_id, kind, author, user_id, body, delta_summary, source_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        kind         ?? 'user',
        author       ?? null,
        userId,
        body.trim(),
        delta_summary ?? null,
        source_ref   ?? null,
      ]
    )

    return res.status(201).json({ entry })
  } catch (err) { next(err) }
})

// ── GET /workroom/chat/:agent ──────────────────────────────────────────────────

router.get('/chat/:agent', async (req, res, next) => {
  try {
    const { id: projectId, agent: agentName } = req.params
    const limit = Math.min(parseInt(req.query.limit ?? 40, 10), 100)

    // Get or create thread
    const { rows: [thread] } = await query(
      `INSERT INTO chat_threads (project_id, agent_name)
       VALUES ($1, $2)
       ON CONFLICT (project_id, agent_name) DO UPDATE SET agent_name = EXCLUDED.agent_name
       RETURNING *`,
      [projectId, agentName]
    )

    const { rows: messages } = await query(
      `SELECT id, role, body, agent_name, side_effects, created_at
       FROM chat_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [thread.id, limit]
    )

    return res.json({ thread, messages })
  } catch (err) { next(err) }
})

// ── POST /workroom/chat/:agent ─────────────────────────────────────────────────

router.post('/chat/:agent', async (req, res, next) => {
  try {
    const { id: projectId, agent: agentName } = req.params
    const { message } = req.body ?? {}

    if (!message?.trim()) throw badRequest('message is required')

    const project = await findProjectById(projectId)
    if (!project) throw notFound('Project not found')

    // Get or create thread
    const { rows: [thread] } = await query(
      `INSERT INTO chat_threads (project_id, agent_name)
       VALUES ($1, $2)
       ON CONFLICT (project_id, agent_name) DO UPDATE SET agent_name = EXCLUDED.agent_name
       RETURNING *`,
      [projectId, agentName]
    )

    // Load last 20 messages for context
    const { rows: history } = await query(
      `SELECT role, body FROM chat_messages
       WHERE thread_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [thread.id]
    )

    // Save user message
    const { rows: [userMsg] } = await query(
      `INSERT INTO chat_messages (thread_id, project_id, role, body)
       VALUES ($1, $2, 'user', $3)
       RETURNING *`,
      [thread.id, projectId, message.trim()]
    )

    // Build conversation history for Claude (oldest first)
    const claudeMessages = history.reverse().map(m => ({
      role:    m.role === 'agent' ? 'assistant' : 'user',
      content: m.body,
    }))
    claudeMessages.push({ role: 'user', content: message.trim() })

    const systemPrompt = `You are the ${agentName} agent for the project "${project.title}".
Project context: ${project.core_problem ?? ''} | Stage: ${project.stage ?? 'planning'}
Be concise, actionable, and specific to this project. Respond in markdown.`

    const { text } = await callClaude({
      system:   systemPrompt,
      messages: claudeMessages,
      meta:     { projectId, userId: req.user?.id, agent: agentName },
    })

    // Save agent reply
    const { rows: [agentMsg] } = await query(
      `INSERT INTO chat_messages (thread_id, project_id, role, body, agent_name)
       VALUES ($1, $2, 'agent', $3, $4)
       RETURNING *`,
      [thread.id, projectId, text, agentName]
    )

    return res.json({
      user:  userMsg,
      agent: agentMsg,
    })
  } catch (err) { next(err) }
})

export default router
