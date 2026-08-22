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

// A space with two copies in its rolodex (Card Library stage 2), one of
// them currently playing, plus one card-keyed and one non-card-keyed
// validation warning — exercises the rolodex UI and the warning split.
const CATALOG_WITH_CARDS = {
  success: true,
  editableFields: ['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee'],
  configVersion: 1,
  stockVersion: 'v2',
  validation: {
    ok: true,
    errors: [],
    warnings: [
      {
        code: 'COPY_STOCK_UPDATED', copyId: 'beta_middle_copy_1', space: 'BETA-MIDDLE',
        message: 'The stock card for "BETA-MIDDLE" has been updated since this copy was made — worth a review',
      },
      {
        code: 'SLOT_UNKNOWN_SPACE', space: 'GHOST-SPACE',
        message: 'Slot "GHOST-SPACE" does not exist in current stock (ignored by the bake)',
      },
    ],
    detours: {},
    suggestions: {},
  },
  copies: {
    beta_middle_copy_1: {
      slot: 'BETA-MIDDLE', createdAt: 't1', updatedAt: 't1', copiedFromStockVersion: 'v1',
      owner: { tier: 'individual', id: null }, role: 'Shorter version for a 45-minute period',
      rows: { First: { Title: 'My Middle', Event: 'Mid.', Action: '', Outcome: '', Time: '2', Fee: '50', space_name: 'BETA-MIDDLE' } },
    },
    beta_middle_copy_2: {
      slot: 'BETA-MIDDLE', createdAt: 't2', updatedAt: 't2', copiedFromStockVersion: 'v2',
      owner: { tier: 'individual', id: null }, role: '',
      rows: { First: { Title: 'Other version', Event: 'Mid.', Action: '', Outcome: '', Time: '2', Fee: '50', space_name: 'BETA-MIDDLE' } },
    },
  },
  spaces: [
    {
      name: 'BETA-MIDDLE', phase: 'SETUP', title: 'The Middle', used: true,
      protection: null, copyId: 'beta_middle_copy_1', detour: null,
      stock: { First: { Title: 'The Middle', Event: 'Mid.', Action: '', Outcome: '', Time: '2', Fee: '50' } },
    },
  ],
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

  it('shows the rolodex for a space with several copies: which one is playing, each one\'s tier and note', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG_WITH_CARDS));
    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    // Playing indicator appears exactly once — on copy_1, the one the slot plays.
    expect(screen.getAllByText('Playing now')).toHaveLength(1);
    // Both copies are "Your copy" tier (individual); copy_1 also carries its role note.
    expect(screen.getAllByText('Your copy')).toHaveLength(2);
    expect(screen.getByText('Shorter version for a 45-minute period')).toBeInTheDocument();
    // The original is offered too, even though it isn't playing.
    expect(screen.getByText('The original')).toBeInTheDocument();
    // Two things can be switched TO (original + copy_2); copy_1 is already playing.
    expect(screen.getAllByRole('button', { name: 'Use this one' })).toHaveLength(2);
  });

  it('attaches a card-keyed drift warning to its own card, not the page banner', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG_WITH_CARDS));
    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    // The card-keyed warning renders as a badge on copy_1's chip...
    expect(screen.getByText('⚠️ The original changed since you made this — worth a look')).toBeInTheDocument();
    // ...NOT as a generic page-level banner line for that message.
    expect(screen.queryByText(/💡.*BETA-MIDDLE.*has been updated/)).toBeNull();
    // A warning with no copyId still lands in the page banner.
    expect(screen.getByText('💡 Slot "GHOST-SPACE" does not exist in current stock (ignored by the bake)')).toBeInTheDocument();
  });

  it('switching to a different card in the rolodex posts the new selection', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/catalog')) return jsonResponse(CATALOG_WITH_CARDS);
      if (url.includes('/slots/BETA-MIDDLE/card')) return jsonResponse({ success: true, report: DRY_RUN_REPORT, configVersion: 2, resolvedVersion: 2 });
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    // copy_1 is playing (no "Use this one" of its own); the original and
    // copy_2 both offer one. Order in the DOM is: original, copy_1, copy_2.
    const useButtons = screen.getAllByRole('button', { name: 'Use this one' });
    expect(useButtons).toHaveLength(2);
    fireEvent.click(useButtons[1]); // copy_2

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/slots/BETA-MIDDLE/card'));
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({ copyId: 'beta_middle_copy_2' });
    });
  });

  it('switching back to the original from the rolodex posts a null selection', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/catalog')) return jsonResponse(CATALOG_WITH_CARDS);
      if (url.includes('/slots/BETA-MIDDLE/card')) return jsonResponse({ success: true, report: DRY_RUN_REPORT, configVersion: 2, resolvedVersion: 2 });
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    const useButtons = screen.getAllByRole('button', { name: 'Use this one' });
    fireEvent.click(useButtons[0]); // the original

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/slots/BETA-MIDDLE/card'));
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({ copyId: null });
    });
  });

  it('editing a specific card\'s role note saves it alongside its fields', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/catalog')) return jsonResponse(CATALOG_WITH_CARDS);
      if (url.includes('/copies/beta_middle_copy_2')) return jsonResponse({ success: true, report: DRY_RUN_REPORT, copyId: 'beta_middle_copy_2', configVersion: 2, resolvedVersion: 2 });
      throw new Error(`unexpected fetch: ${url}`);
    });

    render(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    // copy_2 has no role note yet, so its edit button's name falls back to its tier word.
    fireEvent.click(screen.getByRole('button', { name: 'Edit Your copy' }));
    expect(await screen.findByText(/Edit your copy of/)).toBeInTheDocument();

    const noteInput = screen.getByPlaceholderText(/Shorter version for a 45-minute period/);
    fireEvent.change(noteInput, { target: { value: 'For the advanced class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/copies/beta_middle_copy_2'));
      expect(call).toBeDefined();
      const body = JSON.parse(call![1]!.body as string);
      expect(body.role).toBe('For the advanced class');
      expect(body.overrides.First.Title).toBe('Other version');
    });
  });
});
