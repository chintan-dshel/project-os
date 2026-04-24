import { Router } from 'express';
import { transaction, query } from '../db/pool.js';
import {
  createProject,
  findProjectById,
  findProjectState,
  insertSuccessCriteria,
  insertScopeItems,
  insertSkills,
  insertOpenQuestions,
} from '../db/projects.queries.js';
import { badRequest, notFound } from '../middleware/errors.js';

const router = Router();

// GET /projects — list all projects
// ?archived=true includes archived; default excludes them
router.get('/', async (req, res, next) => {
  try {
    const includeArchived = req.query.archived === 'true'
    const userId = req.user?.id ?? null;
    const archiveClause = includeArchived ? '' : 'AND (is_archived = FALSE OR is_archived IS NULL)';
    const { rows } = await query(
      `SELECT id, title, stage, overall_status, momentum_score, confidence_score,
              total_estimated_hours, planned_weeks, one_liner, created_at, updated_at,
              last_checkin_at, is_archived, archived_at
       FROM projects
       WHERE (user_id = $1 OR user_id IS NULL)
       ${archiveClause}
       ORDER BY updated_at DESC`,
      [userId],
    );
    return res.json({ projects: rows });
  } catch (err) { next(err); }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /projects
// Body: project_brief JSON (Intake Agent output) or minimal seed object
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    // Support both raw fields and the nested project_brief wrapper
    const body = req.body?.project_brief ?? req.body;

    const {
      title,
      one_liner,
      project_type,
      target_user,
      core_problem,
      success_criteria = [],
      v1_scope = {},
      constraints = {},
      risks = [],
      open_questions = [],
      confidence_score,
    } = body;

    if (!title) throw badRequest('title is required');

    const project = await transaction(async (client) => {
      // 1. Insert the master project row
      const { rows } = await client.query(
        `INSERT INTO projects
           (title, one_liner, project_type, target_user, core_problem,
            hours_per_week, budget, confidence_score, stage, overall_status, user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'intake','on_track',$9)
         RETURNING *`,
        [
          title,
          one_liner ?? null,
          project_type ?? null,
          target_user ?? null,
          core_problem ?? null,
          constraints.hours_per_week ?? null,
          constraints.budget ?? null,
          confidence_score ?? null,
          req.user?.id ?? null,
        ],
      );
      const p = rows[0];

      // 2. Normalise intake arrays into their own tables
      await insertSuccessCriteria(client, p.id, success_criteria);
      await insertScopeItems(client, p.id, v1_scope.in_scope, v1_scope.out_of_scope);
      await insertSkills(client, p.id, constraints.skills_available, constraints.skills_needed);
      await insertOpenQuestions(client, p.id, open_questions);

      // 3. Seed open risks into risk_register (Intake Agent flags these)
      for (const r of risks) {
        await client.query(
          `INSERT INTO risk_register
             (project_id, description, likelihood, impact, risk_score,
              owner, status, source_agent)
           VALUES ($1,$2,'medium','medium',4,$3,'open','intake')`,
          [p.id, typeof r === 'string' ? r : r.description, 'founder'],
        );
      }

      return p;
    });

    // Return the full hydrated record
    const full = await findProjectById(project.id);
    return res.status(201).json({ project: full });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /projects/:id
// Returns the project brief + full execution state in one payload
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const [brief, state] = await Promise.all([
      findProjectById(req.params.id),
      findProjectState(req.params.id),
    ]);

    if (!brief) throw notFound('Project not found');

    return res.json({
      project: brief,
      state,
    });
  } catch (err) {
    next(err);
  }
});

// POST /projects/:id/archive
router.post('/:id/archive', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE projects SET is_archived=TRUE, archived_at=now() WHERE id=$1 RETURNING id, title, is_archived, archived_at`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' })
    res.json({ project: rows[0] })
  } catch (err) { next(err) }
})

// POST /projects/:id/unarchive
router.post('/:id/unarchive', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE projects SET is_archived=FALSE, archived_at=NULL WHERE id=$1 RETURNING id, title, is_archived`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' })
    res.json({ project: rows[0] })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `DELETE FROM projects WHERE id=$1 RETURNING id`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' })
    res.json({ deleted: true, id: rows[0].id })
  } catch (err) { next(err) }
})

export default router;
