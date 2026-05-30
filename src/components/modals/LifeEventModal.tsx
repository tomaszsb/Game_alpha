// src/components/modals/LifeEventModal.tsx
//
// Dedicated modal for the 1-in-6 dice-conditional Life Event card draw.
// fb:dfdeaf1c — playtester said life events felt "mixed with the Architect modal."
// Root cause: the AutoActionEvent {type: 'life_event'} handler in GameLayout
// previously reused the generic DiceResultModal, stomped its state, and inherited
// the originating space's header — so visually it looked like a row inside the
// Architect roll outcome.
//
// This component is the player-facing other-half of that fix: a distinct,
// branded modal that frames the event as a major disturbance — red theme,
// ⚡ icon, shake animation on open. The hidden-when-unrolled property of the
// life-event mechanic stays intact (no modal opens unless a card actually drops).

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors, theme } from '../../styles/theme';
import { Card } from '../../types/DataTypes';
import type { LifeEventEffectSummary } from '../../services/StateService';

export interface LifeEventModalData {
  card: Card;
  /** Roll value that triggered the draw (1-6). Surfaced for transparency. */
  diceValue?: number;
  /** Space the player was on when it fired (for context, not header). */
  spaceName?: string;
  /**
   * v3.0.40 — ordered receipts of what the auto-applied card actually did
   * (money/time deltas, approval flips, card gains/losses, multi-turn
   * duration callout). Rendered as the "What just happened" block under
   * the card narrative. Empty/undefined → block is hidden so cards that
   * are pure narrative (no Kids effects) keep the legacy look.
   */
  effectsSummary?: LifeEventEffectSummary[];
}

interface LifeEventModalProps {
  isOpen: boolean;
  data: LifeEventModalData | null;
  onClose: () => void;
}

/**
 * LifeEventModal — dedicated UI for a life event card draw.
 *
 * Visual contract:
 *   - Red header (#dc3545 / cardTypes.L theme) so it's obviously NOT a normal
 *     dice result modal.
 *   - "⚡ LIFE EVENT" title — distinct from any space's roll outcome label.
 *   - Shake animation on open (the "major disturbance" feel from feedback).
 *   - Card name as the primary heading, then the description body verbatim.
 *   - Single dismiss button; no choices, no branching. The card's actual
 *     effects already applied before this modal opened.
 */
export function LifeEventModal({ isOpen, data, onClose }: LifeEventModalProps): JSX.Element | null {
  // Render closed ModalBase when data is missing so AnimatePresence can play
  // the exit animation (same pattern as DiceResultModal).
  if (!data) {
    return (
      <ModalBase isOpen={false} onClose={onClose} title="" emoji="" testId="life-event-modal">
        {null}
      </ModalBase>
    );
  }

  // v3.0.23: diceValue / spaceName from `data` are no longer rendered
  // (voice rule, fb:1aad6035). Props remain on the interface for backward
  // compatibility with callers and possible future admin-side use.
  const { card, effectsSummary } = data;
  const lColors = colors.game.cardTypes.L;
  const hasEffects = !!(effectsSummary && effectsSummary.length > 0);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="LIFE EVENT"
      emoji="⚡"
      testId="life-event-modal"
      headerColor={lColors.primary}
      headerBorderColor={lColors.border}
      shake={true}
      maxWidth="520px"
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{
            ...modalButtonStyles.danger,
            backgroundColor: lColors.primary,
          }}
          data-testid="life-event-modal-dismiss"
        >
          Got it
        </button>
      }
    >
      <div data-testid="life-event-modal-body">
        {/* Sub-banner: frames severity */}
        <div
          style={{
            backgroundColor: lColors.bg,
            border: `1px solid ${lColors.border}`,
            borderRadius: theme.button.borderRadius,
            padding: '12px 16px',
            marginBottom: '16px',
            color: lColors.text,
            fontWeight: 600,
            fontSize: '0.95rem',
          }}
        >
          A major disturbance just hit the project.
          {/*
            v3.0.23 (fb:1aad6035): removed the "(rolled {diceValue} at {spaceName})"
            parenthetical. Both "rolled" and the raw space-id leaked game machinery
            at the player (voice rule violation). The card body explains severity in
            character — players don't need the dice value to interpret the event.
            diceValue / spaceName props are still accepted so callers don't need to
            change; they're now visually unused but kept for potential future use
            (e.g. an admin-side replay view).
          */}
        </div>

        {/* Card name — the headline event */}
        <h3
          style={{
            margin: '0 0 8px 0',
            color: colors.text.primary,
            fontSize: '1.15rem',
            fontWeight: 700,
          }}
          data-testid="life-event-modal-card-name"
        >
          {card.card_name || 'Life Event'}
        </h3>

        {/* Card description — the narrative body */}
        {card.description && (
          <p
            style={{
              margin: 0,
              color: colors.text.primary,
              fontSize: '1rem',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
            data-testid="life-event-modal-card-description"
          >
            {card.description}
          </p>
        )}

        {/*
          v3.0.40 — receipts block. Playtest signal (2026-05-29): Kids A–E
          richer life-event effects ship in v3.0.39, but the modal showed only
          the card story so players couldn't tell the card had any teeth.
          This block surfaces each delta the card produced, in plain language,
          PM voice (PM is the in-character narrator for life-event spaces per
          the project voice rule — one of the 5 PM-voiced exceptions).
        */}
        {hasEffects && (
          <div
            data-testid="life-event-modal-effects"
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: `1px dashed ${lColors.border}`,
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: colors.text.muted ?? colors.text.primary,
                marginBottom: '8px',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              What just happened
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {effectsSummary!.map((entry, i) => {
                const icon = lifeEventEffectIcon(entry.kind);
                return (
                  <li
                    key={`${entry.kind}-${i}`}
                    data-testid={`life-event-effect-${entry.kind}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '0.95rem',
                      color: colors.text.primary,
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
                    <span>{entry.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

/**
 * v3.0.40 — icon for each life-event receipt kind. Money/time use the
 * existing project symbols (💰 / ⏱️) for consistency with the resource
 * panel; approvals get a stamp, card moves get a card face, duration
 * effects get the clock-back to signal "this isn't over yet."
 */
function lifeEventEffectIcon(kind: LifeEventEffectSummary['kind']): string {
  switch (kind) {
    case 'money': return '💰';
    case 'time': return '⏱️';
    case 'approval_revoke': return '🚫';
    case 'card_gained': return '🃏';
    case 'card_lost': return '🗑️';
    case 'duration_start': return '🔁';
  }
}

export default LifeEventModal;
