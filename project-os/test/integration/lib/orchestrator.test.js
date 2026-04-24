import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { runWithOrchestration } from '../../../src/lib/orchestrator.js';
import { mockAnthropicSuccess, mockAnthropicError } from '../../helpers/anthropicMock.js';
import { createTestUser } from '../../helpers/auth.js';
import { createTestProject } from '../../helpers/fixtures.js';
import { query, cleanupUsers } from '../../helpers/db.js';

const TAG = '+orchestrator';
let user, project;

beforeAll(async () => {
  ({ user } = await createTestUser(TAG));
  project = await createTestProject(user.id, { stage: 'intake' });
});

afterAll(async () => {
  await query('DELETE FROM agent_traces WHERE user_id = $1', [user.id]);
  await query('DELETE FROM routing_decisions WHERE agent = $1', ['intake']);
  await query('DELETE FROM conversation_history WHERE project_id = $1', [project.id]);
  await query('DELETE FROM projects WHERE id = $1', [project.id]);
  await cleanupUsers(`%${TAG}%`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runWithOrchestration', () => {
  test('returns a reply when Anthropic succeeds', async () => {
    mockAnthropicSuccess('Hello! Tell me about your project.', { input_tokens: 50, output_tokens: 20 });

    const result = await runWithOrchestration({
      project,
      state:       null,
      history:     [],
      userMessage: 'I want to build a SaaS.',
      meta:        { projectId: project.id, userId: user.id, conversationId: null, agent: 'intake' },
    });

    expect(result.reply).toBe('Hello! Tell me about your project.');
    expect(result.advance_stage).toBeNull();
  });

  test('writes an agent_trace row to the DB', async () => {
    mockAnthropicSuccess('Good to hear.', { input_tokens: 60, output_tokens: 25 });

    await runWithOrchestration({
      project,
      state:       null,
      history:     [],
      userMessage: 'Update on my project.',
      meta:        { projectId: project.id, userId: user.id, conversationId: null, agent: 'intake' },
    });

    const { rows } = await query(
      `SELECT id, status FROM agent_traces
       WHERE project_id = $1 AND status = 'success'
       ORDER BY created_at DESC LIMIT 1`,
      [project.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('success');
  });

  test('logs a routing_decision (fire-and-forget — poll with waitFor)', async () => {
    mockAnthropicSuccess('Noted.', { input_tokens: 30, output_tokens: 10 });

    const before = new Date();

    await runWithOrchestration({
      project,
      state:       null,
      history:     [],
      userMessage: 'Quick update.',
      meta:        { projectId: project.id, userId: user.id, conversationId: null, agent: 'intake' },
    });

    await vi.waitFor(async () => {
      const { rows } = await query(
        `SELECT id FROM routing_decisions WHERE agent = 'intake' AND created_at >= $1 LIMIT 1`,
        [before],
      );
      expect(rows.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  test('throws a non-retryable error immediately', async () => {
    mockAnthropicError(401, 'Unauthorized');

    await expect(
      runWithOrchestration({
        project,
        state:       null,
        history:     [],
        userMessage: 'Test error path.',
        meta:        { projectId: project.id, userId: user.id, conversationId: null, agent: 'intake' },
      }),
    ).rejects.toThrow();
  });
});
