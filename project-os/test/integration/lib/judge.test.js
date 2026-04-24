import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { scoreAgentResponse } from '../../../src/lib/judge.js';
import { mockAnthropicSuccess } from '../../helpers/anthropicMock.js';
import { createTestUser } from '../../helpers/auth.js';
import { createTestTrace } from '../../helpers/fixtures.js';
import { query, cleanupUsers } from '../../helpers/db.js';

const TAG = '+judge-integration';
let user, trace;

const JUDGE_RESPONSE = JSON.stringify({
  inference_quality:        { score: 4, reason: 'Good inferences.' },
  assumption_transparency:  { score: 4, reason: 'Assumptions stated.' },
  success_criteria_quality: { score: 3, reason: 'Criteria could be sharper.' },
  scope_discipline:         { score: 4, reason: 'Scope is tight.' },
  overall:                  { score: 4, summary: 'Solid intake response.' },
});

beforeAll(async () => {
  ({ user } = await createTestUser(TAG));
  trace = await createTestTrace({ userId: user.id, agent: 'intake' });
});

afterAll(async () => {
  await query('DELETE FROM judge_scores WHERE agent_trace_id = $1', [trace.id]);
  await query('DELETE FROM agent_traces WHERE user_id = $1', [user.id]);
  await cleanupUsers(`%${TAG}%`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scoreAgentResponse', () => {
  test('inserts a judge_scores row with correct overall score', async () => {
    mockAnthropicSuccess(JUDGE_RESPONSE, { input_tokens: 150, output_tokens: 80 });

    await scoreAgentResponse({
      agentTraceId:  trace.id,
      agent:         'intake',
      input:         { system: 'sys', messages: [{ role: 'user', content: 'Build a todo app.' }] },
      output:        'Here is a brief for your todo app.',
      rubricVersion: 'intake-v1',
    });

    const { rows } = await query(
      'SELECT score_overall, reasoning FROM judge_scores WHERE agent_trace_id = $1',
      [trace.id],
    );
    expect(rows.length).toBe(1);
    expect(parseFloat(rows[0].score_overall)).toBe(4);
    expect(rows[0].reasoning).toBe('Solid intake response.');
  });

  test('is idempotent (ON CONFLICT DO NOTHING)', async () => {
    mockAnthropicSuccess(JUDGE_RESPONSE, { input_tokens: 150, output_tokens: 80 });

    await scoreAgentResponse({
      agentTraceId:  trace.id,
      agent:         'intake',
      input:         { system: 'sys', messages: [{ role: 'user', content: 'Build a todo app.' }] },
      output:        'Here is a brief.',
      rubricVersion: 'intake-v1',
    });

    const { rows } = await query(
      'SELECT COUNT(*) AS n FROM judge_scores WHERE agent_trace_id = $1',
      [trace.id],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  test('skips unknown agent without throwing', async () => {
    const spy = mockAnthropicSuccess(JUDGE_RESPONSE);
    await expect(
      scoreAgentResponse({
        agentTraceId:  trace.id,
        agent:         'unknown-agent',
        input:         { system: '', messages: [] },
        output:        'some output',
        rubricVersion: 'unknown-v1',
      }),
    ).resolves.not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });

  test('flags high-scoring trace as golden candidate', async () => {
    const highScoreResponse = JSON.stringify({
      inference_quality:        { score: 5, reason: 'Excellent.' },
      assumption_transparency:  { score: 5, reason: 'Perfect.' },
      success_criteria_quality: { score: 5, reason: 'Brilliant.' },
      scope_discipline:         { score: 5, reason: 'Tight.' },
      overall:                  { score: 5, summary: 'Outstanding.' },
    });

    // Use a fresh trace to avoid conflict
    const highTrace = await createTestTrace({ userId: user.id, agent: 'intake' });
    mockAnthropicSuccess(highScoreResponse, { input_tokens: 100, output_tokens: 60 });

    await scoreAgentResponse({
      agentTraceId:  highTrace.id,
      agent:         'intake',
      input:         { system: 'sys', messages: [{ role: 'user', content: 'Amazing project!' }] },
      output:        'Perfect brief.',
      rubricVersion: 'intake-v1',
    });

    const { rows } = await query(
      'SELECT status FROM golden_candidates WHERE agent_trace_id = $1',
      [highTrace.id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('pending');

    // Cleanup
    await query('DELETE FROM golden_candidates WHERE agent_trace_id = $1', [highTrace.id]);
    await query('DELETE FROM judge_scores WHERE agent_trace_id = $1', [highTrace.id]);
    await query('DELETE FROM agent_traces WHERE id = $1', [highTrace.id]);
  });
});
