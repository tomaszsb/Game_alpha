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

import React, { useEffect, useRef, useState } from 'react';
import { SpaceRow, DiceRollRow, ModalConfigRow } from './types/EditorTypes';
import { editRegionLabel, regionById, REGION_EDITING_CLASS, REGION_PULSE_CLASS } from './spaceRegions';
import { usePanelMode, panelPalettes } from '../player/panelTheme';
import { colors } from '../../styles/theme';
import { shortName } from '../../utils/boardCommon';
import { DICE_BUTTON } from '../../constants/uiStrings';
import { IconMoon, IconSun } from '../icons/SetupIcons';

interface PlayerPreviewPanelProps {
  currentSpace: SpaceRow | null;
  visitType: 'First' | 'Subsequent';
  diceRollData: DiceRollRow[];
  /**
   * The pop-up wording rows for the whole board. Needed because a pop-up's
   * words are otherwise edited blind — nothing on this panel showed them.
   * Leave it out and the pop-ups show their standard wording.
   */
  modalConfigData?: ModalConfigRow[];
  /**
   * "Take me to the fields that make this bit." Given, every part of this
   * panel that spaceRegions.ts knows about becomes a real button that says
   * out loud which fields it opens. Left out, the panel is just a picture —
   * which is what browsing wants.
   */
  onEditRegion?: (regionId: string) => void;
  /** The part to flash right now, because a field feeding it was just typed in. */
  highlightRegion?: string | null;
  /**
   * The part being worked in right now — lit steadily and scrolled into view,
   * for as long as the cursor is in a field that feeds it. Separate from
   * `highlightRegion`, which is the brief flash after a keystroke.
   */
  editingRegion?: string | null;
}

/**
 * The two ways a part of this panel can be lit, off one place so Region and
 * EditChip cannot disagree: a brief flash after a keystroke, and a steady mark
 * on the part whose fields hold the cursor.
 */
function regionClasses(id: string, highlight?: string | null, editing?: string | null): string {
  let out = '';
  if (highlight === id) out += ` ${REGION_PULSE_CLASS}`;
  if (editing === id) out += ` ${REGION_EDITING_CLASS}`;
  return out;
}

/**
 * One part of the player view, tied to spaceRegions.ts by its id.
 *
 * A real <button> when it can be clicked through to the fields, and a plain
 * <div> when it cannot — never a div pretending, and never a button hidden
 * inside a <label> where it would steal the field's name (the shape that
 * shipped a bug here recently).
 */
