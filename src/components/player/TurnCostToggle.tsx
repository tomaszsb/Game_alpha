// TurnCostToggle — compact, tap-based cost preview for the End Turn / Try
// Again buttons in PlayerPanelV2's footer (spec: TODO fb:feedback-1783080349985-a3dc215f).
//
// Replaces the old static "costs 🕐 + 💰" hint that used to sit under the Try
// Again button. That hint was the same two words on every space and told the
// player nothing about what THIS space's two choices actually cost.
//
// Hover doesn't work on phones, and this game is played primarily on phones —
// so this is a 2-position segmented control (tap to switch), not a hover
// popover. The two tab labels are the space's own CSV labels
// (`content.end_turn_label` / `content.try_again_label`, generic fallback if
// blank) — never hardcoded "Lock the scope"/"Push back" strings, since labels
// vary per space. The component keys off which SIDE is selected, not label
// text, so it works identically regardless of copy.
//
// Row data is NOT recomputed here — `endTurnRows`/`tryAgainRows` are the
// output of `getEndTurnCostPreview()` / `getTryAgainCostPreview()`
// (src/utils/costPreview.ts), the same cost-classification logic used
// everywhere else. This component only renders it.

import React, { useState } from 'react';
import { panelPalettes, PanelMode } from './panelTheme';
import { CostPreviewRow } from '../../utils/costPreview';

export interface TurnCostToggleProps {
  mode: PanelMode;
  endTurnLabel: string;
  tryAgainLabel: string;
  endTurnRows: CostPreviewRow[];
  tryAgainRows: CostPreviewRow[];
  /** Which side is shown on first render. Defaults to the commit/end-turn
   * side since that's the primary action. */
  defaultSide?: 'end' | 'tryAgain';
}

export const TurnCostToggle: React.FC<TurnCostToggleProps> = ({
  mode,
  endTurnLabel,
  tryAgainLabel,
  endTurnRows,
  tryAgainRows,
  defaultSide = 'end',
}) => {
  const p = panelPalettes[mode];
  const [side, setSide] = useState<'end' | 'tryAgain'>(defaultSide);
  const rows = side === 'end' ? endTurnRows : tryAgainRows;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    padding: '6px 6px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1.25,
    // Tap targets stay full-width flex items (no min-height set) — the 5px
    // vertical padding plus 10px text still clears a comfortable thumb target
    // at this compact footer size; verified live at 375px width.
    background: active ? p.accent : 'transparent',
    color: active ? '#fff' : p.muted,
  });

  return (
    <div style={{ marginTop: 6 }}>
      {/* Caption reframes this strip as a COMPARE tool, not a second row of
          action buttons — the confusion the reporter hit (fb:f453b1f3). */}
      <div style={{ fontSize: 9.5, color: p.muted, marginBottom: 3 }}>
        Compare what each costs
      </div>
      <div
        role="tablist"
        aria-label="Cost preview"
        style={{
          display: 'flex',
          borderRadius: 11,
          overflow: 'hidden',
          border: `1px solid ${p.borderStrong}`,
          background: p.surf,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={side === 'tryAgain'}
          onClick={() => setSide('tryAgain')}
          style={tabStyle(side === 'tryAgain')}
        >
          {tryAgainLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === 'end'}
          onClick={() => setSide('end')}
          style={{ ...tabStyle(side === 'end'), borderLeft: `1px solid ${p.borderStrong}` }}
        >
          {endTurnLabel}
        </button>
      </div>
      <div style={{ background: p.surf2, borderRadius: 8, padding: '5px 8px', marginTop: 3 }}>
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
      </div>
    </div>
  );
};
