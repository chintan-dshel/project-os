/**
 * routes/assignments.js
 * Agent assignment queue — analyze tasks, review prompts, run agents
 */

import { Router }                    from 'express'
import pool, { query }               from '../db/pool.js'
import { triggerAssignmentAnalysis } from '../lib/assignment.analysis.js'
import { runRegistryAgent, runSpecialistAgent } from '../lib/specialist.agent.js'

const router = Router({ mergeParams: true })

// POST /projects/:id/assignments/analyze — run analysis, create pending assignments
// Manual trigger: always bypasses cooldown so the user gets immediate feedback
router.post('/analyze', async (req, res, next) => {
  try {
    const result = await triggerAssignmentAnalysis(req.params.id, { force: true })
    // Return pending assignments after analysis
    const { rows } = await pool.query(
      `SELECT aa.*, ar.name AS agent_name, ar.icon AS agent_icon, ar.slug AS agent_slug
       FROM agent_assignments aa
       LEFT JOIN agent_registry ar ON ar.id = aa.registry_agent_id
       WHERE aa.project_id = $1
         AND aa.status IN ('pending_review','assigned_to_user')
       ORDER BY aa.created_at DESC`,
      [req.params.id],
    )
    res.json({ ...result, assignments: rows })
  } catch (err) { next(err) }
})

// GET /projects/:id/assignments — list assignments with optional status filter
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query
    const { rows } = await pool.query(
      `SELECT aa.*, ar.name AS agent_name, ar.icon AS agent_icon, ar.slug AS agent_slug,
              t.title AS task_title
       FROM agent_assignments aa
       LEFT JOIN agent_registry ar ON ar.id = aa.registry_agent_id
       LEFT JOIN tasks t ON t.task_key = aa.task_key AND t.project_id = aa.project_id
       WHERE aa.project_id = $1
         ${status ? `AND aa.status = $2::assignment_status` : ''}
       ORDER BY aa.created_at DESC`,
      status ? [req.params.id, status] : [req.params.id],
    )
    res.json({ assignments: rows })
  } catch (err) { next(err) }
})

// PATCH /projects/:id/assignments/:assignmentId — update status, edited prompt, rejection reason
router.patch('/:assignmentId', async (req, res, next) => {
  const { status, user_edited_prompt, rejection_reason } = req.body
  try {
    const sets = ['updated_at = now()']
    const vals = []
    let n = 1
    if (status             !== undefined) { sets.push(`status=$${n++}::assignment_status`); vals.push(status) }
    if (user_edited_prompt !== undefined) { sets.push(`user_edited_prompt=$${n++}`);        vals.push(user_edited_prompt) }
    if (rejection_reason   !== undefined) { sets.push(`rejection_reason=$${n++}`);          vals.push(rejection_reason) }
    vals.push(req.params.assignmentId, req.params.id)
    const { rows } = await pool.query(
      `UPDATE agent_assignments SET ${sets.join(',')}
       WHERE id=$${n++} AND project_id=$${n} RETURNING *`,
      vals,
    )
    if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' })
    res.json({ assignment: rows[0] })
  } catch (err) { next(err) }
})

// POST /projects/:id/assignments/:assignmentId/run — run the assigned agent
router.post('/:assignmentId/run', async (req, res, next) => {
  try {
    // Fetch the assignment with registry agent info
    const { rows: [assignment] } = await pool.query(
      `SELECT aa.*, ar.slug AS agent_slug
       FROM agent_assignments aa
       LEFT JOIN agent_registry ar ON ar.id = aa.registry_agent_id
       WHERE aa.id = $1 AND aa.project_id = $2`,
      [req.params.assignmentId, req.params.id],
    )
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' })
    if (assignment.status === 'assigned_to_user') {
      return res.status(400).json({ error: 'This task is assigned to user, not an agent' })
    }

    // Mark as running
    await query(
      `UPDATE agent_assignments SET status='running'::assignment_status, updated_at=now() WHERE id=$1`,
      [assignment.id]
    )

    // Fetch project
    const { rows: [project] } = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id])

    const promptToUse = assignment.user_edited_prompt ?? assignment.suggested_prompt ?? assignment.task_key

    // Run the agent
    const result = await runRegistryAgent({
      projectId: req.params.id,
      project,
      taskKey:      assignment.task_key,
      registrySlug: assignment.agent_slug,
      userPrompt:   promptToUse,
    }).catch(async (err) => {
      await query(
        `UPDATE agent_assignments SET status='pending_review'::assignment_status, updated_at=now() WHERE id=$1`,
        [assignment.id]
      )
      throw err
    })

    // Mark as completed
    await query(
      `UPDATE agent_assignments SET status='completed'::assignment_status, output_id=$2, updated_at=now() WHERE id=$1`,
      [assignment.id, result.outputId]
    )

    res.json({ assignment_id: assignment.id, output_id: result.outputId, status: 'completed' })
  } catch (err) { next(err) }
})

export default router
