// PlayerPreviewPanel — the Space Data Editor's live "what will my players see"
// preview.
//
// This mirrors PlayerPanelV2 (src/components/player/PlayerPanelV2.tsx), the
// panel every real player sees in-game — same theme source (panelPalettes/
// usePanelMode), same typography scale, spacing rhythm, section layout
// (header → status → "Where you are & why" → "Things you can do" → commit
// footer), and the same light/dark handling. It is NOT a mount of the real
// component: PlayerPanelV2 takes a live IServiceContainer + playerId and
// reads/subscribes to running game state, which this editor screen doesn't
// have. This is a SEPARATE, approximate renderer fed only by the editor's own
// SpaceRow + DiceRollRow[] (the CSV row currently being edited) — good enough
// to judge "roughly what a player will see", not a pixel-accurate second
// implementation.
//
// DRIFT RISK: because this is a second, independent renderer, it WILL go
// stale the moment PlayerPanelV2's visual language changes (new section, new
// palette token, new copy pattern) — nothing enforces the two staying in
// sync. Re-check this file by eye whenever PlayerPanelV2 changes anything a
// player would notice. (Previously — until 2026-08-22 — this component
// deliberately rendered with the long-deleted classic ActionCenterPanel's
// `action-center__*` stylesheet, which is exactly this drift risk having
// gone unnoticed for over a year; see CARD_LIBRARY_DESIGN.md stage 3.)

import React, { useState } from 'react';
import { SpaceRow, DiceRollRow } from './types/EditorTypes';
import { usePanelMode, panelPalettes } from '../player/panelTheme';
import { colors } from '../../styles/theme';
import { shortName } from '../../utils/boardCommon';
import { DICE_BUTTON } from '../../constants/uiStrings';
import { IconMoon, IconSun } from '../icons/SetupIcons';

interface PlayerPreviewPanelProps {
  currentSpace: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  diceRollData: DiceRollRow[];
}

// Mirrors formatManualEffectButton's card branch defaults (buttonFormatting.ts)
// for the common "draw" case — the editor's per-space columns don't carry
// enough structure to know replace/give/return, so this approximates the
// most common wording a player would actually see.
function defaultCardActionLabel(type: string, count: number): string {
  switch (type) {
    case 'E': return count > 1 ? `Hire ${count} Expeditors` : 'Hire Expeditor';
    case 'B': return count > 1 ? `Get ${count} Bank Loans` : 'Get Bank Loan';
    case 'I': return count > 1 ? `Get ${count} Investments` : 'Get Investment';
    case 'W': return count > 1 ? `Add ${count} Work Packages` : 'Add Work Package';
    case 'L': return count > 1 ? `${count} Life Events` : 'Life Event';
    default: return `${count} ${type}`;
  }
}

// Mirrors formatManualEffectButton's dice branch (buttonFormatting.ts) — maps
// the DiceRoll Info.csv category string to the same friendly DICE_BUTTON
// label a player would see, when the space hasn't authored its own
// button_label.
function defaultDiceActionLabel(dieRoll: string): string {
  const cat = dieRoll.trim().toLowerCase();
  if (cat === 'w cards') return DICE_BUTTON.WORK;
  if (cat === 'b cards' || cat === 'b card') return DICE_BUTTON.BANK;
  if (cat === 'i cards' || cat === 'i card') return DICE_BUTTON.INVESTMENT;
  if (cat === 'e cards' || cat === 'e card') return DICE_BUTTON.EXPEDITOR;
  if (cat === 'l cards' || cat === 'l card') return DICE_BUTTON.LIFE_EVENT;
  if (cat === 'fees paid' || cat === 'fee paid') return DICE_BUTTON.FEE;
  if (cat === 'time outcomes' || cat === 'time') return DICE_BUTTON.TIME;
  if (cat === 'quality') return DICE_BUTTON.QUALITY;
  if (cat === 'multiplier') return DICE_BUTTON.OUTCOME;
  if (cat === 'next step') return DICE_BUTTON.NEXT_STEP;
  return DICE_BUTTON.OUTCOME;
}

