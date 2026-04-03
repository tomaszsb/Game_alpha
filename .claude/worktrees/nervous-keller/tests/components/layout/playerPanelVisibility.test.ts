/**
 * playerPanelVisibility.test.ts
 *
 * Tests the logic for hiding player panels when players connect on their own devices.
 * This mirrors the shouldShowPlayerPanel logic in GameLayout.tsx.
 */

import { describe, it, expect } from 'vitest';

// Extract the pure logic from GameLayout's shouldShowPlayerPanel
// This mirrors the actual implementation in GameLayout.tsx lines 291-310
function shouldShowPlayerPanel(
  playerId: string,
  players: Array<{ id: string; deviceType?: 'mobile' | 'desktop' }>,
  visiblePanels: Record<string, boolean>,
  effectiveViewPlayerId: string | null
): boolean {
  // In mobile view mode, don't show any panels in the main area
  if (effectiveViewPlayerId) return false;

  // Check user's display settings first (explicit visibility toggle)
  if (visiblePanels[playerId] === false) return false;
  if (visiblePanels[playerId] === true) return true;

  // Default behavior: hide panels for ANY connected players (mobile or desktop)
  const player = players.find(p => p.id === playerId);
  return !player?.deviceType;
}

describe('Player Panel Visibility Logic', () => {
  const player1 = { id: 'p1', deviceType: undefined as 'mobile' | 'desktop' | undefined };
  const player2 = { id: 'p2', deviceType: undefined as 'mobile' | 'desktop' | undefined };

  it('should show panel for unconnected player', () => {
    const players = [{ id: 'p1', deviceType: undefined }];
    expect(shouldShowPlayerPanel('p1', players, {}, null)).toBe(true);
  });

  it('should hide panel when player connects on mobile', () => {
    const players = [{ id: 'p1', deviceType: 'mobile' as const }];
    expect(shouldShowPlayerPanel('p1', players, {}, null)).toBe(false);
  });

  it('should hide panel when player connects on desktop', () => {
    const players = [{ id: 'p1', deviceType: 'desktop' as const }];
    expect(shouldShowPlayerPanel('p1', players, {}, null)).toBe(false);
  });

  it('should hide all panels in mobile view mode', () => {
    const players = [{ id: 'p1', deviceType: undefined }];
    expect(shouldShowPlayerPanel('p1', players, {}, 'p1')).toBe(false);
  });

  it('should respect explicit user override to show panel', () => {
    const players = [{ id: 'p1', deviceType: 'mobile' as const }];
    expect(shouldShowPlayerPanel('p1', players, { p1: true }, null)).toBe(true);
  });

  it('should respect explicit user override to hide panel', () => {
    const players = [{ id: 'p1', deviceType: undefined }];
    expect(shouldShowPlayerPanel('p1', players, { p1: false }, null)).toBe(false);
  });

  it('should hide connected player panel even if they are current player', () => {
    // This is the key fix — previously current player panels always showed
    const players = [
      { id: 'p1', deviceType: 'mobile' as const },
      { id: 'p2', deviceType: undefined }
    ];
    // p1 is connected on mobile — should be hidden on host screen
    expect(shouldShowPlayerPanel('p1', players, {}, null)).toBe(false);
    // p2 is not connected — should show
    expect(shouldShowPlayerPanel('p2', players, {}, null)).toBe(true);
  });

  it('should hide panel column when all players are connected', () => {
    const players = [
      { id: 'p1', deviceType: 'mobile' as const },
      { id: 'p2', deviceType: 'desktop' as const }
    ];
    const shouldShowAny = players.some(p => shouldShowPlayerPanel(p.id, players, {}, null));
    const hidePanelColumn = !shouldShowAny;
    expect(hidePanelColumn).toBe(true);
  });

  it('should show panel column when at least one player is not connected', () => {
    const players = [
      { id: 'p1', deviceType: 'mobile' as const },
      { id: 'p2', deviceType: undefined }
    ];
    const shouldShowAny = players.some(p => shouldShowPlayerPanel(p.id, players, {}, null));
    const hidePanelColumn = !shouldShowAny;
    expect(hidePanelColumn).toBe(false);
  });
});
