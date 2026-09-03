/**
 * TurnCommitControl.test.tsx
 *
 * The dark-mode "Option B" merged control (A/B experiment, fb:f453b1f3):
 * SHORT TAP switches which cost preview is shown; PRESS-AND-HOLD (>= HOLD_MS)
 * commits that side. These tests pin the tap-vs-hold discrimination, the
 * release-before-threshold cancel, the not-actionable guard, and the keyboard
 * fallback (Space = compare, Enter = commit) — the logic a manual click can't
 * prove deterministically.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurnCommitControl } from '../../../src/components/player/TurnCommitControl';
import { CostPreviewRow } from '../../../src/utils/costPreview';

const endRows: CostPreviewRow[] = [
  { key: 'money', icon: '💰', label: 'Money', value: '$500' },
];
const tryAgainRows: CostPreviewRow[] = [
  { key: 'time', icon: '🕐', label: 'Time', value: '+1 day' },
];

const setup = (over: Partial<React.ComponentProps<typeof TurnCommitControl>> = {}) => {
  const onCommitEnd = vi.fn();
  const onCommitTryAgain = vi.fn();
  render(
    <TurnCommitControl
      mode="dark"
      tryAgainLabel="Push back"
      endLabel="Lock the scope"
      endActionable={true}
      endTurnRows={endRows}
      tryAgainRows={tryAgainRows}
      onCommitEnd={onCommitEnd}
      onCommitTryAgain={onCommitTryAgain}
      {...over}
    />,
  );
  // Try Again renders first, End second (see renderSide order in the component).
  const [tryBtn, endBtn] = screen.getAllByRole('tab');
  return { onCommitEnd, onCommitTryAgain, endBtn, tryBtn };
};

describe('TurnCommitControl (dark-mode merged control)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    cleanup();
  });

  it('always shows all 5 categories, with a placeholder for the ones this space has none of', () => {
    // Regression guard (2026-07-14 playtest follow-up): rows must never
    // appear/disappear between spaces — only the value column changes.
    setup();
    for (const label of ['Labor', 'Work', 'Expediting', 'Money', 'Time']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // End side is selected by default: Money has a real value, Time (not in
    // endRows) falls back to the placeholder.
    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('defaults to the End preview and switches values (not rows) on a short tap of Try Again', () => {
    const { tryBtn, onCommitEnd, onCommitTryAgain } = setup();
    // Default: End side's real value is shown; Try Again's is the placeholder.
    expect(screen.getByText('$500')).toBeInTheDocument();
    expect(screen.queryByText('+1 day')).not.toBeInTheDocument();

    // Short tap: down then up well under HOLD_MS.
    act(() => {
      fireEvent.pointerDown(tryBtn);
      vi.advanceTimersByTime(100);
      fireEvent.pointerUp(tryBtn);
    });

    // Preview switched, nothing committed — same 5 labels, different values.
    expect(screen.getByText('+1 day')).toBeInTheDocument();
    expect(screen.queryByText('$500')).not.toBeInTheDocument();
    expect(onCommitEnd).not.toHaveBeenCalled();
    expect(onCommitTryAgain).not.toHaveBeenCalled();
  });

  it('commits the End side after a full press-and-hold', () => {
    const { endBtn, onCommitEnd } = setup();
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(700); // > HOLD_MS (650)
    });
    expect(onCommitEnd).toHaveBeenCalledTimes(1);
  });

  it('does NOT commit when released before the hold threshold', () => {
    const { endBtn, onCommitEnd } = setup();
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(300); // < HOLD_MS
      fireEvent.pointerUp(endBtn);
      vi.advanceTimersByTime(700); // ensure no late fire
    });
    expect(onCommitEnd).not.toHaveBeenCalled();
  });

  it('cancels the commit when the pointer leaves before the threshold', () => {
    const { endBtn, onCommitEnd } = setup();
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(300);
      fireEvent.pointerLeave(endBtn);
      vi.advanceTimersByTime(700);
    });
    expect(onCommitEnd).not.toHaveBeenCalled();
  });

  // The forward move keeps its NAME while it's gated — the reason goes on a
  // second line instead of replacing the caption. Before 2026-09-02 the caption
  // itself became "2 actions left", so "Lock the scope" had no name on screen
  // until the player had already done the right thing, leaving "Push back"
  // (which costs a day and returns you to the same space) as the only named
  // control. A local-model playtest spent 11 of 17 moves in that loop.
  it('keeps the End caption and adds the reason underneath while gated', () => {
    setup({ endActionable: false, endSubLabel: 'Finish 2 things above first' });
    expect(screen.getByText('Lock the scope')).toBeInTheDocument();
    expect(screen.getByText('Finish 2 things above first')).toBeInTheDocument();
    // Screen readers get both halves in one accessible name.
    expect(
      screen.getByRole('tab', { name: 'Lock the scope — Finish 2 things above first' }),
    ).toBeInTheDocument();
  });

  it('drops the reason line once the End side is actionable', () => {
    setup({ endActionable: true, endSubLabel: 'Finish 2 things above first' });
    expect(screen.queryByText('Finish 2 things above first')).not.toBeInTheDocument();
  });

  it('ignores a hold on the End side when it is not actionable', () => {
    const { endBtn, onCommitEnd } = setup({ endActionable: false, endSubLabel: 'Finish 2 things above first' });
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(700);
    });
    expect(onCommitEnd).not.toHaveBeenCalled();
  });

  it('Try Again still commits on a full hold', () => {
    const { tryBtn, onCommitTryAgain } = setup();
    act(() => {
      fireEvent.pointerDown(tryBtn);
      vi.advanceTimersByTime(700);
    });
    expect(onCommitTryAgain).toHaveBeenCalledTimes(1);
  });

  it('keyboard: Space compares, Enter commits', () => {
    const { endBtn, tryBtn, onCommitEnd, onCommitTryAgain } = setup();
    // Space on Try Again switches the preview, no commit.
    act(() => fireEvent.keyDown(tryBtn, { key: ' ' }));
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(onCommitTryAgain).not.toHaveBeenCalled();

    // Enter on End commits.
    act(() => fireEvent.keyDown(endBtn, { key: 'Enter' }));
    expect(onCommitEnd).toHaveBeenCalledTimes(1);
  });

  it('a single continuous hold fires exactly once', () => {
    const { endBtn, onCommitEnd } = setup();
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(700);
      // Still holding well past the threshold — the one-shot timer must not
      // re-fire, and the eventual release must not fire again.
      vi.advanceTimersByTime(700);
      fireEvent.pointerUp(endBtn);
    });
    expect(onCommitEnd).toHaveBeenCalledTimes(1);
  });

  it('stays usable after a commit — Try Again can fire again (no permanent lock)', () => {
    // Regression guard: a permanent post-commit lock would strand a player who
    // re-negotiates (Try Again keeps it their turn) or whose End Turn failed a
    // gate. The control must accept a fresh gesture after committing.
    const { tryBtn, onCommitTryAgain } = setup();
    act(() => {
      fireEvent.pointerDown(tryBtn);
      vi.advanceTimersByTime(700);
      fireEvent.pointerUp(tryBtn);
    });
    act(() => {
      fireEvent.pointerDown(tryBtn);
      vi.advanceTimersByTime(700);
      fireEvent.pointerUp(tryBtn);
    });
    expect(onCommitTryAgain).toHaveBeenCalledTimes(2);
  });

  describe('comic-bubble preview (2026-07-14 second playtest follow-up)', () => {
    it('is hidden until the first tap, then appears', () => {
      const { tryBtn } = setup();
      const bubble = screen.getByTestId('commit-preview-bubble');
      expect(bubble).toHaveAttribute('aria-hidden', 'true');
      expect(bubble).toHaveAttribute('data-visible', 'false');

      act(() => {
        fireEvent.pointerDown(tryBtn);
        vi.advanceTimersByTime(50);
        fireEvent.pointerUp(tryBtn);
      });

      expect(bubble).toHaveAttribute('aria-hidden', 'false');
      expect(bubble).toHaveAttribute('data-visible', 'true');
    });

    it('fades back out on its own after BUBBLE_MS (3000ms)', () => {
      const { tryBtn } = setup();
      const bubble = screen.getByTestId('commit-preview-bubble');

      act(() => {
        fireEvent.pointerDown(tryBtn);
        vi.advanceTimersByTime(50);
        fireEvent.pointerUp(tryBtn);
      });
      expect(bubble).toHaveAttribute('data-visible', 'true');

      act(() => vi.advanceTimersByTime(2900)); // still under 3000ms total
      expect(bubble).toHaveAttribute('data-visible', 'true');

      act(() => vi.advanceTimersByTime(200)); // now past 3000ms
      expect(bubble).toHaveAttribute('data-visible', 'false');
    });

    it('a fresh tap resets the 3-second countdown instead of hiding early', () => {
      const { tryBtn, endBtn } = setup();
      const bubble = screen.getByTestId('commit-preview-bubble');

      act(() => {
        fireEvent.pointerDown(tryBtn);
        vi.advanceTimersByTime(50);
        fireEvent.pointerUp(tryBtn);
      });

      // 2s later — still visible — tap the OTHER side, which should restart
      // the countdown rather than let the original 3s timer fire mid-flight.
      act(() => vi.advanceTimersByTime(2000));
      expect(bubble).toHaveAttribute('data-visible', 'true');
      act(() => {
        fireEvent.pointerDown(endBtn);
        vi.advanceTimersByTime(50);
        fireEvent.pointerUp(endBtn);
      });

      // 2s after the SECOND tap (4s after the first) — would already be
      // hidden under the old timer, must still be visible under the new one.
      act(() => vi.advanceTimersByTime(2000));
      expect(bubble).toHaveAttribute('data-visible', 'true');

      act(() => vi.advanceTimersByTime(1100)); // now past the reset 3s window
      expect(bubble).toHaveAttribute('data-visible', 'false');
    });
  });

  describe('fixed-height cost line (2026-07-14 "buttons jump" report)', () => {
    it('reserves the same space whether or not the End-side cost line has text', () => {
      const { tryBtn } = setup({ endCostLine: 'this turn: 🕐 +1 day' });
      // Default side is End — line visible with real text.
      const line = screen.getByTestId('commit-preview-costline');
      expect(line).toHaveTextContent('this turn: 🕐 +1 day');
      expect(line).toHaveStyle({ visibility: 'visible' });

      // Switch to Try Again — line stays in the DOM (same reserved height),
      // just visually hidden, so the box height never changes between sides.
      act(() => {
        fireEvent.pointerDown(tryBtn);
        vi.advanceTimersByTime(50);
        fireEvent.pointerUp(tryBtn);
      });
      expect(line).toHaveStyle({ visibility: 'hidden' });
    });
  });
});
