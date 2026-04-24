import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { createTestUser } from '../helpers/auth.js';
import { query, cleanupUsers } from '../helpers/db.js';

const TAG = '+ab-api';
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser(TAG));
});

afterAll(async () => {
  await query(`DELETE FROM ab_variants WHERE experiment_key LIKE 'vitest-%'`);
  await cleanupUsers(`%${TAG}%`);
});

const validPayload = () => ({
  experiment_key: `vitest-${Date.now()}`,
  variant_name:   'control',
  agent:          'intake',
  model:          'claude-sonnet-4-20250514',
  traffic_weight: 50,
});

describe('POST /ab/variants', () => {
  test('201 creates a variant', async () => {
    const res = await request(app)
      .post('/ab/variants')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.active).toBe(true);
  });

  test('400 when required field is missing', async () => {
    const { model: _, ...incomplete } = validPayload();
    const res = await request(app)
      .post('/ab/variants')
      .set('Authorization', `Bearer ${token}`)
      .send(incomplete);
    expect(res.status).toBe(400);
  });

  test('401 without token', async () => {
    const res = await request(app).post('/ab/variants').send(validPayload());
    expect(res.status).toBe(401);
  });
});

describe('GET /ab/variants', () => {
  test('200 returns array', async () => {
    const res = await request(app)
      .get('/ab/variants')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PATCH /ab/variants/:id', () => {
  let variantId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/ab/variants')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());
    variantId = res.body.id;
  });

  test('200 updates traffic_weight', async () => {
    const res = await request(app)
      .patch(`/ab/variants/${variantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ traffic_weight: 75 });
    expect(res.status).toBe(200);
    expect(res.body.traffic_weight).toBe(75);
  });

  test('200 toggles active to false', async () => {
    const res = await request(app)
      .patch(`/ab/variants/${variantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  test('400 when no valid fields are sent', async () => {
    const res = await request(app)
      .patch(`/ab/variants/${variantId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ unknown_field: 'value' });
    expect(res.status).toBe(400);
  });

  test('404 for non-existent variant', async () => {
    const res = await request(app)
      .patch('/ab/variants/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .send({ active: true });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /ab/variants/:id (soft delete)', () => {
  let variantId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/ab/variants')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());
    variantId = res.body.id;
  });

  test('204 deactivates variant', async () => {
    const res = await request(app)
      .delete(`/ab/variants/${variantId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const { rows } = await query('SELECT active FROM ab_variants WHERE id = $1', [variantId]);
    expect(rows[0].active).toBe(false);
  });
});

describe('GET /ab/results', () => {
  test('400 when experiment_key is missing', async () => {
    const res = await request(app)
      .get('/ab/results')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('200 returns results structure for a known experiment', async () => {
    const expKey = `vitest-results-${Date.now()}`;
    await request(app)
      .post('/ab/variants')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), experiment_key: expKey });

    const res = await request(app)
      .get(`/ab/results?experiment_key=${encodeURIComponent(expKey)}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.experiment_key).toBe(expKey);
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});
