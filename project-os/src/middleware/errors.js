/**
 * Central error handler — attach as the last app.use() call.
 * Converts known error shapes into consistent JSON responses.
 */

export function errorHandler(err, req, res, _next) {
  // ── Stage gate failures ────────────────────────────────────────────────────
  // GateError has a stable `code` string, a `redirect` stage, and `context`.
  // Status 422 (Unprocessable Entity) signals "request understood but blocked
  // by a business rule" — distinct from 400 (malformed) or 403 (forbidden).
  if (err.name === 'GateError') {
    return res.status(422).json({
      error:    err.message,
      code:     err.code,       // e.g. "GATE_LOW_CONFIDENCE" — switch on this client-side
      redirect: err.redirect,   // stage the project should fall back to
      context:  err.context,    // diagnostic data: scores, ids, flags
    });
  }

  // Postgres constraint / not-null violations
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Conflict', detail: err.detail });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }
  if (err.code === '23503') {
    return res.status(404).json({ error: 'Referenced record not found', detail: err.detail });
  }
  if (err.code?.startsWith('23')) {
    return res.status(400).json({ error: 'Database constraint violation', detail: err.detail });
  }

  // Application-level errors thrown explicitly
  if (err.status === 404) {
    return res.status(404).json({ error: err.message ?? 'Not found' });
  }
  if (err.status === 400) {
    return res.status(400).json({ error: err.message ?? 'Bad request' });
  }
  if (err.status === 409) {
    return res.status(409).json({ error: err.message ?? 'Conflict' });
  }

  // Fallback
  console.error('[error]', err);
  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
}

/** Throw these from route handlers for clean error responses */
export function notFound(msg = 'Not found') {
  const e = new Error(msg);
  e.status = 404;
  return e;
}

export function badRequest(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

export function conflict(msg) {
  const e = new Error(msg);
  e.status = 409;
  return e;
}
