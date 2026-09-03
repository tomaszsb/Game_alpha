// TurnCommitControl — the merged End Turn / Try Again control (PlayerPanelV2's
// footer, both light and dark mode).
//
// Originated as the "Option B" half of an A/B test (dashboard report
// fb:feedback-1783922410258-f453b1f3). A player found the two separate footer
// controls confusing — the real Try Again button and the tap-to-compare
// cost-preview slider looked different and lived apart. Their proposed fix:
// merge them into ONE control where a SHORT TAP just switches which cost
// preview you're looking at, and a LONG PRESS actually commits that choice,
// with a progress indicator so you can see the hold "working". The maintainer
// playtested this against the separate-buttons design (light mode) and dark
// mode (this control) and picked this as the clear winner (2026-07-14), so
// it's now unconditional — see PlayerPanelV2's footer. The retired
// separate-buttons design (`TurnCostToggle`) was deleted the same day.
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
//
// Second playtest follow-up (2026-07-14, same day/thread) — three more:
//   1. "The buttons seem to jump" — traced to the optional `endCostLine` row,
//      which only rendered on the End side, so the box was one line taller
//      there than on Try Again. Now always reserved (fixed min-height,
//      content only on the End side) so the box is the same height both ways.
//   2. "Show which button the data came from" — the preview is now a comic-
//      bubble OVERLAY (absolutely positioned above the tablist, doesn't push
//      the buttons) with a triangular tail that slides to sit under whichever
//      side is selected — a swipe-like motion plus a clear "this bubble is
//      about THAT button" anchor.
//   3. "Bubble shouldn't always be there" — it's now hidden by default and
//      pops up for BUBBLE_MS on any tap/hold-start/keyboard-compare, then
//      fades back out. A fresh interaction resets the countdown.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { panelPalettes, PanelMode } from './panelTheme';
import { CostPreviewRow, toFullRowSet } from '../../utils/costPreview';

/** How long (ms) the player must hold before a side commits. Long enough that a
 *  stray tap can't trigger it, short enough not to feel stuck. */
const HOLD_MS = 650;

/** How long (ms) the comic-bubble preview stays up after a tap before it
 *  fades back out on its own. */
const BUBBLE_MS = 3000;

export interface TurnCommitControlProps {
  mode: PanelMode;
  /** Caption for the Try Again side (space's own CSV label). */
  tryAgainLabel: string;
  /** Caption for the End Turn side. Pass the live commit label so "Ending…" /
   *  "N actions left" surface here too. */
  endLabel: string;
  /** Whether the End side can actually be committed right now (commit.ready). */
  endActionable: boolean;
  /** Small second line under the End caption explaining why it isn't holdable
   *  yet ("Finish 2 things above first"). Only rendered when the End side is
   *  not actionable — see the jarvis-playtest note in the header comment. */
  endSubLabel?: string;
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
  endSubLabel,
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
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
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

  // Reveal the comic-bubble preview and (re)start its BUBBLE_MS auto-hide —
  // any fresh tap/hold-start/keyboard-compare resets the countdown, so the
  // bubble stays up as long as the player keeps interacting.
  const revealBubble = useCallback(() => {
    setBubbleVisible(true);
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubbleVisible(false);
      bubbleTimerRef.current = null;
    }, BUBBLE_MS);
  }, []);

  // Clean up any pending timers on unmount.
  useEffect(
    () => () => {
      clearTimer();
      if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    },
    [clearTimer],
  );

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
      revealBubble();
      if (!actionableFor(side)) return; // not holdable — press acts as a tap only
      firedRef.current = false;
      setPressing(side);
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        setPressing(null);
        fire(side);
      }, HOLD_MS);
    },
    [actionableFor, clearTimer, fire, revealBubble],
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
        revealBubble();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (actionableFor(side)) fire(side); // Enter = commit
      }
    },
    [actionableFor, fire, revealBubble],
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

  const renderSide = (side: Side, label: string, withDot: boolean, subLabel?: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={selected === side}
      aria-label={
        actionableFor(side)
          ? `${label} — tap to compare, press and hold to confirm`
          : subLabel
          ? `${label} — ${subLabel}`
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
      {/* Why this side isn't holdable yet. Before this line the caption itself
          was replaced by the reason ("2 actions left"), so the destination —
          "Lock the scope" — had no name on screen until the player had already
          done the right thing, and the only named control was the one that
          loops you back a day. A local-model playtest (2026-09-02) spent 11 of
          its 17 moves in exactly that loop. Keep the name; add the reason. */}
      {subLabel && (
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontSize: 10,
            fontWeight: 500,
            opacity: 0.75,
            lineHeight: 1.2,
          }}
        >
          {subLabel}
        </span>
      )}
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

  // Tail (and bubble) horizontal anchor: centered over whichever tab is
  // selected — the two tabs are equal-width flex children, so their centers
  // sit at 25% (tryAgain, left) and 75% (end, right) of the control's width.
  // Transitioning `left` makes the tail visibly slide over when the
  // selection switches, doubling as the "swipe from that direction" cue.
  const tailLeftPct = selected === 'end' ? 75 : 25;

  return (
    <div style={{ marginTop: 4, position: 'relative' }}>
      {/* Comic-bubble cost preview — an OVERLAY (doesn't push the buttons;
          fixes the "buttons jump" report) that only appears for BUBBLE_MS
          after a tap/hold-start, then fades out on its own. A triangular
          tail slides to sit under whichever button is currently selected, so
          it's visually clear which button the numbers "came from". */}
      <div
        aria-hidden={!bubbleVisible}
        data-testid="commit-preview-bubble"
        data-visible={bubbleVisible}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '100%',
          marginBottom: 9,
          opacity: bubbleVisible ? 1 : 0,
          transform: bubbleVisible ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.98)',
          transition: 'opacity 180ms ease, transform 180ms ease',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <div
          style={{
            background: p.surf2,
            border: `1px solid ${p.borderStrong}`,
            borderRadius: 10,
            padding: '5px 9px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
          }}
        >
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
          {/* Fixed-height reserved line regardless of side — previously only
              rendered on the End side, which made the bubble one line taller
              there than on Try Again ("the buttons seem to jump... extra
              line in one of the boxes"). Always present now; empty/invisible
              on the Try Again side so height never differs between sides. */}
          <div
            style={{
              fontSize: 9,
              color: p.muted,
              textAlign: 'center',
              marginTop: 2,
              minHeight: 11,
              visibility: selected === 'end' && endCostLine ? 'visible' : 'hidden',
            }}
            data-testid="commit-preview-costline"
          >
            {selected === 'end' && endCostLine ? endCostLine : ' '}
          </div>
        </div>
        {/* Tail: two stacked CSS triangles (a 1px-larger one in the border
            color underneath) fake a bordered speech-bubble pointer. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -9,
            left: `${tailLeftPct}%`,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '9px solid transparent',
            borderRight: '9px solid transparent',
            borderTop: `9px solid ${p.borderStrong}`,
            transition: 'left 180ms ease',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: -8,
            left: `${tailLeftPct}%`,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: `8px solid ${p.surf2}`,
            transition: 'left 180ms ease',
          }}
        />
      </div>

      {/* Gesture hint so the novel long-press is discoverable. */}
      <div style={{ fontSize: 9.5, color: p.muted, textAlign: 'center', margin: '0 0 3px' }}>
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
        {renderSide('end', endLabel, true, endActionable ? undefined : endSubLabel)}
      </div>
    </div>
  );
};
