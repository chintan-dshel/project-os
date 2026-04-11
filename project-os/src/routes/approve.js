import { Router } from 'express';
import { transaction } from '../db/pool.js';
import { findProjectById, approveProject, insertDecision } from '../db/projects.queries.js';
import { appendMessage } from '../db/conversations.queries.js';
import { notFound, conflict } from '../middleware/errors.js';

const router = Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// PUT /projects/:id/approve
//
// The Planning Agent requires an explicit founder "CONFIRMED" before
// the project advances to execution. This endpoint is that gate.
//
// Request body (optional):
//   {
//     "confirmed": true,                  ← must be explicitly true
//     "notes": "Looks good, let's go!"    ← stored in decision_log
//   }
//
// Business rules:
//   - Project must be in 'awaiting_approval' stage
//   - confirmed must be exactly true (not truthy — exact check)
//   - Flips plan_approved → true, stage → 'execution'
//   - Logs the approval decision
// ─────────────────────────────────────────────────────────────────────────────
router.put('/', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { confirmed, notes } = req.body ?? {};

    // Load project first for a clear error message
    const project = await findProjectById(id);
    if (!project) throw notFound('Project not found');

    if (project.stage !== 'awaiting_approval') {
      throw conflict(
        `Cannot approve: project is in stage '${project.stage}', expected 'awaiting_approval'. ` +
        `Send a message to the Planning Agent first to generate a plan.`,
      );
    }

    if (confirmed !== true) {
      // Return the plan summary so the founder can review before confirming
      return res.status(200).json({
        project_id: id,
        approved: false,
        message: 'Set confirmed: true to lock in this plan and begin execution.',
        plan_summary: {
          methodology:           project.methodology,
          total_estimated_hours: project.total_estimated_hours,
          planned_weeks:         project.planned_weeks,
          scope_warning:         project.scope_warning,
        },
      });
    }

    // Perform the approval inside a transaction so the decision log
    // is always written atomically with the stage change.
    const updated = await transaction(async (client) => {
      // Flip plan_approved and advance stage
      const { rows } = await client.query(
        `UPDATE projects
         SET plan_approved = true, stage = 'execution', updated_at = now()
         WHERE id = $1 AND stage = 'awaiting_approval'
         RETURNING *`,
        [id],
      );

      if (!rows.length) {
        // Race condition: someone else already approved
        throw conflict('Project was already approved or stage changed concurrently.');
      }

      // Log the approval decision
      await client.query(
        `INSERT INTO decision_log
           (project_id, decision, rationale, decided_at)
         VALUES ($1, $2, $3, now())`,
        [
          id,
          'Execution plan approved — project advancing to execution',
          notes ?? 'Founder confirmed via PUT /approve',
        ],
      );

      return rows[0];
    });

    // Record the system event in conversation history
    await appendMessage({
      project_id: id,
      agent: 'planning',
      role: 'system',
      content: `Plan approved by founder. Project advancing to execution stage. ${notes ? `Notes: ${notes}` : ''}`.trim(),
    });

    return res.json({
      project_id: id,
      approved: true,
      stage:     updated.stage,
      message:   'Plan approved. Execution Agent is now active.',
      project:   updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