export function PlayerPreviewPanel({ currentSpace, visitType, diceRollData }: PlayerPreviewPanelProps): JSX.Element {
  const [mode, toggleMode] = usePanelMode();
  const p = panelPalettes[mode];
  // Collapsed by default, same as PlayerPanelV2's "What to do & why" and
  // "Move" toggles — approximating the first-look state a player actually sees.
  const [showWhy, setShowWhy] = useState(false);
  const [showMoveOptions, setShowMoveOptions] = useState(false);

  const toggleBtn: React.CSSProperties = {
    border: `1px solid ${p.borderStrong}`,
    background: 'transparent',
    color: p.text,
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.3em',
  };

  if (!currentSpace) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: p.bg,
        color: p.muted,
        gap: 12,
      }}>
        <div style={{ fontSize: 48 }} aria-hidden>👁️</div>
        <div style={{ fontSize: 14 }}>Select a space to preview</div>
      </div>
    );
  }

  // --- derive the same shapes PlayerPanelV2 works with, from the editor's
  //     coarse per-space CSV row instead of live service data -------------
  const cardFields: { key: keyof SpaceRow; labelKey: keyof SpaceRow; type: string }[] = [
    { key: 'w_card', labelKey: 'w_card_label', type: 'W' },
    { key: 'b_card', labelKey: 'b_card_label', type: 'B' },
    { key: 'i_card', labelKey: 'i_card_label', type: 'I' },
    { key: 'l_card', labelKey: 'l_card_label', type: 'L' },
    { key: 'e_card', labelKey: 'e_card_label', type: 'E' },
  ];
  const cardActions = cardFields
    .map((cf) => {
      const raw = currentSpace[cf.key] as string;
      if (!raw) return null;
      const parsed = parseInt(raw, 10);
      const count = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      const customLabel = currentSpace[cf.labelKey] as string;
      const meta = colors.game.cardTypes[cf.type];
      return {
        key: `card-${cf.type}`,
        icon: meta ? meta.emoji : '📄',
        label: customLabel || defaultCardActionLabel(cf.type, count),
      };
    })
    .filter((x): x is { key: string; icon: string; label: string } => x !== null);

  const spaceDiceRolls = diceRollData.filter(
    (dr) => dr.space_name === currentSpace.space_name && dr.visit_type === visitType,
  );
  const diceTypes = [...new Set(spaceDiceRolls.map((dr) => dr.die_roll))];
  const diceActions = diceTypes.map((dieRoll) => {
    const dr = spaceDiceRolls.find((r) => r.die_roll === dieRoll);
    return {
      key: `dice-${dieRoll}`,
      icon: '🎯', // voice rule: an outcome action, not a 🎲 die
      label: dr?.button_label || defaultDiceActionLabel(dieRoll),
    };
  });

  const destinations: { id: string; label: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = currentSpace[`space_${i}` as keyof SpaceRow] as string;
    if (v) destinations.push({ id: v, label: shortName(v) });
  }

  const endTurnLabel = currentSpace.end_turn_label || 'End turn';
  const tryAgainLabel = currentSpace.try_again_label || 'Negotiate again';
  const showTryAgain = currentSpace.Negotiate === 'YES';
  const isDiceMovementSpace = currentSpace.requires_dice_roll?.toLowerCase() === 'yes';
  const hasThingsToDo = cardActions.length > 0 || diceActions.length > 0 || destinations.length > 0;
  const spaceLabel = currentSpace._extraColumns?.display_label_override || currentSpace.Title || shortName(currentSpace.space_name);

  // --- shared style tokens, matching PlayerPanelV2's own constants --------
  const pad: React.CSSProperties = { padding: '11px 13px', borderBottom: `0.5px solid ${p.border}` };
  const zlbl: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.05em',
    color: p.muted,
    textTransform: 'uppercase',
    margin: '0 0 6px',
  };
  const stat: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500 };
  const actionBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    boxSizing: 'border-box',
    background: p.surf,
    border: `1px solid ${p.borderStrong}`,
    color: p.text,
    borderRadius: 9,
    padding: '10px 11px',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 7,
    textAlign: 'left',
    cursor: 'default',
  };
  const subActionBtn: React.CSSProperties = { ...actionBtn, padding: '7px 10px', fontSize: 12, marginBottom: 5 };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: p.bg, color: p.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header — no real player in the editor, so this names the surface
          rather than a player, but keeps the same dot + right-aligned phase
          badge layout as PlayerPanelV2's header. */}
      <div style={{ ...pad, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500 }}>
          <span style={{ width: 11, height: 11, borderRadius: '50%', background: p.accent }} aria-hidden />
          Player view
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentSpace.phase && <div style={{ fontSize: 11, color: p.muted }}>{currentSpace.phase}</div>}
          <button style={toggleBtn} onClick={toggleMode} title="Preview in light / dark mode" type="button">
            {mode === 'light' ? <IconMoon size="1em" /> : <IconSun size="1em" />}
            {mode === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </div>

      {/* Status — real players see money/days/approvals here; the editor has
          no player state, so this shows the space's own declared costs
          instead (Time/Fee), plus the visit-type this preview is showing. */}
      <div style={pad}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: p.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {visitType === 'First' ? 'First visit' : 'Return visit'}
          </span>
          {currentSpace.Time && (
            <span style={stat} title="Time cost">
              <span aria-hidden>🕐</span>{currentSpace.Time}
            </span>
          )}
          {currentSpace.Fee && (
            <span style={stat} title="Fee">
              <span aria-hidden>💰</span>{currentSpace.Fee}
            </span>
          )}
          {isDiceMovementSpace && (
            <span style={{ ...stat, fontSize: 11, color: p.muted }} title="This space resolves by outcome">
              <span aria-hidden>🎯</span>
              {currentSpace.rolls ? `${currentSpace.rolls} outcome${currentSpace.rolls !== '1' ? 's' : ''}` : 'Outcome'}
            </span>
          )}
          {showTryAgain && (
            <span style={{ ...stat, fontSize: 11, color: p.muted }} title="Negotiation is offered here">
              <span aria-hidden>🤝</span> Negotiable
            </span>
          )}
          {currentSpace.path && currentSpace.path !== 'Main' && (
            <span style={{ fontSize: 10, color: p.accent, fontWeight: 600 }}>{currentSpace.path}</span>
          )}
        </div>
      </div>

      {/* Purpose — "Where you are & why", matching PlayerPanelV2's Purpose zone. */}
      <div style={pad}>
        <p style={zlbl}>Where you are &amp; why</p>
        <div style={{ background: p.surf, borderLeft: `3px solid ${p.accent}`, padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>📍 {spaceLabel}</div>
          {currentSpace.Event ? (
            <div style={{ fontSize: 12, color: p.muted, marginTop: 4, lineHeight: 1.5 }}>{currentSpace.Event}</div>
          ) : (
            <div style={{ fontSize: 12, color: p.muted, marginTop: 4, fontStyle: 'italic' }}>No story text yet</div>
          )}
        </div>
        {(currentSpace.Action || currentSpace.Outcome) && (
          <>
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 6,
                padding: '4px 2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                color: p.accent,
              }}
            >
              <span aria-hidden>{showWhy ? '▾' : '▸'}</span> What to do &amp; why
            </button>
            {showWhy && (
              <div style={{ marginTop: 4 }}>
                {currentSpace.Action && (
                  <div style={{ background: p.surf2, borderLeft: `3px solid ${p.accent}`, padding: '8px 10px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <strong>What to do:</strong> {currentSpace.Action}
                    </div>
                  </div>
                )}
                {currentSpace.Outcome && (
                  <div style={{ background: p.surf2, borderLeft: `3px solid ${p.muted}`, padding: '8px 10px', marginTop: 4 }}>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      <strong>Why:</strong> {currentSpace.Outcome}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Things you can do — card + outcome actions, plus movement. */}
      {hasThingsToDo && (
        <div style={pad}>
          <p style={zlbl}>Things you can do</p>
          {cardActions.length === 0 && diceActions.length === 0 && (
            <div style={{ fontSize: 12, color: p.muted, fontStyle: 'italic', marginBottom: 7 }}>No actions authored yet</div>
          )}
          {cardActions.map((a) => (
            <div key={a.key} style={actionBtn}>{a.icon} {a.label}</div>
          ))}
          {diceActions.map((a) => (
            <div key={a.key} style={actionBtn}>{a.icon} {a.label}</div>
          ))}
          {destinations.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setShowMoveOptions((v) => !v)}
                aria-expanded={showMoveOptions}
                style={actionBtn}
              >
                <span aria-hidden>{showMoveOptions ? '▾' : '▸'}</span> ➡️ Move — {destinations.length} options
              </button>
              {showMoveOptions && (
                <div style={{ marginLeft: 12, paddingLeft: 10, borderLeft: `2px solid ${p.border}`, marginTop: 2 }}>
                  {destinations.map((d) => (
                    <div key={d.id} style={subActionBtn}>➡️ {d.label}</div>
                  ))}
                </div>
              )}
            </>
          )}
          {destinations.length === 1 && (
            <div style={{ fontSize: 12, color: p.muted, padding: '4px 2px' }}>
              ➡️ Next: {destinations[0].label} <span style={{ fontSize: 10 }}>(automatic)</span>
            </div>
          )}
        </div>
      )}

      {/* Footer — commit spine. No live cost data to preview in the editor,
          so this approximates TurnCommitControl's two-option layout without
          its interactive hold-to-commit behavior. */}
      <div style={{ padding: '11px 13px' }}>
        {showTryAgain ? (
          <div style={{
            display: 'flex',
            borderRadius: 11,
            overflow: 'hidden',
            border: `1px solid ${p.borderStrong}`,
            background: p.surf,
          }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '13px 8px', fontSize: 13, fontWeight: 600, color: p.text }}>
              {tryAgainLabel}
            </div>
            <div style={{
              flex: 1,
              textAlign: 'center',
              padding: '13px 8px',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: p.accent,
              borderLeft: `1px solid ${p.borderStrong}`,
            }}>
              {endTurnLabel}
            </div>
          </div>
        ) : (
          <div style={{
            width: '100%',
            border: 'none',
            borderRadius: 11,
            padding: 13,
            fontSize: 15,
            fontWeight: 500,
            color: '#fff',
            background: p.accent,
            textAlign: 'center',
            boxSizing: 'border-box',
          }}>
            {endTurnLabel}
          </div>
        )}
      </div>
    </div>
  );
}
