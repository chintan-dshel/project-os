// TODO: move to Redis if multi-instance

import { query } from '../db/pool.js';

const HOUR_MS  = 60 * 60 * 1000;
const DAY_MS   = 24 * HOUR_MS;
const HOUR_MAX = 20;
const DAY_MAX  = 200;

// Migration guard — checked once at module load, cached for the process lifetime.
let rlTableReady = false;
query(`SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'rate_limit_events'`)
  .then(({ rows }) => { rlTableReady = rows.length > 0; })
  .catch(() => { rlTableReady = false; });

function logRateLimitEvent(userId, windowName, windowMax, used, retryAfterSeconds, path) {
  if (!rlTableReady) return;
  query(
    `INSERT INTO rate_limit_events
       (user_id, window_name, window_max, used, retry_after_seconds, path)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, windowName, windowMax, used, retryAfterSeconds, path ?? null],
  ).catch(err => console.error('[rateLimit] event log failed', err));
}

/**
 * createRateLimiter — factory for testable rate-limit middleware.
 *
 * @param {object} opts
 * @param {() => number} [opts.now]      - clock function, default Date.now
 * @param {number}       [opts.hourMax]  - requests per hour limit
 * @param {number}       [opts.dayMax]   - requests per day limit
 */
export function createRateLimiter({ now = Date.now, hourMax = HOUR_MAX, dayMax = DAY_MAX } = {}) {
  // Map<userId, { hour: number[], day: number[] }>
  const store = new Map();

  function prune(userId) {
    const n     = now();
    const entry = store.get(userId);
    if (!entry) return null;
    entry.hour = entry.hour.filter(ts => n - ts < HOUR_MS);
    entry.day  = entry.day.filter(ts => n - ts < DAY_MS);
    return entry;
  }

  const sweepTimer = setInterval(() => {
    const n = now();
    for (const [userId, entry] of store.entries()) {
      const active = entry.day.some(ts => n - ts < DAY_MS);
      if (!active) store.delete(userId);
    }
  }, 10 * 60 * 1000);

  // Don't keep the test process alive just because the sweep timer exists.
  if (sweepTimer.unref) sweepTimer.unref();

  function middleware(req, res, next) {
    const userId = req.user?.id;
    if (!userId) return next();

    const n     = now();
    let entry   = prune(userId);
    if (!entry) {
      entry = { hour: [], day: [] };
      store.set(userId, entry);
    }

    if (entry.hour.length >= hourMax) {
      const oldest     = entry.hour[0];
      const retryAfter = Math.ceil((oldest + HOUR_MS - n) / 1000);
      logRateLimitEvent(userId, 'hour', hourMax, entry.hour.length, retryAfter, req.path);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: {
          code:               'RATE_LIMITED',
          message:            'Rate limit exceeded.',
          retry_after_seconds: retryAfter,
          limit: { window: 'hour', max: hourMax, used: entry.hour.length },
        },
      });
    }

    if (entry.day.length >= dayMax) {
      const oldest     = entry.day[0];
      const retryAfter = Math.ceil((oldest + DAY_MS - n) / 1000);
      logRateLimitEvent(userId, 'day', dayMax, entry.day.length, retryAfter, req.path);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: {
          code:               'RATE_LIMITED',
          message:            'Rate limit exceeded.',
          retry_after_seconds: retryAfter,
          limit: { window: 'day', max: dayMax, used: entry.day.length },
        },
      });
    }

    entry.hour.push(n);
    entry.day.push(n);
    next();
  }

  // Expose internals for testing only — not part of the production contract.
  middleware._store      = store;
  middleware._sweepTimer = sweepTimer;

  return middleware;
}

// Production singleton — uses real clock and default limits.
export const rateLimit = createRateLimiter();
