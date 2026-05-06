import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { createTestUser } from '../helpers/auth.js';
import { createTestProject } from '../helpers/fixtures.js';
import { query, cleanupUsers } from '../helpers/db.js';

const TAG = '+knowledge-api';
let userA, tokenA, userB, tokenB, projectA;

beforeAll(async () => {
  ({ user: userA, token: tokenA } = await createTestUser(`${TAG}-a`));
  ({ user: userB, token: tokenB } = await createTestUser(`${TAG}-b`));
  projectA = await createTestProject(userA.id);
});

afterAll(async () => {
  await query('DELETE FROM knowledge_entries WHERE project_id = $1', [projectA.id]);
  await query('DELETE FROM projects WHERE id = $1', [projectA.id]);
  await cleanupUsers(`%${TAG}%`);
});

describe('POST /knowledge — ownership check', () => {
  test('404 when project_id belongs to a different user', async () => {
    const res = await request(app)
      .post('/knowledge')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        project_id: projectA.id,
        type: 'lesson_learned',
        title: 'Injected entry',
        content: 'This should not be written.',
        source_type: 'manual',
      });

    expect(res.status).toBe(404);
  });

  test('201 when project_id is omitted (global entry)', async () => {
    const res = await request(app)
      .post('/knowledge')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        type: 'lesson_learned',
        title: 'Global entry',
        content: 'No project attached.',
        source_type: 'manual',
      });

    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({ title: 'Global entry' });
    await query('DELETE FROM knowledge_entries WHERE id = $1', [res.body.entry.id]);
  });

  test('201 when project_id belongs to the requesting user', async () => {
    const res = await request(app)
      .post('/knowledge')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        project_id: projectA.id,
        type: 'lesson_learned',
        title: 'Owner entry',
        content: 'Written by the owner.',
        source_type: 'manual',
      });

    expect(res.status).toBe(201);
    expect(res.body.entry.project_id).toBe(projectA.id);
  });
});

describe('POST /knowledge — authentication', () => {
  test('401 without Authorization header', async () => {
    const res = await request(app)
      .post('/knowledge')
      .send({ title: 'test', content: 'test' });
    expect(res.status).toBe(401);
  });
});
