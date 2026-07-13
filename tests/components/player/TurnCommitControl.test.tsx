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

  it('defaults to the End preview and switches on a short tap of Try Again', () => {
    const { tryBtn, onCommitEnd, onCommitTryAgain } = setup();
    // Default: End rows shown.
    expect(screen.getByText('Money')).toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();

    // Short tap: down then up well under HOLD_MS.
    act(() => {
      fireEvent.pointerDown(tryBtn);
      vi.advanceTimersByTime(100);
      fireEvent.pointerUp(tryBtn);
    });

    // Preview switched, nothing committed.
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.queryByText('Money')).not.toBeInTheDocument();
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

  it('ignores a hold on the End side when it is not actionable', () => {
    const { endBtn, onCommitEnd } = setup({ endActionable: false, endLabel: '2 actions left' });
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

  it('does not double-commit once committed', () => {
    const { endBtn, onCommitEnd } = setup();
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(700);
    });
    // A second attempt after commit is ignored (buttons disabled).
    act(() => {
      fireEvent.pointerDown(endBtn);
      vi.advanceTimersByTime(700);
    });
    expect(onCommitEnd).toHaveBeenCalledTimes(1);
  });
});
