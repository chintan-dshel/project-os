import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { resolveVariant } from '../../../src/lib/abAssigner.js';
import { createTestUser } from '../../helpers/auth.js';
import { createTestProject, createTestVariant } from '../../helpers/fixtures.js';
import { query, cleanupUsers } from '../../helpers/db.js';

const TAG = '+ab-assigner';
let user, project;

beforeAll(async () => {
  ({ user } = await createTestUser(TAG));
  project = await createTestProject(user.id);
});

afterAll(async () => {
  await query('DELETE FROM ab_assignments WHERE project_id = $1', [project.id]);
  await query('DELETE FROM ab_variants WHERE experiment_key LIKE $1', [`test-exp-%`]);
  await query('DELETE FROM projects WHERE id = $1', [project.id]);
  await cleanupUsers(`%${TAG}%`);
});

describe('resolveVariant', () => {
  test('returns null when no active variants exist', async () => {
    const result = await resolveVariant(project.id, 'planning');
    expect(result).toBeNull();
  });

  test('returns a variant when one active variant exists', async () => {
    const expKey = `test-exp-${Date.now()}`;
    await createTestVariant(expKey, {
      agent: 'intake',
      model: 'claude-haiku-4-5-20251001',
      trafficWeight: 100,
    });

    const result = await resolveVariant(project.id, 'intake');
    expect(result).not.toBeNull();
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.variantId).toBeTruthy();
  });

  test('sticky assignment returns the same variant on second call', async () => {
    const expKey = `test-exp-sticky-${Date.now()}`;
    const variantA = await createTestVariant(expKey, {
      variantName: 'a', agent: 'intake',
      model: 'claude-sonnet-4-20250514', trafficWeight: 50,
    });
    const variantB = await createTestVariant(expKey, {
      variantName: 'b', agent: 'intake',
      model: 'claude-opus-4-7-20251101', trafficWeight: 50,
    });

    // Create a fresh project so there's no prior assignment
    const freshProject = await createTestProject(user.id);

    const first  = await resolveVariant(freshProject.id, 'intake');
    const second = await resolveVariant(freshProject.id, 'intake');

    expect(first.variantId).toBe(second.variantId);

    // Cleanup
    await query('DELETE FROM ab_assignments WHERE project_id = $1', [freshProject.id]);
    await query('DELETE FROM ab_variants WHERE id IN ($1, $2)', [variantA.id, variantB.id]);
    await query('DELETE FROM projects WHERE id = $1', [freshProject.id]);
  });

  test('returns null for missing projectId', async () => {
    expect(await resolveVariant(null, 'intake')).toBeNull();
  });

  test('returns null for missing agent', async () => {
    expect(await resolveVariant(project.id, null)).toBeNull();
  });
});
