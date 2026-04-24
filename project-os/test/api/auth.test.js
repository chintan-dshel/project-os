import { describe, test, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { cleanupUsers, query } from '../helpers/db.js';

const TAG = '+auth-api';

afterAll(async () => {
  await cleanupUsers(`%${TAG}%`);
});

describe('POST /auth/register', () => {
  test('201 + token on valid registration', async () => {
    const email = `test+${Date.now()}${TAG}@vitest.local`;
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
  });

  test('409 on duplicate email', async () => {
    const email = `test+dup${Date.now()}${TAG}@vitest.local`;
    await request(app).post('/auth/register').send({ email, password: 'password123' });
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });

    expect(res.status).toBe(409);
  });

  test('400 when password is too short', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: `short${TAG}@vitest.local`, password: 'short' });
    expect(res.status).toBe(400);
  });

  test('400 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'password123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  const email = `login${Date.now()}${TAG}@vitest.local`;

  beforeAll(async () => {
    await request(app).post('/auth/register').send({ email, password: 'correctpass' });
  });

  test('200 + token on valid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'correctpass' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('401 on wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('401 on unknown email', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: `nobody${TAG}@vitest.local`, password: 'pass' });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  let token;

  beforeAll(async () => {
    const email = `me${Date.now()}${TAG}@vitest.local`;
    const res = await request(app)
      .post('/auth/register')
      .send({ email, password: 'password123' });
    token = res.body.token;
  });

  test('200 with user payload for valid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeTruthy();
  });

  test('401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 with invalid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});
