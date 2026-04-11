/**
 * routes/tasks.js
 *
 * Direct task management — no AI, no cost.
 * PMs can update status, log hours, add comments, flag blockers
 * directly without going through the Execution Agent.
 *
 * Routes:
 *   PATCH /projects/:id/tasks/:taskKey   — update status / hours / notes
 *   POST  /projects/:id/tasks/:taskKey/comments — add a timestamped comment
 */

import { Router }  from 'express';
import { query, transaction } from '../db/pool.js';
import { badRequest, notFound } from '../middleware/errors.js';

const router = Router({ mergeParams: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findTask(projectId, taskKey) {
  const { rows } = await query(
    `SELECT t.*, m.title AS milestone_title, ph.title AS phase_title
     FROM tasks t
     JOIN milestones m  ON m.id = t.milestone_id
     JOIN phases    ph  ON ph.id = m.phase_id
     WHERE t.project_id = $1 AND t.task_key = $2
     LIMIT 1`,
    [projectId, taskKey],
  );
  return rows[0] ?? null;
}

// ── PATCH /projects/:id/tasks/:taskKey ───────────────────────────────────────
// Update status, actual_hours, notes (non-AI)
router.patch('/:taskKey', async (req, res, next) => {
  try {
    const { id: projectId, taskKey } = req.params;
    const { status, actual_hours, notes } = req.body ?? {};

    const task = await findTask(projectId, taskKey);
    if (!task) throw notFound(`Task '${taskKey}' not found in project`);

    const VALID_STATUSES = ['todo', 'in_progress', 'done', 'blocked'];
    if (status && !VALID_STATUSES.includes(status)) {
      throw badRequest(`Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const setClauses = ['updated_at = now()'];
    const vals       = [projectId, taskKey];

    if (status) {
      setClauses.push(`status = $${vals.length + 1}::task_status`);
      vals.push(status);
      if (status === 'done') setClauses.push('completed_at = now()');
      if (status !== 'done') setClauses.push('completed_at = NULL');
    }
    if (actual_hours != null) {
      setClauses.push(`actual_hours = $${vals.length + 1}`);
      vals.push(actual_hours);
    }
    if (notes != null) {
      setClauses.push(`notes = $${vals.length + 1}`);
      vals.push(notes);
    }

    const { rows } = await query(
      `UPDATE tasks SET ${setClauses.join(', ')}
       WHERE project_id = $1 AND task_key = $2
       RETURNING *`,
      vals,
    );

    // If blocked, auto-create a blocker record
    if (status === 'blocked') {
      await query(
        `INSERT INTO blockers (project_id, task_id, description)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [projectId, task.id, `Task blocked: ${task.title}`],
      ).catch(() => {}); // non-critical
    }

    return res.json({ task: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/tasks/:taskKey/comments ────────────────────────────────
// Add a timestamped comment to a task (appended to notes field)
router.post('/:taskKey/comments', async (req, res, next) => {
  try {
    const { id: projectId, taskKey } = req.params;
    const { comment } = req.body ?? {};

    if (!comment?.trim()) throw badRequest('comment is required');

    const task = await findTask(projectId, taskKey);
    if (!task) throw notFound(`Task '${taskKey}' not found`);

    // Format: [2026-04-05 14:32] Comment text
    const ts      = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const entry   = `[${ts}] ${comment.trim()}`;
    const newNotes = task.notes ? `${task.notes}\n${entry}` : entry;

    const { rows } = await query(
      `UPDATE tasks SET notes = $3, updated_at = now()
       WHERE project_id = $1 AND task_key = $2
       RETURNING *`,
      [projectId, taskKey, newNotes],
    );

    return res.json({
      task:    rows[0],
      comment: entry,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