function Region({ id, onEdit, highlight, editing, style, children }: {
  id: string;
  onEdit?: (regionId: string) => void;
  highlight?: string | null;
  editing?: string | null;
  style?: React.CSSProperties;
  children: React.ReactNode;
}): JSX.Element {
  const lit = regionClasses(id, highlight, editing);
  if (!onEdit) {
    return <div className={`space-region${lit}`} data-region-id={id} style={style}>{children}</div>;
  }
  return (
    <button
      type="button"
      className={`space-region space-region-click${lit}`}
      data-region-id={id}
      aria-label={editRegionLabel(id)}
      onClick={() => onEdit(id)}
      style={{
        display: 'block', width: '100%', textAlign: 'left', font: 'inherit',
        color: 'inherit', background: 'none', border: 'none', padding: 0, margin: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * The small pencil for a part of the panel that already has something of its
 * own to click (the two fold-outs). Beside that control, never wrapped around
 * it — a button inside a button is not a thing.
 */
function EditChip({ id, onEdit, highlight, editing, accent }: {
  id: string; onEdit?: (regionId: string) => void; highlight?: string | null;
  editing?: string | null; accent: string;
}): JSX.Element | null {
  if (!onEdit) return null;
  const lit = regionClasses(id, highlight, editing);
  return (
    <button
      type="button"
      className={`space-region space-region-click${lit}`}
      data-region-id={id}
      aria-label={editRegionLabel(id)}
      onClick={() => onEdit(id)}
      style={{
        background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer',
        fontSize: 11, color: accent, lineHeight: 1,
      }}
    >
      <span aria-hidden>✏️</span>
    </button>
  );
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

export function PlayerPreviewPanel({
  currentSpace, visitType, diceRollData, modalConfigData, onEditRegion, highlightRegion, editingRegion,
}: PlayerPreviewPanelProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mode, toggleMode] = usePanelMode();
  const p = panelPalettes[mode];
  // Collapsed by default, same as PlayerPanelV2's "What to do & why" and
  // "Move" toggles — approximating the first-look state a player actually sees.
  // Unless the panel is mounted already editing that very section, which the
  // change-detector below cannot catch (on the first render there is no
  // change to detect), so the initial value has to cover it.
  const [showWhy, setShowWhy] = useState(editingRegion === 'guidance');
  const [showMoveOptions, setShowMoveOptions] = useState(editingRegion === 'destinations');

  // A part folded away is lit where nobody can see it. Both fold-outs start
  // shut (that is the first-look state a player gets), so clicking into a
  // field that feeds one used to mark the fold-out's little pencil and stop
  // there — technically an answer, practically a whisper. Working in a
  // section's fields is a clear statement that you want to see that section,
  // so it opens itself. It is never re-closed here: closing something the
  // moment the cursor moves on would be its own kind of rude.
  // (fb 2026-08-30: "it does not expand the view if it was colappsed".)
  //
  // Adjusted during render rather than in an effect, which is React's own
  // guidance for state that follows a prop change (and what
  // react-hooks/set-state-in-effect asks for). It is not only about the lint:
  // an effect would commit the shut section first and reopen it a frame
  // later, and — the real bug — it would re-run and force the section back
  // open every time anything else re-rendered while the cursor sat in those
  // fields, so the fold-out's own button could not close it. Setting the same
  // state the button sets, once per change of `editingRegion`, leaves the
  // button working exactly as before.
  const [lastEditingRegion, setLastEditingRegion] = useState<string | null | undefined>(editingRegion);
  if (editingRegion !== lastEditingRegion) {
    setLastEditingRegion(editingRegion);
    if (editingRegion === 'guidance') setShowWhy(true);
    if (editingRegion === 'destinations') setShowMoveOptions(true);
  }

  // Lighting a part that is scrolled out of sight tells nobody anything, and
  // this panel is taller than its box on most spaces. `block: 'nearest'` so a
  // part already on screen does not jump.
  //
  // Depends on both fold-out flags, not just editingRegion: when the effect
  // above opens a section, the element to scroll to does not exist yet on
  // this pass. Re-running once the section is open is what actually brings it
  // into view.
  useEffect(() => {
    if (!editingRegion) return;
    const root = rootRef.current;
    if (!root) return;
    root
      .querySelector<HTMLElement>(`[data-region-id="${editingRegion}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [editingRegion, showWhy, showMoveOptions]);

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
        // The one map decides which fields this button belongs to.
        regionId: `action-${cf.type}`,
        icon: meta ? meta.emoji : '📄',
        label: customLabel || defaultCardActionLabel(cf.type, count),
      };
    })
    .filter((x): x is { key: string; regionId: string; icon: string; label: string } => x !== null);

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

  // --- the pop-ups this space raises, and what each will say ---------------
  // Until now this panel showed none of them, so their wording was written
  // blind. Each one below is tied to spaceRegions.ts by its id, so it opens
  // the same wording boxes the rest of the panel opens.
  const modalRows = modalConfigData ?? [];
  const modalFor = (effectAction: string, diceValue = ''): ModalConfigRow | undefined =>
    modalRows.find(r => r.space_name === currentSpace.space_name && r.visit_type === visitType
      && r.effect_action === effectAction && (r.dice_value || '') === diceValue);

  const popupFor = (regionId: string, effectAction: string, fallbackBody: string) => {
    const cfg = modalFor(effectAction);
    const extraRolls = effectAction === 'dice'
      ? modalRows.filter(r => r.space_name === currentSpace.space_name && r.visit_type === visitType
          && r.effect_action === 'dice' && !!(r.dice_value || '')).length
      : 0;
    return {
      regionId,
      title: cfg?.modal_title || '',
      body: cfg?.modal_description || fallbackBody,
      button: cfg?.modal_button_label || '',
      summary: cfg?.modal_summary || '',
      extraRolls,
      authored: !!(cfg && (cfg.modal_title || cfg.modal_description || cfg.modal_button_label || cfg.modal_summary))
        || !!fallbackBody || extraRolls > 0,
    };
  };
  type PopupPreview = ReturnType<typeof popupFor>;

  const popups: PopupPreview[] = [];
  cardFields.forEach((cf) => {
    if (!currentSpace[cf.key]) return;
    const narrative = currentSpace[`${cf.type.toLowerCase()}_card_narrative` as keyof SpaceRow] as string;
    popups.push(popupFor(`popup-${cf.type}`, `draw_${cf.type}`, narrative || ''));
  });
  if (currentSpace.Time) popups.push(popupFor('popup-time', 'add', ''));
  if (currentSpace.Fee) popups.push(popupFor('popup-fee', 'deduct', ''));
  if (isDiceMovementSpace) popups.push(popupFor('popup-outcome', 'dice', ''));
  if (showTryAgain) popups.push(popupFor('popup-negotiate', 'negotiate', ''));
  // These two are not raised by anything the space itself declares, so they
  // are only worth showing once somebody has actually written words for them.
  const choicePopup = popupFor('popup-choice', 'choice', '');
  if (choicePopup.authored) popups.push(choicePopup);
  const endGamePopup = popupFor('popup-end-game', 'end_game', '');
  if (endGamePopup.authored) popups.push(endGamePopup);

  // ── The part you are working in, when the panel would not otherwise draw it.
  //
  // This panel shows what a PLAYER would see, and a player never sees a thing
  // that isn't set up — an action with no card behind it, a pop-up the space
  // never raises. So those simply were not drawn, and clicking into their
  // (blank) fields lit nothing at all. That is backwards: a field with words
  // already in it can usually be guessed from its own contents, and the EMPTY
  // one is where "what does this even feed?" actually gets asked.
  // (fb 2026-08-30: "it displays only if it already exists. if the item is
  // currently blank it does not open up a new area to show".)
  //
  // Note which regions are NOT in this problem: story, cost and destinations
  // already draw their own "nothing here yet" line and light up correctly
  // while blank. The fix below is to give the rest the same courtesy, not to
  // invent a new idiom.
  //
  // Only the region being edited gets one. Permanently ghosting all five
  // unset actions would park five grey rows on screen for good — the exact
  // crowding the maintainer objected to in v3.2.35 ("now it feels a little
  // crowded when folded"). This appears where the cursor is and leaves with it.
  const renderedRegionIds = new Set<string>([
    ...cardActions.map(a => a.regionId),
    ...popups.map(pu => pu.regionId),
    ...(diceActions.length > 0 ? ['outcomes'] : []),
    ...(showTryAgain ? ['try-again'] : []),
    // Drawn whether or not they hold anything, each with its own empty state.
    'story', 'cost', 'guidance', 'destinations', 'end-turn',
  ]);
  const ghostRegionId = editingRegion && !renderedRegionIds.has(editingRegion) ? editingRegion : null;

  // A missing pop-up needs no special shape: the pop-ups block already draws
  // "Standard wording — nothing written for this one yet" properly. It just
  // has to be in the list. The effect_action comes off the region's own
  // `modal:` anchor rather than a second hand-written mapping — spaceRegions
  // stays the one map, which is the whole point of that file.
  if (ghostRegionId && ghostRegionId.startsWith('popup-')) {
    const modalAnchor = (regionById(ghostRegionId)?.anchors ?? []).find(a => a.startsWith('modal:'));
    if (modalAnchor) popups.push(popupFor(ghostRegionId, modalAnchor.slice('modal:'.length), ''));
  }

  // The two that need a placeholder drawn: an unset action (and the outcome
  // table, which is an action row here), and the negotiate button on a space
  // that does not offer negotiating.
  const ghostActionId = ghostRegionId && (ghostRegionId.startsWith('action-') || ghostRegionId === 'outcomes')
    ? ghostRegionId
    : null;
  const ghostTryAgain = ghostRegionId === 'try-again';

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
  // A slot that does not exist yet, shown only while its fields hold the
  // cursor. Dashed and muted so it reads as an outline of something that
  // could be here — never mistakable for a real action a player would see.
  const ghostBtn: React.CSSProperties = {
    ...actionBtn,
    background: 'transparent',
    border: `1px dashed ${p.borderStrong}`,
    color: p.muted,
    fontStyle: 'italic',
    fontWeight: 400,
  };

  return (
    <div ref={rootRef} style={{ width: '100%', height: '100%', overflow: 'auto', background: p.bg, color: p.text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* "That's this bit" flash, plus the hover/focus outline that says a
          part of this panel can be clicked through to its fields. Same
          component-scoped <style> + toggled class pattern BoardCanvas uses for
          its chronicle highlight (v3.2.16) — not a second way of doing it. */}
      <style>{`
        @keyframes space-region-pulse-kf {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0); }
          50% { box-shadow: 0 0 0 5px rgba(124,58,237,0.5); }
        }
        .${REGION_PULSE_CLASS} {
          border-radius: 6px;
          animation: space-region-pulse-kf 0.75s ease-in-out 2;
        }
        /* Steady, not animated: this says "you are in here", and a thing that
           pulses for as long as you type in it would be unbearable. */
        .${REGION_EDITING_CLASS} {
          border-radius: 6px;
          outline: 2px solid ${p.accent};
          outline-offset: 2px;
        }
        .space-region-click { cursor: pointer; }
        .space-region-click:hover { outline: 1px dashed ${p.accent}; outline-offset: 2px; }
        .space-region-click:focus-visible { outline: 2px solid ${p.accent}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .${REGION_PULSE_CLASS} { animation: none; box-shadow: 0 0 0 4px rgba(124,58,237,0.5); }
        }
      `}</style>
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
          <Region id="cost" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 16, width: 'auto' }}>
            {currentSpace.Time && (
              <span style={stat}>
                <span aria-hidden>🕐</span>{currentSpace.Time}
              </span>
            )}
            {currentSpace.Fee && (
              <span style={stat}>
                <span aria-hidden>💰</span>{currentSpace.Fee}
              </span>
            )}
            {!currentSpace.Time && !currentSpace.Fee && (
              <span style={{ fontSize: 11, color: p.muted, fontStyle: 'italic' }}>No days or fee here</span>
            )}
          </Region>
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
        <Region id="story" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
          style={{ background: p.surf, borderLeft: `3px solid ${p.accent}`, padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>📍 {spaceLabel}</div>
          {currentSpace.Event ? (
            <div style={{ fontSize: 12, color: p.muted, marginTop: 4, lineHeight: 1.5 }}>{currentSpace.Event}</div>
          ) : (
            <div style={{ fontSize: 12, color: p.muted, marginTop: 4, fontStyle: 'italic' }}>No story text yet</div>
          )}
        </Region>
        {/* The fold-out is already a control of its own, so the way through
            to its fields sits BESIDE it as its own button rather than around
            it — a button inside a button is not a thing, and a control inside
            a <label> takes the label's words as its own name. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 6 }}>
          {(currentSpace.Action || currentSpace.Outcome) ? (
            <button
              type="button"
              onClick={() => setShowWhy((v) => !v)}
              aria-expanded={showWhy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
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
          ) : (
            <span style={{ fontSize: 11, color: p.muted, fontStyle: 'italic', padding: '4px 2px' }}>
              Nothing written about what to do here yet
            </span>
          )}
          <EditChip id="guidance" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion} accent={p.accent} />
        </div>
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
      </div>

      {/* Things you can do — card + outcome actions, plus movement.
          Also drawn for a ghost slot alone: editing an unset action on a space
          with nothing else to do must still have somewhere to point. */}
      {(hasThingsToDo || ghostActionId) && (
        <div style={pad}>
          <p style={zlbl}>Things you can do</p>
          {cardActions.length === 0 && diceActions.length === 0 && !ghostActionId && (
            <div style={{ fontSize: 12, color: p.muted, fontStyle: 'italic', marginBottom: 7 }}>No actions authored yet</div>
          )}
          {ghostActionId && (
            <Region id={ghostActionId} onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
              style={ghostBtn}>
              <span aria-hidden>⬚</span>
              {regionById(ghostActionId)?.shortLabel || regionById(ghostActionId)?.label} — nothing set here yet
            </Region>
          )}
          {cardActions.map((a) => (
            <Region key={a.key} id={a.regionId} onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion} style={actionBtn}>
              {a.icon} {a.label}
            </Region>
          ))}
          {diceActions.map((a) => (
            <Region key={a.key} id="outcomes" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion} style={actionBtn}>
              {a.icon} {a.label}
            </Region>
          ))}
          {destinations.length > 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button
                  type="button"
                  onClick={() => setShowMoveOptions((v) => !v)}
                  aria-expanded={showMoveOptions}
                  style={actionBtn}
                >
                  <span aria-hidden>{showMoveOptions ? '▾' : '▸'}</span> ➡️ Move — {destinations.length} options
                </button>
                <EditChip id="destinations" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion} accent={p.accent} />
              </div>
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
            <Region id="destinations" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
              style={{ fontSize: 12, color: p.muted, padding: '4px 2px' }}>
              ➡️ Next: {destinations[0].label} <span style={{ fontSize: 10 }}>(automatic)</span>
            </Region>
          )}
          {destinations.length === 0 && (
            <Region id="destinations" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
              style={{ fontSize: 12, color: p.muted, fontStyle: 'italic', padding: '4px 2px' }}>
              ➡️ Where they go next is not set here
            </Region>
          )}
        </div>
      )}

      {/* The pop-ups. These words used to be written blind — nothing on this
          panel showed them at all. Drawn as little windows with a title bar so
          they read as something that lands ON TOP of the panel, not as another
          part of it. Each one opens the same wording boxes the rest of this
          panel opens, through the same map. */}
      {popups.length > 0 && (
        <div style={pad}>
          <p style={zlbl}>Pop-ups players will see</p>
          <div style={{ fontSize: 11, color: p.muted, marginBottom: 8 }}>
            These land on top of this panel when they happen.
          </div>
          {popups.map((pu) => (
            <div key={pu.regionId} style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 10, color: p.muted, marginBottom: 3 }}>
                {regionById(pu.regionId)?.label}
              </div>
              <Region id={pu.regionId} onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
                style={{
                  border: `1px solid ${p.borderStrong}`, borderRadius: 9, overflow: 'hidden',
                  background: p.surf, width: '100%', boxSizing: 'border-box',
                }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px',
                  background: p.surf2, borderBottom: `1px solid ${p.border}`,
                }}>
                  <span aria-hidden style={{ fontSize: 9, letterSpacing: 2, color: p.muted }}>●●●</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: pu.title ? p.text : p.muted, fontStyle: pu.title ? 'normal' : 'italic' }}>
                    {pu.title || 'Standard heading'}
                  </span>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  {pu.body ? (
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>{pu.body}</div>
                  ) : (
                    <div style={{ fontSize: 12, color: p.muted, fontStyle: 'italic' }}>
                      Standard wording — nothing written for this one yet
                    </div>
                  )}
                  {pu.summary && (
                    <div style={{ fontSize: 11, color: p.muted, marginTop: 5 }}>{pu.summary}</div>
                  )}
                  {pu.extraRolls > 0 && (
                    <div style={{ fontSize: 10, color: p.muted, marginTop: 5 }}>
                      {pu.extraRolls} outcome{pu.extraRolls === 1 ? ' has' : 's have'} wording of their own
                    </div>
                  )}
                  <div style={{ marginTop: 7 }}>
                    <span style={{
                      display: 'inline-block', padding: '5px 12px', borderRadius: 7,
                      background: p.accent, color: '#fff', fontSize: 11, fontWeight: 600,
                    }}>
                      {pu.button || 'Continue'}
                    </span>
                  </div>
                </div>
              </Region>
            </div>
          ))}
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
            <Region id="try-again" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
              style={{ flex: 1, textAlign: 'center', padding: '13px 8px', fontSize: 13, fontWeight: 600, color: p.text, width: 'auto' }}>
              {tryAgainLabel}
            </Region>
            <Region id="end-turn" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '13px 8px',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: p.accent,
                borderLeft: `1px solid ${p.borderStrong}`,
                width: 'auto',
              }}>
              {endTurnLabel}
            </Region>
          </div>
        ) : (
          <>
            {/* Negotiating is off for this space, so a player would see no
                such button — but its wording is still editable, and editing it
                has to point somewhere. */}
            {ghostTryAgain && (
              <Region id="try-again" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
                style={{ ...ghostBtn, justifyContent: 'center', textAlign: 'center', marginBottom: 9 }}>
                <span aria-hidden>⬚</span>
                {tryAgainLabel} — negotiating is off for this space
              </Region>
            )}
            <Region id="end-turn" onEdit={onEditRegion} highlight={highlightRegion} editing={editingRegion}
              style={{
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
            </Region>
          </>
        )}
      </div>
    </div>
  );
}
