// TurnCommitControl — EXPERIMENTAL merged End Turn / Try Again control.
//
// This is the "Option B" half of an A/B test requested by the maintainer
// (dashboard report fb:feedback-1783922410258-f453b1f3). A player found the two
// separate footer controls confusing — the real Try Again button and the
// tap-to-compare cost-preview slider looked different and lived apart. Their
// proposed fix: merge them into ONE control where a SHORT TAP just switches
// which cost preview you're looking at, and a LONG PRESS actually commits that
// choice, with a growing progress line so you can see the hold "working".
//
// A/B gating (see PlayerPanelV2 footer): this merged control renders ONLY in
// DARK mode. LIGHT mode keeps the original separate button + `TurnCostToggle`
// slider (the safer "Option A" design, visually tidied). Both share the same
// cost-preview data (`getEndTurnCostPreview` / `getTryAgainCostPreview`) so the
// numbers can never diverge — only the interaction differs. Nothing was removed;
// flip the panel to light to get the old behavior back.
//
// Interaction notes:
//   • Long-press-to-commit is deliberately deliberate — these are the most
//     consequential actions in the game (spending money / burning a day), so a
//     fumbled tap must NOT commit. Releasing before the bar fills = a tap =
//     just switch the preview.
//   • Keyboard fallback (long-press is unreachable without a pointer): Space
//     switches the focused side's preview, Enter commits it.
//   • The End side is only holdable when the turn is actually endable; otherwise
//     it shows the "N actions left" hint and ignores holds.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { panelPalettes, PanelMode } from './panelTheme';
import { CostPreviewRow } from '../../utils/costPreview';

/** How long (ms) the player must hold before a side commits. Long enough that a
 *  stray tap can't trigger it, short enough not to feel stuck. */
const HOLD_MS = 650;

export interface TurnCommitControlProps {
  mode: PanelMode;
  /** Caption for the Try Again side (space's own CSV label). */
  tryAgainLabel: string;
  /** Caption for the End Turn side. Pass the live commit label so "Ending…" /
   *  "N actions left" surface here too. */
  endLabel: string;
  /** Whether the End side can actually be committed right now (commit.ready). */
  endActionable: boolean;
  endTurnRows: CostPreviewRow[];
  tryAgainRows: CostPreviewRow[];
  onCommitEnd?: () => void;
  onCommitTryAgain: () => void;
  /** Optional one-line cost summary shown under the End preview (turnCostLine). */
  endCostLine?: string;
  /** First-visit green nudge dot on the End side. */
  showGreenDot?: boolean;
}

type Side = 'end' | 'tryAgain';

