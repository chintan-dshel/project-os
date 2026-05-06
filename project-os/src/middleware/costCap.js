import { query } from '../db/pool.js';

const CAP_USD = parseFloat(process.env.API_COST_CAP_USD ?? '2.00');

/**
 * costCapCheck — per-user monthly API cost gate.
 *
 * Queries agent_traces for the current calendar month and blocks requests
 * when the user's spend exceeds CAP_USD ($2 by default).
 *
 * Fails open on DB error so a DB outage never locks users out.
 */
export async function costCapCheck(req, res, next) {
  // Only gate write requests — GETs never trigger LLM calls
  if (req.method === 'GET') return next();

  const userId = req.user?.id;
  if (!userId) return next();

  try {
    const { rows } = await query(
      `SELECT COALESCE(SUM(cost_usd), 0)::float AS total
       FROM agent_traces
       WHERE user_id = $1
         AND date_trunc('month', created_at) = date_trunc('month', now())`,
      [userId],
    );
    const total = rows[0]?.total ?? 0;

    if (total >= CAP_USD) {
      return res.status(429).json({
        error: `Monthly API cost cap reached ($${CAP_USD.toFixed(2)}). Usage resets on the 1st.`,
        code:  'COST_CAP_EXCEEDED',
        spent: parseFloat(total.toFixed(4)),
        cap:   CAP_USD,
      });
    }
  } catch (err) {
    // Fail open — a DB error should not lock users out
    console.warn('[costCap] DB check failed, allowing request:', err.message);
  }

  next();
}
