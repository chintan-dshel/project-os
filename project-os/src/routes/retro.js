import { Router } from 'express';
import { findProjectById, findRetrosByProject } from '../db/projects.queries.js';
import { query } from '../db/pool.js';
import { notFound } from '../middleware/errors.js';

const router = Router({ mergeParams: true });

// ─────────────────────────────────────────────────────────────────────────────
// GET /projects/:id/retro
//
// Returns all retrospectives for the project, most-recent first, including:
//   - planned vs actual stats
//   - three core questions
//   - patterns detected (JSONB array)
//   - forward feed items
//   - risk cards raised by retro
//   - scorecard rows (ship_retro only)
//   - v2 backlog harvested at ship_retro
//
// Query params:
//   ?type=milestone_retro|ship_retro   filter by retro type
//   ?latest=true                        return only the most recent retro
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, latest } = req.query;

    const project = await findProjectById(id);
    if (!project) throw notFound('Project not found');

    let { retros, backlog } = await findRetrosByProject(id);

    // Optional filters
    if (type) {
      retros = retros.filter((r) => r.retro_type === type);
    }
    if (latest === 'true') {
      retros = retros.slice(0, 1);
    }

    // Shape the response to match the Retro Agent's output structure
    const formatted = retros.map((r) => ({
      id:           r.id,
      type:         r.retro_type,
      triggered_at: r.triggered_at,
      milestone_id: r.milestone_id,

      planned_vs_actual: {
        estimated_hours: r.estimated_hours,
        actual_hours:    r.actual_hours,
        tasks_planned:   r.tasks_planned,
        tasks_completed: r.tasks_completed,
        variance_notes:  r.variance_notes,
      },

      three_questions: {
        what_worked:            r.what_worked,
        what_created_friction:  r.what_created_friction,
        what_would_you_change:  r.what_would_you_change,
      },

      patterns_detected: r.patterns_detected ?? [],

      forward_feed: {
        // Split by feed_type
        estimate_adjustments: r.forward_feed
          .filter((f) => f.feed_type === 'estimate_adjustment')
          .map((f) => f.content),
        behavioral_nudges: r.forward_feed
          .filter((f) => f.feed_type === 'behavioral_nudge')
          .map((f) => f.content),
        new_risk_cards: r.risk_cards,
      },

      // ship_retro only — empty array for milestone_retros
      scorecard:           r.retro_type === 'ship_retro' ? r.scorecard : undefined,
      founder_growth_read: r.retro_type === 'ship_retro' ? r.founder_growth_read : undefined,
    }));

    return res.json({
      project_id:     id,
      project_stage:  project.stage,
      retro_count:    formatted.length,
      retrospectives: formatted,
      v2_backlog:     backlog,
    });
  } catch (err) {
    next(err);
  }
});

// GET /projects/:id/retro/v2-backlog — dedicated v2 backlog endpoint
router.get('/v2-backlog', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: backlog } = await query(
      `SELECT * FROM v2_backlog WHERE project_id = $1 ORDER BY retro_id, id`,
      [id],
    );
    return res.json({ items: backlog });
  } catch (err) {
    next(err);
  }
});

export default router;
