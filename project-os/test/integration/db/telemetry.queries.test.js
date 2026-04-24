import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import {
  insertAgentTrace,
  getSummary,
  getByAgent,
  getTimeseries,
  getLatencyPercentiles,
} from '../../../src/db/telemetry.queries.js';
import { createTestUser } from '../../helpers/auth.js';
import { query, cleanupUsers } from '../../helpers/db.js';

const TAG = '+telemetry-queries';
let user;

async function insertTrace(overrides = {}) {
  return insertAgentTrace({
    projectId: null, userId: user.id, conversationId: null,
    agent: overrides.agent ?? 'intake',
    model: 'claude-sonnet-4-20250514',
    promptTokens: 100, completionTokens: 50,
    inputPricePerMtok: 3.00, outputPricePerMtok: 15.00, costUsd: 0.001,
    latencyMs: overrides.latencyMs ?? 300,
    status: overrides.status ?? 'success',
    errorMessage: overrides.errorMessage ?? null,
    variantId: null,
  });
}

beforeAll(async () => {
  ({ user } = await createTestUser(TAG));
});

afterAll(async () => {
  await query('DELETE FROM agent_traces WHERE user_id = $1', [user.id]);
  await cleanupUsers(`%${TAG}%`);
});

describe('insertAgentTrace', () => {
  test('inserts a trace and returns a non-null string id', async () => {
    const id = await insertTrace({ status: 'success' });
    expect(id).not.toBeNull();
    expect(String(id).length).toBeGreaterThan(0);
  });

  test('inserts an error trace', async () => {
    const id = await insertTrace({ status: 'error', errorMessage: 'timeout' });
    expect(id).not.toBeNull();
  });
});

describe('getSummary', () => {
  beforeAll(async () => {
    await insertTrace({ status: 'success', latencyMs: 200 });
    await insertTrace({ status: 'error',   latencyMs: 800 });
  });

  test('aggregates cost, calls, and tokens', async () => {
    const summary = await getSummary({ userId: user.id });
    expect(summary.total_calls).toBeGreaterThanOrEqual(2);
    expect(typeof summary.total_cost_usd).toBe('number');
    expect(typeof summary.error_count).toBe('number');
    expect(summary.error_count).toBeGreaterThanOrEqual(1);
  });
});

describe('getByAgent', () => {
  beforeAll(async () => {
    await insertTrace({ agent: 'intake',    status: 'success' });
    await insertTrace({ agent: 'planning',  status: 'success' });
    await insertTrace({ agent: '__judge__', status: 'success' });
  });

  test('groups calls by agent', async () => {
    const rows = await getByAgent({ userId: user.id });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const intakeRow = rows.find(r => r.agent === 'intake');
    expect(intakeRow).toBeTruthy();
    expect(intakeRow.calls).toBeGreaterThanOrEqual(1);
  });

  test('excludes __judge__ agent from results', async () => {
    const rows = await getByAgent({ userId: user.id });
    expect(rows.find(r => r.agent === '__judge__')).toBeUndefined();
  });
});

describe('getTimeseries', () => {
  test('returns time-bucketed rows', async () => {
    const rows = await getTimeseries({ userId: user.id, granularity: 'day' });
    expect(Array.isArray(rows)).toBe(true);
    if (rows.length > 0) {
      expect(rows[0]).toHaveProperty('bucket');
      expect(rows[0]).toHaveProperty('calls');
    }
  });
});

describe('getLatencyPercentiles', () => {
  test('returns p50 / p95 / p99 for successful traces', async () => {
    const p = await getLatencyPercentiles({ userId: user.id });
    expect(p).toHaveProperty('p50');
    expect(p).toHaveProperty('p95');
    expect(p).toHaveProperty('p99');
  });
});
