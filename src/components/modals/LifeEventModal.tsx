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

export interface LifeEventModalData {
  card: Card;
  /** Roll value that triggered the draw (1-6). Surfaced for transparency. */
  diceValue?: number;
  /** Space the player was on when it fired (for context, not header). */
  spaceName?: string;
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

  const { card, diceValue, spaceName } = data;
  const lColors = colors.game.cardTypes.L;

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
          {diceValue !== undefined && (
            <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.85 }}>
              (rolled {diceValue}{spaceName ? ` at ${spaceName}` : ''})
            </span>
          )}
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
      </div>
    </ModalBase>
  );
}

export default LifeEventModal;
