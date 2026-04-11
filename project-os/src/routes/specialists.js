/**
 * routes/specialists.js — v0.9
 *
 * Specialist Agent Marketplace
 *
 * POST /projects/:id/specialists/delegate
 *   Body: { task_key, specialist_type, brief }
 *   Triggers a specialist agent run. Returns the output immediately (sync).
 *
 * POST /projects/:id/specialists/:outputId/approve
 *   Marks output approved. Adds note to task.
 *
 * POST /projects/:id/specialists/:outputId/reject
 *   Body: { feedback }
 *   Marks output rejected with feedback.
 *
 * POST /projects/:id/specialists/:outputId/revise
 *   Body: { additional_brief }
 *   Runs the specialist again with original brief + revision notes.
 *
 * GET  /projects/:id/specialists
 *   Returns all specialist outputs for the project.
 *
 * GET  /projects/:id/specialists/:outputId
 *   Returns a single specialist output.
 */

import { Router } from 'express';
import {
  runSpecialistAgent,
  approveSpecialistOutput,
  rejectSpecialistOutput,
  getSpecialistOutputsForProject,
} from '../lib/specialist.agent.js';
import { findProjectById } from '../db/projects.queries.js';
import { query }           from '../db/pool.js';
import { badRequest, notFound } from '../middleware/errors.js';

const router = Router({ mergeParams: true });

const VALID_TYPES = ['coding', 'research', 'content', 'qa'];

// Guard: check if specialist_outputs table exists (requires migration 004)
async function checkSpecialistTable() {
  try {
    await query(`SELECT id FROM specialist_outputs LIMIT 0`)
    return true
  } catch {
    throw Object.assign(new Error(
      'Specialist agents require database migration 004. Run: psql -f migrations/004_specialist_agents.sql'
    ), { status: 503 })
  }
}

// ── POST /specialists/delegate ────────────────────────────────────────────────

router.post('/delegate', async (req, res, next) => {
  try {
    await checkSpecialistTable();
    const { id: projectId } = req.params;
    const { task_key, specialist_type, brief } = req.body ?? {};

    if (!task_key)         throw badRequest('task_key is required');
    if (!specialist_type)  throw badRequest('specialist_type is required');
    if (!VALID_TYPES.includes(specialist_type)) {
      throw badRequest(`specialist_type must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!brief?.trim())    throw badRequest('brief is required — describe what you need');

    const project = await findProjectById(projectId);
    if (!project) throw notFound('Project not found');

    const result = await runSpecialistAgent({
      projectId,
      project,
      taskKey: task_key,
      specialistType: specialist_type,
      brief: brief.trim(),
    });

    return res.json({
      outputId:       result.outputId,
      output:         result.output,
      format:         result.format,
      language:       result.language,
      status:         result.status,
      specialist_type,
      task_key,
    });
  } catch (err) { next(err); }
});

// ── POST /specialists/:outputId/approve ───────────────────────────────────────

router.post('/:outputId/approve', async (req, res, next) => {
  try {
    const { id: projectId, outputId } = req.params;
    const result = await approveSpecialistOutput(projectId, outputId);
    return res.json({ output: result });
  } catch (err) { next(err); }
});

// ── POST /specialists/:outputId/reject ────────────────────────────────────────

router.post('/:outputId/reject', async (req, res, next) => {
  try {
    const { id: projectId, outputId } = req.params;
    const { feedback } = req.body ?? {};
    const result = await rejectSpecialistOutput(projectId, outputId, feedback);
    return res.json({ output: result });
  } catch (err) { next(err); }
});

// ── POST /specialists/:outputId/revise ────────────────────────────────────────

router.post('/:outputId/revise', async (req, res, next) => {
  try {
    const { id: projectId, outputId } = req.params;
    const { additional_brief } = req.body ?? {};
    if (!additional_brief?.trim()) throw badRequest('additional_brief is required');

    // Get original output
    const { rows: [orig] } = await query(
      `SELECT * FROM specialist_outputs WHERE id = $1 AND project_id = $2`,
      [outputId, projectId]
    );
    if (!orig) throw notFound('Specialist output not found');

    const project = await findProjectById(projectId);

    // Mark original as revised
    await query(
      `UPDATE specialist_outputs SET status = 'revised'::specialist_status WHERE id = $1`,
      [outputId]
    );

    // Run with combined brief
    const combinedBrief = `${orig.brief}\n\n---\nRevision requested:\n${additional_brief.trim()}`;
    const result = await runSpecialistAgent({
      projectId,
      project,
      taskKey:        orig.task_key,
      specialistType: orig.specialist_type,
      brief:          combinedBrief,
    });

    return res.json({
      outputId:  result.outputId,
      output:    result.output,
      format:    result.format,
      language:  result.language,
      status:    result.status,
      revisedFrom: outputId,
    });
  } catch (err) { next(err); }
});

// ── GET /specialists ──────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    await checkSpecialistTable();
    const { id: projectId } = req.params;
    const outputs = await getSpecialistOutputsForProject(projectId);
    return res.json({ outputs });
  } catch (err) { next(err); }
});

// ── GET /specialists/:outputId ────────────────────────────────────────────────

router.get('/:outputId', async (req, res, next) => {
  try {
    const { id: projectId, outputId } = req.params;
    const { rows: [output] } = await query(
      `SELECT so.*, t.title AS task_title
       FROM specialist_outputs so
       LEFT JOIN tasks t ON t.task_key = so.task_key AND t.project_id = so.project_id
       WHERE so.id = $1 AND so.project_id = $2`,
      [outputId, projectId]
    );
    if (!output) throw notFound('Specialist output not found');
    return res.json({ output });
  } catch (err) { next(err); }
});

export default router;
