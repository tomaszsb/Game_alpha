// tests/components/classroom/ClassroomSetup.test.tsx
// The Classroom Setup screen (Phase 2 catalog UI). Pins: the full deck
// renders from /catalog (not /data), each row says WHO is speaking rather than
// showing a raw space id, protected spaces show a lock instead of a switch,
// switching off runs the hybrid confirm flow (dryRun preview → teacher
// confirms → real save with the chosen detour), and writes carry the admin
// header. Also pins that the deck offers exactly one thing to do with the
// cards themselves — switch between the original and yours — and no editor of
// its own.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ClassroomSetup } from '../../../src/components/classroom/ClassroomSetup';
import { GameContext } from '../../../src/context/GameContext';
import { IServiceContainer } from '../../../src/types/ServiceContracts';

// The screen's editing half (v3.2.41) reads the service container, the same
// way every other editor surface does — so these renders need the provider the
// real app already wraps this screen in (App.tsx mounts ServiceProvider above
// AppContent, and PlayerSetup -> AdminToolsPanel -> here sits inside it).
// Rendering it bare throws "must be used within a ServiceProvider".
const testServices = {
  stateService: { subscribe: () => () => {}, getGameState: () => ({ globalActionLog: [] }), getPlayer: () => undefined },
  dataService: { reloadAllData: async () => {}, getCards: () => [], getCardById: () => undefined },
} as unknown as IServiceContainer;

const renderSetup = (ui: React.ReactElement) =>
  render(<GameContext.Provider value={testServices}>{ui}</GameContext.Provider>);

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
    // A real NPC-voiced space and a real PM-voiced one, so the "who is
    // speaking" line is exercised against the actual character map rather
    // than against invented ids.
    {
      name: 'ARCH-FEE-REVIEW', phase: 'DESIGN', title: "Let's talk about my fee", used: true,
      protection: null, copyId: null, detour: null,
      stock: { First: { Title: "Let's talk about my fee", Event: '', Action: '', Outcome: '', Time: '1', Fee: '0' } },
    },
    {
      name: 'PM-DECISION-CHECK', phase: 'DESIGN', title: 'I pick a direction', used: true,
      protection: null, copyId: null, detour: null,
      stock: { First: { Title: 'I pick a direction', Event: '', Action: '', Outcome: '', Time: '1', Fee: '0' } },
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
      slot: 'BETA-MIDDLE', createdAt: '2026-08-19T10:00:00.000Z', updatedAt: '2026-08-19T10:00:00.000Z', copiedFromStockVersion: 'v1',
      owner: { tier: 'individual', id: null }, role: 'Shorter version for a 45-minute period',
      rows: { First: { Title: 'My Middle', Event: 'Mid.', Action: '', Outcome: '', Time: '2', Fee: '50', space_name: 'BETA-MIDDLE' } },
    },
    beta_middle_copy_2: {
      slot: 'BETA-MIDDLE', createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z', copiedFromStockVersion: 'v2',
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
    renderSetup(<ClassroomSetup onClose={() => {}} />);

    expect(await screen.findByText('The Middle')).toBeInTheDocument();
    expect(screen.getByText('The Gone One')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toContain('/api/instances/classroom-1/catalog');
    // The off space shows its detour, and the staleness hint banner renders.
    expect(screen.getByText(/players go to BETA-MIDDLE/)).toBeInTheDocument();
    expect(screen.getByText(/worth a review/)).toBeInTheDocument();
  });

  it('each row says who is speaking, and never shows the raw space id', async () => {
    // Ten spaces share a short name, so a title on its own cannot tell the
    // Architect's "Fee Review" from the Engineer's. The id underneath used to
    // do the disambiguating and answered the wrong question.
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    renderSetup(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    expect(screen.getByText('Architect')).toBeInTheDocument();
    // PM-voiced spaces have no NPC talking at them — the narration is the
    // player's own thought — so they must NOT be attributed to a character.
    expect(screen.getByText("I pick a direction")).toBeInTheDocument();
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    // No raw ids anywhere in the deck.
    expect(screen.queryByText('ARCH-FEE-REVIEW')).toBeNull();
    expect(screen.queryByText('PM-DECISION-CHECK')).toBeNull();
    expect(screen.queryByText('BETA-MIDDLE')).toBeNull();
  });

  it('offers no editor of its own — one way to change a space, and it is not here', () => {
    // The maintainer's report: "there seem to be two ways of changing the
    // cards ... depending which one you press the data entry fields look
    // different". The small one is gone.
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    renderSetup(<ClassroomSetup onClose={() => {}} />);

    expect(screen.queryByRole('button', { name: /Customize/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add a copy/ })).toBeNull();
  });

  it('shows a lock instead of a switch for protected spaces', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG));
    renderSetup(<ClassroomSetup onClose={() => {}} />);
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

    renderSetup(<ClassroomSetup onClose={() => {}} />);
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

    renderSetup(<ClassroomSetup onClose={() => {}} />);
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

  it('shows the original and yours side by side, saying which one is playing', async () => {
    // This fixture is a classroom saved while a save still made a NEW card
    // every time, so it holds two. Both are shown rather than hidden; nothing
    // makes a third.
    fetchMock.mockResolvedValue(jsonResponse(CATALOG_WITH_CARDS));
    renderSetup(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    // Playing indicator appears exactly once — on copy_1, the one the slot plays.
    expect(screen.getAllByText('Playing now')).toHaveLength(1);
    // One word for both — "tier" is a storage detail nobody should read.
    expect(screen.getAllByText('Your version')).toHaveLength(2);
    expect(screen.getByText('Shorter version for a 45-minute period')).toBeInTheDocument();
    // The original is offered too, even though it isn't playing.
    expect(screen.getByText('The original')).toBeInTheDocument();
    // Each says when it was made, so two unnamed ones are tellable apart.
    expect(screen.getAllByText(/^Made /)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Go back to this one' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Go back to the original' })).toBeInTheDocument();
    // No accumulating list and no fold — there are two things, not a history.
    expect(screen.queryByRole('button', { name: /Show earlier versions/ })).toBeNull();
  });

  // A "folds older versions away behind Show earlier versions" test lived
  // here. It asserted an accumulating list that no longer accumulates: a save
  // edits your card instead of making another, so a space has the original and
  // yours, and two things need no fold.

  it('attaches a card-keyed drift warning to its own card, not the page banner', async () => {
    fetchMock.mockResolvedValue(jsonResponse(CATALOG_WITH_CARDS));
    renderSetup(<ClassroomSetup onClose={() => {}} />);
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

    renderSetup(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    // copy_1 is playing, so copy_2 is the only other version to go back to.
    fireEvent.click(screen.getByRole('button', { name: 'Go back to this one' }));

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

    renderSetup(<ClassroomSetup onClose={() => {}} />);
    await screen.findByText('The Middle');

    fireEvent.click(screen.getByRole('button', { name: 'Go back to the original' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/slots/BETA-MIDDLE/card'));
      expect(call).toBeDefined();
      expect(JSON.parse(call![1]!.body as string)).toEqual({ copyId: null });
    });
  });

  // An "editing a specific card's role note saves it alongside its fields"
  // test lived here. It drove the second, smaller editor that this slice
  // removed; there is one way to change a space now, and the deck is not it.
});
