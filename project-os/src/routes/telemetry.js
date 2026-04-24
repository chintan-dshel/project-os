import { Router } from 'express';
import { query }  from '../db/pool.js';
import {
  getSummary,
  getByAgent,
  getTimeseries,
  getLatencyPercentiles,
} from '../db/telemetry.queries.js';

const router = Router();

const EMPTY_SUMMARY    = { total_cost_usd: 0, total_calls: 0, total_tokens: 0, error_count: 0 };
const EMPTY_PERCENTILE = { p50: null, p95: null, p99: null };

// Migration guard — checked once at module load and on each request to handle drop/recreate.
async function tableExists() {
  const { rows } = await query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'agent_traces'`,
  ).catch(() => ({ rows: [] }));
  return rows.length > 0;
}

function missingTableResponse(res, emptyData) {
  res.set('X-Telemetry-Warning', 'migration-pending');
  return res.json({
    warning: 'Telemetry table not found. Run migration 012_telemetry.sql.',
    data:    emptyData,
  });
}

// Resolve optional ?project_id= and verify it belongs to the authed user.
async function resolveProjectId(req, res) {
  const { project_id } = req.query;
  if (!project_id) return { ok: true, projectId: null };

  const { rows } = await query(
    `SELECT id FROM projects WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)`,
    [project_id, req.user.id],
  ).catch(() => ({ rows: [] }));

  if (rows.length === 0) {
    res.status(403).json({ error: 'Project not found or access denied.' });
    return { ok: false };
  }
  return { ok: true, projectId: project_id };
}

function parseDateRange(query_) {
  return { from: query_.from ?? null, to: query_.to ?? null };
}

// GET /telemetry/summary
router.get('/summary', async (req, res, next) => {
  try {
    if (!await tableExists()) return missingTableResponse(res, EMPTY_SUMMARY);
    const { ok, projectId } = await resolveProjectId(req, res);
    if (!ok) return;
    const { from, to } = parseDateRange(req.query);
    const data = await getSummary({ projectId, userId: req.user.id, from, to });
    return res.json({ data });
  } catch (err) { next(err); }
});

// GET /telemetry/by-agent
router.get('/by-agent', async (req, res, next) => {
  try {
    if (!await tableExists()) return missingTableResponse(res, []);
    const { ok, projectId } = await resolveProjectId(req, res);
    if (!ok) return;
    const { from, to } = parseDateRange(req.query);
    const data = await getByAgent({ projectId, userId: req.user.id, from, to });
    return res.json({ data });
  } catch (err) { next(err); }
});

// GET /telemetry/timeseries?granularity=day|hour
router.get('/timeseries', async (req, res, next) => {
  try {
    if (!await tableExists()) return missingTableResponse(res, []);
    const { ok, projectId } = await resolveProjectId(req, res);
    if (!ok) return;
    const { from, to }    = parseDateRange(req.query);
    const granularity     = req.query.granularity === 'hour' ? 'hour' : 'day';
    const data = await getTimeseries({ projectId, userId: req.user.id, granularity, from, to });
    return res.json({ data });
  } catch (err) { next(err); }
});

// GET /telemetry/latency
router.get('/latency', async (req, res, next) => {
  try {
    if (!await tableExists()) return missingTableResponse(res, EMPTY_PERCENTILE);
    const { ok, projectId } = await resolveProjectId(req, res);
    if (!ok) return;
    const { from, to } = parseDateRange(req.query);
    const data = await getLatencyPercentiles({ projectId, userId: req.user.id, from, to });
    return res.json({ data: data ?? EMPTY_PERCENTILE });
  } catch (err) { next(err); }
});

export default router;
