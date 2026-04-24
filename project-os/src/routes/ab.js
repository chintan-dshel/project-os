import { Router }       from 'express';
import { query }        from '../db/pool.js';
import { badRequest }   from '../middleware/errors.js';
import { createHash }   from 'crypto';

const router = Router();

// ── Variants ──────────────────────────────────────────────────────────────────

// GET /ab/variants
router.get('/variants', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, experiment_key, variant_name, agent, model,
              system_prompt_hash, temperature, config, active, traffic_weight, created_at
       FROM ab_variants ORDER BY experiment_key, variant_name`,
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /ab/variants
router.post('/variants', async (req, res, next) => {
  try {
    const { experiment_key, variant_name, agent, model, system_prompt, temperature = 1.0, config = {}, traffic_weight = 50 } = req.body;
    if (!experiment_key || !variant_name || !agent || !model) throw badRequest('experiment_key, variant_name, agent, model required');

    const hash = createHash('sha256').update(system_prompt ?? '').digest('hex');
    const { rows } = await query(
      `INSERT INTO ab_variants
         (experiment_key, variant_name, agent, model, system_prompt, system_prompt_hash, temperature, config, traffic_weight)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [experiment_key, variant_name, agent, model, system_prompt ?? null, hash, temperature, JSON.stringify(config), traffic_weight],
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /ab/variants/:id
router.patch('/variants/:id', async (req, res, next) => {
  try {
    const allowed = ['active', 'traffic_weight', 'system_prompt', 'temperature', 'config'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(updates).length) throw badRequest('No valid fields to update');

    if ('system_prompt' in updates) {
      updates.system_prompt_hash = createHash('sha256').update(updates.system_prompt ?? '').digest('hex');
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rows } = await query(
      `UPDATE ab_variants SET ${setClauses} WHERE id = $1 RETURNING *`,
      [req.params.id, ...Object.values(updates)],
    );
    if (!rows.length) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /ab/variants/:id — deactivate only (soft delete)
router.delete('/variants/:id', async (req, res, next) => {
  try {
    await query(`UPDATE ab_variants SET active = false WHERE id = $1`, [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── Results ───────────────────────────────────────────────────────────────────

// GET /ab/results?experiment_key=...
router.get('/results', async (req, res, next) => {
  try {
    const { experiment_key } = req.query;
    if (!experiment_key) throw badRequest('experiment_key required');

    const { rows } = await query(
      `SELECT
         v.variant_name,
         v.model,
         v.traffic_weight,
         COUNT(at.id)::int                               AS sample_size,
         ROUND(AVG(js.score_overall), 3)::float          AS avg_judge_score,
         ROUND(AVG(at.latency_ms))::int                  AS avg_latency_ms,
         COALESCE(SUM(at.cost_usd), 0)::float            AS total_cost_usd,
         COUNT(at.id) FILTER (WHERE at.status = 'error')::int AS error_count
       FROM ab_variants v
       LEFT JOIN agent_traces at ON at.variant_id = v.id
       LEFT JOIN judge_scores js ON js.agent_trace_id = at.id
       WHERE v.experiment_key = $1
       GROUP BY v.id, v.variant_name, v.model, v.traffic_weight
       ORDER BY v.variant_name`,
      [experiment_key],
    );

    // Minimum sample size warning
    const MIN_SAMPLE = 50;
    const hasEnough = rows.every(r => r.sample_size >= MIN_SAMPLE);

    res.json({ experiment_key, results: rows, sample_size_warning: !hasEnough, min_sample: MIN_SAMPLE });
  } catch (err) { next(err); }
});

export default router;
