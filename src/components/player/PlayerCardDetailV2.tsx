// PlayerCardDetailV2 — the redesigned detailed-card view (redesign spec §5).
//
// Reuses the proven ModalBase shell so we keep its protections intact — the
// backdrop click-through grace window (the v3.0.71 flash-close fix), Escape,
// reduced-motion, focus, and mobile sizing — and renders a panel-themed body
// inside it (flat cards, icon-row key facts, "why this matters" callout, the
// light-button rule on the footer).
//
// Card DATA and ACTIONS go through the services (cardService.canPlayCard /
// playCard) — NO component-local re-derivation of playability (same no-drift
// rule the panel uses for canEndTurn / canPlayCard).
//
// §10.1 hook: `variant` lets a future "permitting-document" card (Change Order /
// DOB Objection from the change-legibility UX layer) reuse this exact shell with
// document styling — no second modal system.
//
// Dark-mode body is a deliberate follow-up: ModalBase's container is light-only,
// so the body renders in the light palette regardless of `mode` for now (mirrors
// how glossary dark-mode shipped as its own step).

import React, { useState } from 'react';
import { Card } from '../../types/DataTypes';
import { IServiceContainer } from '../../types/ServiceContracts';
import { TextWithTerms, useDictionaryPanel } from '../../dictionary';
import { ModalBase } from '../modals/shared/ModalBase';
import { getCardTypeColors } from '../common/CardTypeBadge';
import { panelPalettes, PanelMode } from './panelTheme';

type CardVariant = 'portfolio' | 'document';

export interface PlayerCardDetailV2Props {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  playerId: string;
  gameServices: IServiceContainer;
  /** Reserved for the panel's light/dark mode; body is light-only for now. */
  mode?: PanelMode;
  /** §10.1 seam — 'document' reuses this shell for permitting-document cards. */
  variant?: CardVariant;
}

// Type-level teaching notes — stable domain facts, NOT fabricated per-card text.
const CARD_TYPE_META: Record<string, { label: string; emoji: string; teaches: string }> = {
  W: { label: 'Work Package', emoji: '🧱', teaches: 'Work packages are the scope of construction — what actually gets built, filed, and inspected.' },
  B: { label: 'Bank Loan', emoji: '🏦', teaches: 'Bank financing funds the project, but loans carry fees charged against the principal.' },
  E: { label: 'Expeditor', emoji: '⚡', teaches: 'Expeditors are real NYC permitting pros — each one speeds a specific project phase.' },
  L: { label: 'Life Event', emoji: '📰', teaches: 'Life events are the real-world surprises that shift a project’s time and money.' },
  I: { label: 'Investor', emoji: '💼', teaches: 'Investor capital funds the project for a share — no repayment, but a fee applies.' },
};

