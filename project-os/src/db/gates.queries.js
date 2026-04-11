/**
 * db/gates.queries.js
 *
 * Thin, targeted queries used only by the stage gate middleware.
 * These deliberately avoid the heavy aggregation joins in projects.queries.js —
 * gates run on every message request so they must be fast.
 */

import { query } from './pool.js';

/**
 * Returns the fields the planning gate needs:
 *   - confidence_score from the project row
 * The confidence_score is written by the Intake Agent when it finalises the brief.
 */
export async function getConfidenceScore(projectId) {
  const { rows } = await query(
    `SELECT confidence_score FROM projects WHERE id = $1`,
    [projectId],
  );
  return rows[0]?.confidence_score ?? null;
}

/**
 * Returns whether the execution plan has been approved.
 * plan_approved is flipped to true by PUT /projects/:id/approve.
 */
export async function getPlanApproved(projectId) {
  const { rows } = await query(
    `SELECT plan_approved FROM projects WHERE id = $1`,
    [projectId],
  );
  return rows[0]?.plan_approved ?? false;
}

/**
 * Returns the most recent retro for the project, if any.
 * Used by the milestone gate to confirm a retro was completed before
 * the next milestone's execution can begin.
 *
 * "Completed" means a retrospective row exists for the milestone
 * that just finished — we check the milestone_id passed in.
 */
export async function getRetroForMilestone(projectId, milestoneId) {
  const { rows } = await query(
    `SELECT id, retro_type, triggered_at
     FROM retrospectives
     WHERE project_id = $1
       AND milestone_id = $2
     ORDER BY triggered_at DESC
     LIMIT 1`,
    [projectId, milestoneId],
  );
  return rows[0] ?? null;
}

/**
 * Returns the current milestone being executed.
 * The "current" milestone is the earliest incomplete one in the current phase.
 * Used to determine which milestone needs a retro before proceeding.
 */
export async function getCurrentMilestone(projectId) {
  const { rows } = await query(
    `SELECT m.id, m.title, m.milestone_key, m.phase_id
     FROM milestones m
     JOIN phases ph ON ph.id = m.phase_id
     WHERE m.project_id = $1
       AND m.completed_at IS NULL
     ORDER BY ph.sort_order ASC, m.sort_order ASC
     LIMIT 1`,
    [projectId],
  );
  return rows[0] ?? null;
}

/**
 * Returns the most recently completed milestone for the project.
 * Used to find which milestone needs a retro when stage is 'milestone_retro'.
 */
export async function getLastCompletedMilestone(projectId) {
  const { rows } = await query(
    `SELECT id, title, milestone_key, phase_id
     FROM milestones
     WHERE project_id = $1
       AND completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT 1`,
    [projectId],
  );
  return rows[0] ?? null;
}