export const TurnCommitControl: React.FC<TurnCommitControlProps> = ({
  mode,
  tryAgainLabel,
  endLabel,
  endActionable,
  endTurnRows,
  tryAgainRows,
  onCommitEnd,
  onCommitTryAgain,
  endCostLine,
  showGreenDot,
}) => {
  const p = panelPalettes[mode];
  const [selected, setSelected] = useState<Side>('end');
  const [pressing, setPressing] = useState<Side | null>(null);
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const rows = selected === 'end' ? endTurnRows : tryAgainRows;
  const actionableFor = useCallback(
    (side: Side) => (side === 'end' ? endActionable : true),
    [endActionable],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up any pending hold timer on unmount.
  useEffect(() => () => clearTimer(), [clearTimer]);

  const fire = useCallback(
    (side: Side) => {
      firedRef.current = true;
      if (side === 'end') onCommitEnd?.();
      else onCommitTryAgain();
    },
    [onCommitEnd, onCommitTryAgain],
  );

  const startHold = useCallback(
    (side: Side) => {
      // Selecting on press-down means the preview immediately matches what a
      // completed hold will commit — no surprise.
      setSelected(side);
      if (!actionableFor(side)) return; // not holdable — press acts as a tap only
      firedRef.current = false;
      setPressing(side);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setPressing(null);
        fire(side);
      }, HOLD_MS);
    },
    [actionableFor, clearTimer, fire],
  );

  const endHold = useCallback(
    (side: Side) => {
      // Released before the bar filled → treat as a tap: keep it selected
      // (already set on down), cancel the pending commit.
      if (firedRef.current) return;
      clearTimer();
      setPressing((cur) => (cur === side ? null : cur));
    },
    [clearTimer],
  );

  const onKeyDown = useCallback(
    (side: Side, e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setSelected(side); // Space = compare
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (actionableFor(side)) fire(side); // Enter = commit
      }
    },
    [actionableFor, fire],
  );

  const sideStyle = (side: Side): React.CSSProperties => {
    const active = selected === side;
    const holdable = actionableFor(side);
    return {
      position: 'relative',
      flex: 1,
      border: 'none',
      borderLeft: side === 'end' ? `1px solid ${p.borderStrong}` : 'none',
      padding: '11px 8px 12px',
      fontSize: 13,
      fontWeight: 600,
      lineHeight: 1.2,
      textAlign: 'center',
      cursor: holdable ? 'pointer' : 'default',
      color: active ? '#fff' : holdable ? p.text : p.muted,
      background: active ? p.accent : 'transparent',
      overflow: 'hidden',
      // Stop the browser's own long-press behaviors (scroll pan, text select,
      // context menu / callout) from fighting the hold gesture on touch.
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      WebkitTouchCallout: 'none',
    } as React.CSSProperties;
  };

  const renderSide = (side: Side, label: string, withDot: boolean) => (
    <button
      type="button"
      role="tab"
      aria-selected={selected === side}
      aria-label={
        actionableFor(side)
          ? `${label} — tap to compare, press and hold to confirm`
          : label
      }
      onPointerDown={() => startHold(side)}
      onPointerUp={() => endHold(side)}
      onPointerLeave={() => endHold(side)}
      onPointerCancel={() => endHold(side)}
      onKeyDown={(e) => onKeyDown(side, e)}
      onContextMenu={(e) => e.preventDefault()}
      style={sideStyle(side)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {withDot && showGreenDot && (
          <span
            aria-hidden="true"
            style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 0 3px rgba(52,211,153,.3)' }}
          />
        )}
        {label}
      </span>
      {/* Growing progress line — fills over HOLD_MS while held, snaps back on release. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          width: pressing === side ? '100%' : '0%',
          background: selected === side ? '#fff' : p.accent,
          transition:
            pressing === side ? `width ${HOLD_MS}ms linear` : 'width 140ms ease-out',
        }}
      />
    </button>
  );

  return (
    <div style={{ marginTop: 4 }}>
      <div
        role="tablist"
        aria-label="Choose and confirm your move"
        style={{
          display: 'flex',
          borderRadius: 11,
          overflow: 'hidden',
          border: `1px solid ${p.borderStrong}`,
          background: p.surf,
        }}
      >
        {renderSide('tryAgain', tryAgainLabel, false)}
        {renderSide('end', endLabel, true)}
      </div>

      {/* Gesture hint so the novel long-press is discoverable. */}
      <div style={{ fontSize: 9.5, color: p.muted, textAlign: 'center', marginTop: 3 }}>
        Tap to compare · press &amp; hold to confirm
      </div>

      {/* Cost preview for the selected side (same rows as the light-mode slider). */}
      <div style={{ background: p.surf2, borderRadius: 8, padding: '5px 8px', marginTop: 4 }}>
        {rows.length === 0 ? (
          <div style={{ fontSize: 10, color: p.muted, textAlign: 'center', padding: '1px 0' }}>
            Nothing to report
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 10.5,
                padding: '1.5px 0',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: p.muted }}>
                <span aria-hidden="true">{row.icon}</span>
                {row.label}
              </span>
              <span style={{ fontWeight: 600, color: p.text }}>{row.value}</span>
            </div>
          ))
        )}
        {selected === 'end' && endCostLine && (
          <div style={{ fontSize: 9, color: p.muted, textAlign: 'center', marginTop: 2 }}>
            {endCostLine}
          </div>
        )}
      </div>
    </div>
  );
};
