/**
 * PhoneFeedbackFixes.test.tsx
 *
 * Two reports from real phones, both still open on v3.2.82:
 *
 * - fb:b8902332 (2026-09-27): "There used to be tags for approval on Department of
 *   Buildings and approval of fire department. They were supposed to show the ✗ for not
 *   and a ✓ for yes. I just do not see them." The tags exist, but the redesigned panel
 *   hid the not-yet-approved state entirely, so a player at the approvals stage saw
 *   nothing until they had something to show.
 * - fb:3fb28b09 / fb:ca601c26 (2026-09-20): the Glossary / Dark-Light buttons at the top
 *   of the phone view were "not legible", "there is no button in dark mode". They sat
 *   outside the panel's themed box with `color: inherit`, so dark mode gave dark text on a
 *   dark page.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlayerPanelV2 } from '../../../src/components/player/PlayerPanelV2';
import { PlayerPanelWrapper } from '../../../src/components/player/PlayerPanelWrapper';
import { setPanelMode } from '../../../src/components/player/panelTheme';
import { createAllMockServices } from '../../mocks/mockServices';
import { DictionaryProvider } from '../../../src/dictionary';

let services: ReturnType<typeof createAllMockServices>;

const basePlayer: any = {
  id: 'player1',
  name: 'Test Player',
  currentSpace: 'REG-DOB-PLAN-EXAM',
  visitType: 'First',
  money: 100000,
  timeSpent: 5,
  color: '#007bff',
  hand: [],
  activeCards: [],
  activeEffects: [],
  loans: [],
  dobApprovalStatus: 'none',
  fdnyApprovalStatus: 'none',
  moneySources: {},
  moveIntent: null,
};

const gameState = (player: any): any => ({
  players: [player],
  currentPlayerId: 'player1',
  gamePhase: 'PLAY',
  hasPlayerRolledDice: false,
  movementChoiceUnlocked: true,
  awaitingChoice: null,
  requiredActions: 0,
  completedActionCount: 0,
  completedActions: { diceRoll: undefined, manualActions: {} },
});

function setup(player: any, phase: string) {
  vi.clearAllMocks();
  services = createAllMockServices();
  services.stateService.getPlayer.mockReturnValue(player);
  services.stateService.getGameState.mockReturnValue(gameState(player));
  services.stateService.subscribe.mockReturnValue(() => {});
  services.dataService.getSpaceContent.mockReturnValue({ title: 'City Checks Plans', story: '' });
  services.dataService.getGameConfigBySpace.mockReturnValue({ phase });
  services.dataService.getSpaceEffects.mockReturnValue([]);
  services.dataService.getMovement.mockReturnValue(undefined);
  services.turnService.filterSpaceEffectsByCondition.mockReturnValue([]);
  services.gameRulesService.canEndTurn.mockReturnValue(false);
  services.cardService.canPlayCard.mockReturnValue(false);
}

const renderPanel = () =>
  render(
    <DictionaryProvider>
      <PlayerPanelV2 gameServices={services as any} playerId="player1" mode="light" />
    </DictionaryProvider>,
  );

afterEach(() => {
  cleanup();
  setPanelMode('light');
});

describe('DOB / FDNY approval tags (fb:b8902332)', () => {
  it('at the Regulatory stage, before any approval, both tags show a ✗ — "not yet" is the news', () => {
    setup(basePlayer, 'REGULATORY');
    renderPanel();
    expect(screen.getByTestId('approval-tag-dob')).toHaveTextContent('DOB ✗');
    expect(screen.getByTestId('approval-tag-fdny')).toHaveTextContent('FDNY ✗');
  });

  it('shows ✓ for an approval and ✗ for the one still waiting', () => {
    setup({ ...basePlayer, dobApprovalStatus: 'approved' }, 'REGULATORY');
    renderPanel();
    expect(screen.getByTestId('approval-tag-dob')).toHaveTextContent('DOB ✓');
    expect(screen.getByTestId('approval-tag-fdny')).toHaveTextContent('FDNY ✗');
  });

  it('keeps showing after Regulatory (Construction), so an approval that was reset is visible', () => {
    setup(basePlayer, 'CONSTRUCTION');
    renderPanel();
    expect(screen.getByTestId('approval-tag-dob')).toHaveTextContent('DOB ✗');
  });

  it('stays hidden in the early phases — an approval means nothing at Owner / Funding / Design yet', () => {
    for (const phase of ['OWNER', 'FUNDING', 'DESIGN']) {
      setup(basePlayer, phase);
      renderPanel();
      expect(screen.queryByTestId('approval-tag-dob')).not.toBeInTheDocument();
      expect(screen.queryByTestId('approval-tag-fdny')).not.toBeInTheDocument();
      cleanup();
    }
  });

  it('an approval earned early still shows (status wins over phase)', () => {
    setup({ ...basePlayer, fdnyApprovalStatus: 'approved' }, 'DESIGN');
    renderPanel();
    expect(screen.getByTestId('approval-tag-fdny')).toHaveTextContent('FDNY ✓');
    expect(screen.queryByTestId('approval-tag-dob')).not.toBeInTheDocument();
  });
});

describe('phone header buttons are legible in both modes (fb:3fb28b09, fb:ca601c26)', () => {
  const renderWrapper = () =>
    render(
      <DictionaryProvider>
        <PlayerPanelWrapper gameServices={services as any} playerId="player1" onOpenGlossary={() => {}} />
      </DictionaryProvider>,
    );

  beforeEach(() => setup(basePlayer, 'DESIGN'));

  it('dark mode: light text, not text inherited from the dark page', () => {
    setPanelMode('dark');
    renderWrapper();
    const glossary = screen.getByRole('button', { name: /glossary/i });
    expect(glossary.style.color).toBe('rgb(226, 232, 240)');
    expect(glossary.style.color).not.toBe('inherit');
  });

  it('light mode: dark text', () => {
    setPanelMode('light');
    renderWrapper();
    expect(screen.getByRole('button', { name: /glossary/i }).style.color).toBe('rgb(51, 65, 85)');
  });

  it('big enough to read and tap (13px, not 11px)', () => {
    renderWrapper();
    expect(screen.getByRole('button', { name: /glossary/i }).style.fontSize).toBe('13px');
  });
});
