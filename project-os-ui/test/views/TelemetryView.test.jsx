import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TelemetryView from '../../src/views/TelemetryView.jsx';

function mockFetch(overrides = {}) {
  const defaults = {
    summary:    { data: { total_cost_usd: 1.23, total_calls: 42, total_tokens: 15000, error_count: 2 } },
    byAgent:    { data: [{ agent: 'intake', calls: 20, cost_usd: 0.5, avg_latency_ms: 450, error_count: 0 }] },
    timeseries: { data: [{ bucket: '2025-01-01T00:00:00Z', calls: 10, cost_usd: 0.3, tokens: 5000 }] },
    latency:    { data: { p50: 300, p95: 800, p99: 1200 } },
  };
  const responses = { ...defaults, ...overrides };

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({
    ok:   true,
    json: async () => {
      if (url.includes('/telemetry/summary'))    return responses.summary;
      if (url.includes('/telemetry/by-agent'))   return responses.byAgent;
      if (url.includes('/telemetry/timeseries')) return responses.timeseries;
      if (url.includes('/telemetry/latency'))    return responses.latency;
      return {};
    },
  }));
}

beforeEach(() => {
  localStorage.setItem('project-os:token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('TelemetryView', () => {
  test('renders cost and call stats after load', async () => {
    mockFetch();
    render(<TelemetryView />);

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    expect(screen.getByText('$1.2300')).toBeInTheDocument();
  });

  test('renders latency percentiles', async () => {
    mockFetch();
    render(<TelemetryView />);

    await waitFor(() => {
      expect(screen.getByText('300ms')).toBeInTheDocument();
    });
  });

  test('shows warning banner when API returns warning', async () => {
    mockFetch({
      summary: {
        warning: 'Telemetry table not found.',
        data:    { total_cost_usd: 0, total_calls: 0, total_tokens: 0, error_count: 0 },
      },
    });
    render(<TelemetryView />);

    await waitFor(() => {
      expect(screen.getByText(/Telemetry table not found/i)).toBeInTheDocument();
    });
  });
});
