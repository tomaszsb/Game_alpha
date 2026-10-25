// A step that turns done in front of the player is stamped and named in a one-line label for a few seconds
// (Tom, 2026-10-25: "approvals stamp"). The first look, another player, and a plain step never stamp.
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ProjectMat, STAMP_MS } from '../../../src/components/player/ProjectMat';
import { TrophyPlace, MARKER_MS } from '../../../src/components/player/TrophyPlace';
import { panelPalettes } from '../../../src/components/player/panelTheme';
import type { MatTileState } from '../../../src/utils/projectMat';
import { buildLiveBoard } from '../../../src/utils/liveTrophies';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const p = panelPalettes.light;
const tiles = (dob: boolean, scope = false): MatTileState[] => [
  { id: 'scope', label: 'Scope chosen', done: scope },
  { id: 'dob', label: 'DOB approved', done: dob, stamps: true },
];

describe('ProjectMat stamps', () => {
  it('stamps an approval that turns done while on screen, then lets go after a few seconds', () => {
    vi.useFakeTimers();
    const { rerender } = render(<ProjectMat tiles={tiles(false)} palette={p} playerId="a" />);
    expect(screen.queryByTestId('mat-caption')).toBeNull();
    rerender(<ProjectMat tiles={tiles(true)} palette={p} playerId="a" />);
    expect(screen.getByTestId('mat-tile-dob').getAttribute('data-stamped')).toBe('true');
    expect(screen.getByTestId('mat-caption').textContent).toBe('✓ DOB approved');
    act(() => { vi.advanceTimersByTime(STAMP_MS + 50); });
    expect(screen.queryByTestId('mat-caption')).toBeNull();
    expect(screen.getByTestId('mat-tile-dob').getAttribute('data-stamped')).toBeNull();
  });

  it('does not stamp on first sight, for a plain step, or when the screen switches to another player', () => {
    const first = render(<ProjectMat tiles={tiles(true)} palette={p} playerId="a" />);
    expect(screen.queryByTestId('mat-caption')).toBeNull();
    first.rerender(<ProjectMat tiles={tiles(true, true)} palette={p} playerId="a" />); // scope turns done: no stamp row
    expect(screen.queryByTestId('mat-caption')).toBeNull();
    cleanup();
    const second = render(<ProjectMat tiles={tiles(false)} palette={p} playerId="a" />);
    second.rerender(<ProjectMat tiles={tiles(true)} palette={p} playerId="b" />); // another player's board
    expect(screen.queryByTestId('mat-caption')).toBeNull();
  });
});

describe('TrophyPlace marker', () => {
  const inp = (id: string, days: number) => ({
    playerId: id, name: id, finished: false, out: false, finishOrder: 99,
    daysUsed: days, daysPlanned: 400, moneySpent: 100_000, moneyPlanned: 1_000_000, problemPoints: 0, reviews: 2,
  });
  const rowOf = (a: number, b: number) => buildLiveBoard([inp('a', a), inp('b', b)]).rows.find(r => r.playerId === 'a')!;

  it('shows a plus beside the place when it improves, a minus when it slips, and lets go after a few seconds', () => {
    vi.useFakeTimers();
    const { rerender } = render(<TrophyPlace race="time" row={rowOf(100, 50)} solo={false} palette={p} />);
    expect(screen.queryByTestId('trophy-marker-time')).toBeNull();
    rerender(<TrophyPlace race="time" row={rowOf(30, 50)} solo={false} palette={p} />); // 2nd -> 1st
    expect(screen.getByTestId('trophy-marker-time').textContent).toBe('▲');
    act(() => { vi.advanceTimersByTime(MARKER_MS + 50); });
    expect(screen.queryByTestId('trophy-marker-time')).toBeNull();
    rerender(<TrophyPlace race="time" row={rowOf(100, 50)} solo={false} palette={p} />); // 1st -> 2nd
    expect(screen.getByTestId('trophy-marker-time').textContent).toBe('▼');
  });
});
