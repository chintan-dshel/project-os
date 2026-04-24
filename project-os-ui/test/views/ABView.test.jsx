import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ABView from '../../src/views/ABView.jsx';

const VARIANTS = [
  { id: 'v1', experiment_key: 'test-exp', variant_name: 'control', agent: 'intake',
    model: 'claude-sonnet-4-20250514', traffic_weight: 50, active: true },
  { id: 'v2', experiment_key: 'test-exp', variant_name: 'treatment', agent: 'intake',
    model: 'claude-haiku-4-5-20251001', traffic_weight: 50, active: false },
];

function mockFetch(variants = VARIANTS) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, opts) => {
    if (url.includes('/ab/variants') && (!opts?.method || opts.method === 'GET')) {
      return { ok: true, json: async () => variants };
    }
    if (url.includes('/ab/variants') && opts?.method === 'PATCH') {
      const body = JSON.parse(opts.body);
      const id   = url.split('/').pop();
      const v    = variants.find(x => x.id === id) ?? {};
      return { ok: true, json: async () => ({ ...v, ...body }) };
    }
    return { ok: true, json: async () => ({}) };
  });
}

beforeEach(() => {
  localStorage.setItem('project-os:token', 'test-token');
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('ABView', () => {
  test('renders variant table rows after load', async () => {
    mockFetch();
    render(<ABView />);

    await waitFor(() => {
      expect(screen.getAllByText('test-exp').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('control')).toBeInTheDocument();
    expect(screen.getByText('treatment')).toBeInTheDocument();
  });

  test('shows Active / Off toggle buttons', async () => {
    mockFetch();
    render(<ABView />);

    await waitFor(() => {
      const activeBtn = screen.getByText('Active');
      expect(activeBtn).toBeInTheDocument();
    });

    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  test('calls PATCH when toggle is clicked', async () => {
    const spy = mockFetch();
    render(<ABView />);

    await waitFor(() => screen.getByText('Active'));

    const activeBtn = screen.getByText('Active');
    fireEvent.click(activeBtn);

    await waitFor(() => {
      const patchCall = spy.mock.calls.find(([url, opts]) =>
        url.includes('/ab/variants') && opts?.method === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      expect(JSON.parse(patchCall[1].body)).toHaveProperty('active');
    });
  });
});
