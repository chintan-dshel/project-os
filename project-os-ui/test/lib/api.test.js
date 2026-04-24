import { describe, test, expect, beforeEach, afterEach } from 'vitest';

// api.js uses localStorage for the token — configure it before importing
beforeEach(() => {
  localStorage.setItem('project-os:token', 'test-jwt-token');
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// Import after localStorage is seeded (module is re-imported per file in jsdom)
const { fetchTelemetrySummary, listVariants, toggleVariant } = await import('../../src/lib/api.js');

function mockFetch(data, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => data,
  });
}

describe('fetchTelemetrySummary', () => {
  test('calls /telemetry/summary with Bearer token', async () => {
    const spy = mockFetch({ data: { total_calls: 5, total_cost_usd: 0.01, total_tokens: 500, error_count: 0 } });

    const result = await fetchTelemetrySummary({ from: '2025-01-01', to: '2025-01-07' });

    expect(spy).toHaveBeenCalledOnce();
    const [url, opts] = spy.mock.calls[0];
    expect(url).toContain('/telemetry/summary');
    expect(opts.headers.Authorization).toBe('Bearer test-jwt-token');
    expect(result.data.total_calls).toBe(5);
  });

  test('throws when response is not ok', async () => {
    mockFetch({ error: 'Unauthorized' }, 401);
    await expect(fetchTelemetrySummary()).rejects.toThrow();
  });
});

describe('listVariants', () => {
  test('calls /ab/variants', async () => {
    const spy = mockFetch([{ id: '1', experiment_key: 'test', active: true }]);

    const result = await listVariants();

    const [url] = spy.mock.calls[0];
    expect(url).toContain('/ab/variants');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('toggleVariant', () => {
  test('sends PATCH to /ab/variants/:id with active payload', async () => {
    const spy = mockFetch({ id: '1', active: false });

    await toggleVariant('variant-uuid', false);

    const [url, opts] = spy.mock.calls[0];
    expect(url).toContain('/ab/variants/variant-uuid');
    expect(opts.method).toBe('PATCH');
    expect(JSON.parse(opts.body)).toEqual({ active: false });
  });
});
