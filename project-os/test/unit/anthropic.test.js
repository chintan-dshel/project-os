import { describe, test, expect, vi, afterEach } from 'vitest'

vi.mock('../../src/db/telemetry.queries.js', () => ({
  insertAgentTrace: vi.fn(),
}))

import { callClaude } from '../../src/lib/anthropic.js'
import { insertAgentTrace } from '../../src/db/telemetry.queries.js'

function mockFetch(text = 'ok', usage = { input_tokens: 10, output_tokens: 5 }) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:   true,
    json: async () => ({ content: [{ type: 'text', text }], usage }),
  })
}

function fkError(constraint = 'agent_traces_variant_id_fkey') {
  return Object.assign(new Error('FK violation'), { code: '23503', constraint })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('writeTrace — variant FK retry', () => {
  test('retries with variantId=null and succeeds', async () => {
    mockFetch('Hello')
    insertAgentTrace
      .mockRejectedValueOnce(fkError())
      .mockResolvedValueOnce('trace-456')

    const { text } = await callClaude({
      system:   'You are helpful.',
      messages: [{ role: 'user', content: 'Hello' }],
      meta:     { agent: 'intake', variantId: 'stale-deleted-uuid' },
    })

    expect(text).toBe('Hello')
    expect(insertAgentTrace).toHaveBeenCalledTimes(2)
    expect(insertAgentTrace.mock.calls[0][0].variantId).toBe('stale-deleted-uuid')
    expect(insertAgentTrace.mock.calls[1][0].variantId).toBeNull()
  })

  test('does not retry on a different FK constraint', async () => {
    mockFetch('Hello')
    insertAgentTrace.mockRejectedValue(fkError('agent_traces_project_id_fkey'))

    const { text } = await callClaude({
      system:   'You are helpful.',
      messages: [{ role: 'user', content: 'Hello' }],
      meta:     { agent: 'intake', variantId: 'some-id' },
    })

    expect(text).toBe('Hello')
    expect(insertAgentTrace).toHaveBeenCalledTimes(1)
  })

  test('succeeds without variant (no retry needed)', async () => {
    mockFetch('Hello')
    insertAgentTrace.mockResolvedValue('trace-789')

    const { text } = await callClaude({
      system:   'You are helpful.',
      messages: [{ role: 'user', content: 'Hello' }],
      meta:     { agent: 'intake' },
    })

    expect(text).toBe('Hello')
    expect(insertAgentTrace).toHaveBeenCalledTimes(1)
    expect(insertAgentTrace.mock.calls[0][0].variantId).toBeNull()
  })
})