export const PlayerCardDetailV2: React.FC<PlayerCardDetailV2Props> = ({
  isOpen,
  onClose,
  card,
  playerId,
  gameServices,
}) => {
  const p = panelPalettes.light; // light-first; dark modal body is a follow-up
  const { openWithTerm } = useDictionaryPanel();
  const [busy, setBusy] = useState(false);

  if (!card) return null;

  const meta = CARD_TYPE_META[card.card_type] || { label: card.card_type, emoji: '📄', teaches: '' };
  const typeColors = getCardTypeColors(card.card_type || '');
  // Only Expeditors (E) are "activated" from this view. The influence zone offers
  // Activate on E cards only, and an E activation is the game's one play-from-hand
  // action — Work Packages (scope), funding (B/I), and Life Events (auto-applied)
  // reach this detail view via the card chips for REFERENCE, with nothing to
  // activate (fb:8d68ab14 — a Work Package detail showed an Activate button with
  // "nothing to activate"). TYPE eligibility is gated here, mirroring
  // PlayerPanelV2's E-only `playableExpeditors` filter; TIMING/phase/affordability
  // stays in the shared `canPlayCard` rule (no logic re-derived in the component).
  // NOTE: the shared rule itself still returns true for non-E types, so the classic
  // CardModal shows the same stray Activate — tightening that rule is a design call
  // (bundled with fb:66bb0bda), deliberately left to the maintainer.
  const canPlay = card.card_type === 'E' && gameServices.cardService.canPlayCard(playerId, card.card_id);

  // When an Expeditor is held but not currently playable AND it carries a phase
  // restriction, explain the wait instead of silently offering no action —
  // mirrors the classic panel's "Can only be activated during X phase"
  // (CardsSection). Presentation only; the gate itself stays in canPlayCard. We
  // don't re-derive WHY it's blocked, but an expeditor with a phase restriction
  // is overwhelmingly blocked by phase, and the phase is a real requirement
  // either way (it's shown as a Key Fact too).
  const showPhaseWait =
    card.card_type === 'E' && !canPlay && !!card.phase_restriction && card.phase_restriction !== 'Any';
  const phaseWaitName = (card.phase_restriction || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // "What it does" renders `effects_on_play`, but ALL 74 E + 49 L cards carry the
  // generic placeholder "Apply Card" (audit 2026-06-23) — and it's redundant with
  // the description + key-facts rows anyway. Suppress the section for the
  // placeholder (and when it just echoes the description) so the detail stays
  // clean until/unless real effect prose is authored. W/B/I cards are authored
  // and unaffected.
  const effects = (card.effects_on_play || '').trim();
  const showEffects = effects !== '' && !/^apply card$/i.test(effects) && effects !== (card.description || '').trim();

  // Key facts — only rendered when the card actually carries them. A `valueColor`
  // tints the value where there's a clear good/bad axis (light-mode safe reds/
  // greens); the label word (Adds / Saves) is always the primary signal so colour
  // is never the sole cue (a11y).
  const GOOD = '#1e7e34'; // saves days — green
  const BAD = '#c0392b';  // adds days — red (same red as over-budget elsewhere)
  const tick = card.tick_modifier ? parseInt(card.tick_modifier, 10) : undefined;
  const facts: { icon: string; label: string; value: string; valueColor?: string }[] = [];
  // Money: `card.cost` is always money the player SPENDS (a Work Package's
  // estimated construction cost, an Expeditor's activation fee), whereas
  // `money_effect` is a signed delta (negative = pays out, positive = receives).
  // The old code merged them, so a positive `card.cost` rendered as "Pays $X" —
  // reading like income (fb:9c110d52: "says Pays but this is an estimated cost,
  // not a reward"). Treat a cost as a cost; only a positive money_effect is income.
  if (card.cost != null && !isNaN(card.cost) && card.cost > 0) {
    facts.push({ icon: '💸', label: 'Costs', value: `$${card.cost.toLocaleString()}` });
  } else if (card.money_effect) {
    const m = parseInt(card.money_effect, 10);
    if (!isNaN(m) && m !== 0) {
      facts.push({ icon: m < 0 ? '💸' : '💰', label: m < 0 ? 'Costs' : 'Pays', value: `$${Math.abs(m).toLocaleString()}` });
    }
  }
  if (tick != null && !isNaN(tick) && tick !== 0) {
    // Expeditors save time (tick < 0 = good); delays add it (tick > 0 = bad).
    // Colour the value to match — fb:39fd9f04 ("adding days should read red,
    // saving days green").
    facts.push({
      icon: '🕐',
      label: tick < 0 ? 'Saves' : 'Adds',
      value: `${Math.abs(tick)} day${Math.abs(tick) === 1 ? '' : 's'}`,
      valueColor: tick < 0 ? GOOD : BAD,
    });
  }
  if (card.duration && card.duration !== 'Permanent' && card.duration !== '0') {
    facts.push({ icon: '⏳', label: 'Lasts', value: card.duration });
  }
  if (card.phase_restriction && card.phase_restriction !== 'Any') {
    facts.push({ icon: '🔒', label: 'Phase', value: `${card.phase_restriction} only` });
  }
  facts.push({ icon: card.is_transferable ? '↔️' : '🚫', label: 'Transferable', value: card.is_transferable ? 'Yes' : 'No' });

  const handleActivate = async () => {
    setBusy(true);
    try {
      await gameServices.cardService.playCard(playerId, card.card_id);
      onClose();
    } catch (err) {
      console.error('Card activate error:', err);
    } finally {
      setBusy(false);
    }
  };

  // Footer — light-button rule: every control has a visible dark border + text.
  // The dismiss button only reads "Keep" when there's a real choice to make
  // (an activatable expeditor: activate now vs. keep for later). In a review-only
  // view "Keep" wrongly implies a keep/replace/fire decision (fb:f4d0e327 — "I'm
  // only reviewing; there's no need for a keep button"), so it reads "Done".
  // ("Close" would collide with ModalBase's X-button accessible name.)
  const dismissLabel = canPlay ? 'Keep' : 'Done';
  const footer = (
    <>
      {canPlay && (
        <button
          onClick={handleActivate}
          disabled={busy}
          // No card name in the label: the dialog is already titled with the card
          // name, and the influence-zone row carries "Activate <card name>". Two
          // identical accessible names on screen at once (modal over panel) is an
          // a11y ambiguity — keep the modal's plain "Activate" distinct.
          style={{
            border: `1px solid ${p.accent}`,
            background: p.accent,
            color: '#fff',
            borderRadius: 9,
            padding: '9px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: busy ? 'default' : 'pointer',
            minHeight: 44,
          }}
        >
          {busy ? 'Working…' : 'Activate'}
        </button>
      )}
      <button
        onClick={onClose}
        aria-label={dismissLabel}
        style={{
          border: `1px solid ${p.borderStrong}`,
          background: p.surf,
          color: p.text,
          borderRadius: 9,
          padding: '9px 16px',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        {dismissLabel}
      </button>
    </>
  );

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.05em',
    color: p.muted,
    textTransform: 'uppercase',
    margin: '0 0 6px',
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={card.card_name}
      emoji={meta.emoji}
      maxWidth="460px"
      headerColor={typeColors.bg}
      headerBorderColor={typeColors.primary}
      footer={footer}
      testId="player-card-detail-v2"
    >
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: p.text }}>
        {/* Type chip */}
        <div style={{ marginBottom: 14 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 9,
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              background: typeColors.primary,
            }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>

        {/* Not-yet (phase) hint — why there's no Activate button right now. */}
        {showPhaseWait && (
          <div
            data-testid="phase-wait-hint"
            style={{
              fontSize: 12.5,
              lineHeight: 1.5,
              color: p.text,
              background: '#fff7ed',
              borderLeft: '3px solid #f59e0b',
              borderRadius: 8,
              padding: '9px 12px',
              marginBottom: 14,
            }}
          >
            ⏳ <span style={{ fontWeight: 600 }}>Not yet —</span> this expeditor can only be activated during the{' '}
            {phaseWaitName} phase. Hold onto it until you get there.
          </div>
        )}

        {/* What this is */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionLabel}>What this is</p>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            <TextWithTerms text={card.description || 'No description available.'} onTermClick={(term) => openWithTerm(term.id)} />
          </div>
        </div>

        {/* What it does — hidden for the "Apply Card" placeholder (all E/L cards). */}
        {showEffects && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionLabel}>What it does</p>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                background: p.surf,
                borderLeft: `3px solid ${p.accent}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
            >
              <TextWithTerms text={effects} onTermClick={(term) => openWithTerm(term.id)} />
            </div>
          </div>
        )}

        {/* Key facts — icon rows */}
        {facts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionLabel}>Key facts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {facts.map((f) => (
                <div
                  key={f.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    background: p.surf,
                    borderRadius: 8,
                    padding: '7px 10px',
                  }}
                >
                  <span aria-hidden style={{ width: 18, textAlign: 'center' }}>{f.icon}</span>
                  <span style={{ color: p.muted, flex: 1 }}>{f.label}</span>
                  <span style={{ fontWeight: 600, color: f.valueColor ?? p.text }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why this matters — teaching callout */}
        {meta.teaches && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: p.text,
              background: p.surf2,
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <span style={{ fontWeight: 600 }}>💡 Why this matters: </span>
            {meta.teaches}
          </div>
        )}
      </div>
    </ModalBase>
  );
};
