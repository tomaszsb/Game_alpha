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
//
// Maintainer playtest follow-up (2026-07-14, same fb:f453b1f3 thread) after
// picking this as the winning variant over Option A — three tweaks:
//   1. The preview now renders ABOVE the buttons, not below. The player's own
//      thumb sits on the button while holding it, so a preview below the
//      buttons was hidden by the exact finger that's changing it.
//   2. All 5 categories (Labor/Work/Expediting/Money/Time) always render —
//      via `toFullRowSet` — so only the VALUE column changes between spaces,
//      not which rows exist. Tightened padding/font to compensate for the
//      fixed 5-row height.
//   3. The hold-progress indicator moved from a thin bottom bar (also hidden
//      under the thumb) to an outline that sweeps around the button's full
//      perimeter — parts of it stay visible past the fingertip regardless of
//      exactly where the player is pressing.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { panelPalettes, PanelMode } from './panelTheme';
import { CostPreviewRow, toFullRowSet } from '../../utils/costPreview';

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

  const rows = toFullRowSet(selected === 'end' ? endTurnRows : tryAgainRows);
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
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {withDot && showGreenDot && (
          <span
            aria-hidden="true"
            style={{ width: 9, height: 9, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 0 3px rgba(52,211,153,.3)' }}
          />
        )}
        {label}
      </span>
      {/* Hold-progress indicator: sweeps around the button's OUTLINE (not a
          bottom bar) so it stays visible past the player's own thumb, which
          covers whatever's directly under where they're pressing. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <rect
          x="1.5"
          y="1.5"
          width="97"
          height="97"
          fill="none"
          stroke={selected === side ? '#fff' : p.accent}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={pressing === side ? 0 : 100}
          style={{
            opacity: pressing === side ? 1 : 0,
            transition:
              pressing === side
                ? `stroke-dashoffset ${HOLD_MS}ms linear, opacity 60ms ease-out`
                : 'opacity 140ms ease-out',
          }}
        />
      </svg>
    </button>
  );

  return (
    <div style={{ marginTop: 4 }}>
      {/* Cost preview — ABOVE the buttons (see 2026-07-14 note at top of file):
          the player's thumb covers the buttons while holding, so the info that
          changes needs to live somewhere the thumb isn't. All 5 categories
          always render (toFullRowSet) so only the value column moves. */}
      <div style={{ background: p.surf2, borderRadius: 8, padding: '4px 8px' }}>
        {rows.map((row) => (
          <div
            key={row.key}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 10,
              padding: '1px 0',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: p.muted }}>
              <span aria-hidden="true">{row.icon}</span>
              {row.label}
            </span>
            <span style={{ fontWeight: 600, color: p.text }}>{row.value}</span>
          </div>
        ))}
        {selected === 'end' && endCostLine && (
          <div style={{ fontSize: 9, color: p.muted, textAlign: 'center', marginTop: 2 }}>
            {endCostLine}
          </div>
        )}
      </div>

      {/* Gesture hint so the novel long-press is discoverable. */}
      <div style={{ fontSize: 9.5, color: p.muted, textAlign: 'center', margin: '3px 0' }}>
        Tap to compare · press &amp; hold to confirm
      </div>

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
    </div>
  );
};
