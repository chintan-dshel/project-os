import { describe, test, expect, beforeEach } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimit.js';

function makeReq(userId = 'user-1') {
  return { user: { id: userId }, path: '/test' };
}

function makeRes() {
  const headers = {};
  return {
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    set(k, v) { headers[k] = v; return this; },
    _status: null, _body: null, headers,
  };
}

describe('createRateLimiter', () => {
  let fakeNow;
  let limiter;

  beforeEach(() => {
    fakeNow = Date.now();
    limiter = createRateLimiter({ now: () => fakeNow, hourMax: 3, dayMax: 10 });
  });

  test('allows requests under the hour limit', () => {
    const next = vi.fn();
    limiter(makeReq(), makeRes(), next);
    limiter(makeReq(), makeRes(), next);
    limiter(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  test('returns 429 when hour limit is hit', () => {
    const next = vi.fn();
    limiter(makeReq(), makeRes(), next); // 1
    limiter(makeReq(), makeRes(), next); // 2
    limiter(makeReq(), makeRes(), next); // 3 — at limit
    const res = makeRes();
    limiter(makeReq(), res, next);       // 4 — over
    expect(res._status).toBe(429);
    expect(res._body.error.code).toBe('RATE_LIMITED');
    expect(res._body.error.limit.window).toBe('hour');
    expect(next).toHaveBeenCalledTimes(3);
  });

  test('returns Retry-After header on 429', () => {
    const next = vi.fn();
    for (let i = 0; i < 3; i++) limiter(makeReq(), makeRes(), next);
    const res = makeRes();
    limiter(makeReq(), res, vi.fn());
    expect(res.headers['Retry-After']).toBeTruthy();
  });

  test('sliding window allows requests after hour expires', () => {
    const next = vi.fn();
    for (let i = 0; i < 3; i++) limiter(makeReq(), makeRes(), next);

    // Advance time past 1 hour so all old entries are pruned
    fakeNow += 60 * 60 * 1000 + 1;

    const res = makeRes();
    limiter(makeReq(), res, next);
    expect(res._status).not.toBe(429);
    expect(next).toHaveBeenCalledTimes(4);
  });

  test('requests from different users do not interfere', () => {
    const next = vi.fn();
    for (let i = 0; i < 3; i++) {
      limiter(makeReq('user-A'), makeRes(), next);
    }
    const res = makeRes();
    limiter(makeReq('user-B'), res, next);
    expect(res._status).not.toBe(429);
    expect(next).toHaveBeenCalledTimes(4);
  });

  test('skips rate limit if user is not authenticated', () => {
    const next = vi.fn();
    const req = { path: '/test' }; // no req.user
    limiter(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  test('exposes _store and _sweepTimer for inspection', () => {
    expect(limiter._store).toBeInstanceOf(Map);
    expect(limiter._sweepTimer).toBeTruthy();
  });
});
