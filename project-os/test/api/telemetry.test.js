import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { createTestUser } from '../helpers/auth.js';
import { createTestTrace } from '../helpers/fixtures.js';
import { query, cleanupUsers } from '../helpers/db.js';

const TAG = '+telemetry-api';
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser(TAG));
  // Insert a couple of traces so the endpoints return real data
  await createTestTrace({ userId: user.id, agent: 'intake', latencyMs: 300, costUsd: 0.001 });
  await createTestTrace({ userId: user.id, agent: 'planning', latencyMs: 600, costUsd: 0.002 });
});

afterAll(async () => {
  await query('DELETE FROM agent_traces WHERE user_id = $1', [user.id]);
  await cleanupUsers(`%${TAG}%`);
});

describe('GET /telemetry/summary', () => {
  test('200 with data object', async () => {
    const res = await request(app)
      .get('/telemetry/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(typeof res.body.data.total_calls).toBe('number');
    expect(res.body.data.total_calls).toBeGreaterThanOrEqual(2);
  });

  test('401 without token', async () => {
    const res = await request(app).get('/telemetry/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /telemetry/by-agent', () => {
  test('200 with array of agent rows', async () => {
    const res = await request(app)
      .get('/telemetry/by-agent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const agents = res.body.data.map(r => r.agent);
    expect(agents).toContain('intake');
  });
});

describe('GET /telemetry/timeseries', () => {
  test('200 with array', async () => {
    const res = await request(app)
      .get('/telemetry/timeseries?granularity=day')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /telemetry/latency', () => {
  test('200 with percentile object', async () => {
    const res = await request(app)
      .get('/telemetry/latency')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('p50');
    expect(res.body.data).toHaveProperty('p95');
    expect(res.body.data).toHaveProperty('p99');
  });
});
