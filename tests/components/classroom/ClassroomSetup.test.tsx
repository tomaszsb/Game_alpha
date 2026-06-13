// tests/components/classroom/ClassroomSetup.test.tsx
// The Classroom Setup screen (Phase 2 catalog UI). Pins: the full deck
// renders from /catalog (not /data), protected spaces show a lock instead
// of a switch, switching off runs the hybrid confirm flow (dryRun preview
// → teacher confirms → real save with the chosen detour), and writes
// carry the admin header.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ClassroomSetup } from '../../../src/components/classroom/ClassroomSetup';

vi.mock('../../../src/utils/networkDetection', () => ({
  getBackendURL: () => 'http://test-backend',
}));

vi.mock('../../../src/utils/adminAuth', () => ({
  getAdminPassword: () => 'sesame',
}));

const CATALOG = {
  success: true,
  editableFields: ['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee'],
  configVersion: 1,
  stockVersion: 'v1',
  validation: { ok: true, errors: [], warnings: [{ code: 'COPY_STOCK_UPDATED', message: 'The stock card for "BETA-MIDDLE" has been updated since this copy was made — worth a review' }], detours: {}, suggestions: {} },
  copies: {},
  spaces: [
    {
      name: 'ALPHA-START', phase: 'SETUP', title: 'The Start', used: true,
      protection: { tier: 'structural', reason: 'starting space' }, copyId: null, detour: null,
      stock: { First: { Title: 'The Start', Event: '', Action: '', Outcome: '', Time: '1', Fee: '0' } },
    },
    {
      name: 'BETA-MIDDLE', phase: 'SETUP', title: 'The Middle', used: true,
      protection: null, copyId: null, detour: null,
      stock: { First: { Title: 'The Middle', Event: 'Mid.', Action: '', Outcome: '', Time: '2', Fee: '50' } },
    },
    {
      name: 'GAMMA-OFF', phase: 'DESIGN', title: 'The Gone One', used: false,
      protection: null, copyId: null, detour: 'BETA-MIDDLE',
      stock: { First: { Title: 'The Gone One', Event: '', Action: '', Outcome: '', Time: '1', Fee: '0' } },
    },
  ],
};

const DRY_RUN_REPORT = {
  ok: true,
  errors: [],
  warnings: [],
  detours: { 'BETA-MIDDLE': 'GAMMA-OFF' },
  suggestions: { 'BETA-MIDDLE': { target: 'GAMMA-OFF', candidates: ['GAMMA-OFF'] } },
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body };
}

describe('ClassroomSetup', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('renders the full deck from /catalog, including switched-off spaces', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    render(<ClassroomSetup onClose={() => {}} />);

    expect(await screen.findByText('The Middle')).toBeInTheDocument();
    expect(screen.getByText('The Gone One')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain('/api/instances/classroom-1/catalog');
    // The off space shows its detour, and the staleness hint banner renders.
    expect(screen.getByText(/players go to BETA-MIDDLE/)).toBeInTheDocument();
    expect(screen.getByText(/worth a review/)).toBeInTheDocument();
  });

  it('shows a lock instead of a switch for protected spaces', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Start');

    expect(screen.getByText('🔒 always on')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch off The Start' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Switch off The Middle' })).toBeInTheDocument();
  });

  it('runs the hybrid confirm flow: dryRun preview, then save with the chosen detour', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/catalog')) return jsonResponse(CATALOG);
      if (url.includes('/board')) {
        const body = JSON.parse(init!.body as string);
        if (body.dryRun) return jsonResponse({ success: true, dryRun: true, report: DRY_RUN_REPORT });
        return jsonResponse({ success: true, report: DRY_RUN_REPORT, configVersion: 2, resolvedVersion: 2 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ClassroomSetup onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Switch off The Middle' }));

    // The confirm dialog shows the pre-filled pass-through suggestion.
    expect(await screen.findByText('Switch off “The Middle”?')).toBeInTheDocument();
    expect(screen.getByText(/Path preview:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch off' }));

    await waitFor(() => {
      const saveCall = fetchMock.mock.calls.find(([url, init]) =>
        String(url).includes('/board') && init && !JSON.parse(init.body as string).dryRun
      );
      expect(saveCall).toBeDefined();
      const [, init] = saveCall!;
      expect((init!.headers as Record<string, string>)['x-admin-password']).toBe('sesame');
      expect(JSON.parse(init!.body as string)).toEqual({
        changes: { 'BETA-MIDDLE': { used: false, detour: 'GAMMA-OFF' } },
      });
    });
  });

  it('switching a space back on saves directly without a confirm dialog', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/catalog')) return jsonResponse(CATALOG);
      if (url.includes('/board')) return jsonResponse({ success: true, report: DRY_RUN_REPORT, configVersion: 2, resolvedVersion: 2 });
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ClassroomSetup onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Switch on The Gone One' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/board'));
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({
        changes: { 'GAMMA-OFF': { used: true } },
      });
    });
    expect(screen.queryByText(/Switch off “/)).toBeNull();
  });

  it('opens the copy editor with stock values and saves a create', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/catalog')) return jsonResponse(CATALOG);
      if (url.endsWith('/copies')) {
        return jsonResponse({ success: true, report: DRY_RUN_REPORT, copyId: 'beta_middle_copy_1', configVersion: 2, resolvedVersion: 2 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');
    // The Middle's customize button (protected/off rows have them too; pick by row order).
    const customizeButtons = screen.getAllByRole('button', { name: /Customize/ });
    fireEvent.click(customizeButtons[1]); // ALPHA first, BETA second

    expect(await screen.findByText(/Make your copy of/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create my copy' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/copies'));
      expect(call).toBeDefined();
      const body = JSON.parse(call![1]!.body as string);
      expect(body.slot).toBe('BETA-MIDDLE');
      expect(body.overrides.First.Title).toBe('The Middle');
    });
  });
});
