// src/components/modals/LifeEventModal.tsx
//
// Dedicated modal for the 1-in-6 dice-conditional Life Event card draw.
//
// History:
//  - fb:dfdeaf1c — life events used to render inside the generic DiceResultModal
//    with the originating space's header, so they read as part of the Architect
//    roll. The fix gave them their own dedicated modal.
//  - v3.0.68 (fb:1e76c24c / fb:701b26e3 / fb:7a2a2956) — that dedicated modal was
//    a hard red "⚡ A major disturbance just hit the project" banner. Playtest:
//    it "looks angry because it is red" and framed *good* news (e.g. "City
//    Council Allies — filing takes 2 days less") as a disaster, and showed the
//    card's raw "Roll a die. On 1-3…" instruction text even though the engine
//    already rolled and applied the outcome. This redesign reframes the event as
//    a newspaper bulletin — neutral parchment chrome, a tone-aware kicker (good
//    news reads as good news), and a "bottom line" receipt of what actually
//    changed rather than roll instructions.

import React from 'react';
import { ModalBase, modalButtonStyles } from './shared/ModalBase';
import { colors } from '../../styles/theme';
import { Card } from '../../types/DataTypes';
import type { LifeEventEffectSummary } from '../../services/StateService';
import { getCardDescriptionForPlayerCount } from '../../utils/templateInterpolation';

export interface LifeEventModalData {
  card: Card;
  /** Roll value that triggered the draw (1-6). Kept for back-compat; not shown. */
  diceValue?: number;
  /** Space the player was on when it fired. Kept for back-compat; not shown. */
  spaceName?: string;
  /**
   * Dateline for the newspaper masthead, e.g. "DAY 146". Optional — falls back
   * to a generic "SPECIAL EDITION" so legacy callers still render cleanly.
   */
  dayLabel?: string;
  /**
   * Ordered receipts of what the auto-applied card actually did (money/time
   * deltas, approval flips, card gains/losses, multi-turn duration). Rendered as
   * the "bottom line" block. Empty/undefined → block is hidden.
   */
  effectsSummary?: LifeEventEffectSummary[];
}

interface LifeEventModalProps {
  isOpen: boolean;
  data: LifeEventModalData | null;
  onClose: () => void;
  /**
   * Number of players in the current game. Used to trim known multiplayer-only
   * clauses out of a card's description in solo play (e.g. L021 "High-Profile
   * Client" — see getCardDescriptionForPlayerCount). Defaults to 2 (treated as
   * multiplayer / full text) so legacy callers that don't pass it render exactly
   * as before.
   */
  playerCount?: number;
}

// --- Newspaper palette (local — these are deliberately not theme tokens; the
// "newsprint" look is specific to this modal). ----------------------------------
const NEWS = {
  parchment: '#efe7d3',   // masthead background
  paper: '#fbf8ef',       // article background
  ink: '#1f1b16',         // body text / rules
  inkSoft: '#5b5346',     // dateline / secondary
  goodNews: '#1b6b3a',    // editorial green
  setback: '#8a2b22',     // muted brick (NOT the old alarm red)
  neutral: '#2a3b4d',     // ink-blue
};

const SERIF = '"Georgia", "Times New Roman", Times, serif';

type NewsTone = 'goodNews' | 'setback' | 'neutral';

/**
 * Decide the headline tone from the realized receipts so the modal doesn't
 * frame good news as a disaster (the core fb:1e76c24c complaint). Saved days,
 * money in, and resources gained read as good; lost time/money, revoked
 * approvals, and lost resources read as a setback. Mixed or nothing-changed →
 * neutral bulletin.
 */
function computeNewsTone(summary?: LifeEventEffectSummary[]): NewsTone {
  let good = false;
  let bad = false;
  for (const e of summary ?? []) {
    switch (e.kind) {
      case 'money':
        if ((e.amount ?? 0) > 0) good = true; else if ((e.amount ?? 0) < 0) bad = true;
        break;
      case 'time':
        // Negative time delta = days saved = good; positive = delay = bad; 0 = no change.
        if ((e.amount ?? 0) < 0) good = true; else if ((e.amount ?? 0) > 0) bad = true;
        break;
      case 'card_gained':
        good = true;
        break;
      case 'card_lost':
      case 'approval_revoke':
        bad = true;
        break;
      // duration_start / competing_reveal / leader_reveal carry no inherent tone.
    }
  }
  if (bad && !good) return 'setback';
  if (good && !bad) return 'goodNews';
  return 'neutral';
}

function toneAccent(tone: NewsTone): string {
  return tone === 'goodNews' ? NEWS.goodNews : tone === 'setback' ? NEWS.setback : NEWS.neutral;
}

function toneKicker(tone: NewsTone): string {
  return tone === 'goodNews'
    ? 'GOOD NEWS FOR THE PROJECT'
    : tone === 'setback'
      ? 'SETBACK ON THE PROJECT'
      : 'PROJECT BULLETIN';
}

/**
 * LifeEventModal — newspaper-style bulletin for an auto-applied life event.
 *
 * Visual contract:
 *   - "📰 THE DAILY PERMIT" masthead on parchment (not an alarm-red header).
 *   - A dateline + a tone-aware kicker so good news reads as good news.
 *   - Card name as the serif headline, description as the article body.
 *   - "The bottom line" receipts: what actually changed (the realized outcome),
 *     never the card's "roll a die" instructions.
 *   - Shake only on a genuine setback; good/neutral bulletins arrive calmly.
 */
export function LifeEventModal({ isOpen, data, onClose, playerCount = 2 }: LifeEventModalProps): JSX.Element | null {
  // Render closed ModalBase when data is missing so AnimatePresence can play
  // the exit animation (same pattern as DiceResultModal).
  if (!data) {
    return (
      <ModalBase isOpen={false} onClose={onClose} title="" emoji="" testId="life-event-modal">
        {null}
      </ModalBase>
    );
  }

  const { card, effectsSummary, dayLabel } = data;
  const hasEffects = !!(effectsSummary && effectsSummary.length > 0);
  const tone = computeNewsTone(effectsSummary);
  const accent = toneAccent(tone);
  // Solo-safe trim of known multiplayer-only clauses (e.g. L021's "all other
  // players' filing time increases" — nonsensical with no one else playing).
  const description = getCardDescriptionForPlayerCount(card, playerCount);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="THE DAILY PERMIT"
      emoji="📰"
      testId="life-event-modal"
      headerColor={NEWS.parchment}
      headerBorderColor={NEWS.ink}
      shake={tone === 'setback'}
      maxWidth="560px"
      footer={
        <button
          type="button"
          onClick={onClose}
          style={{
            ...modalButtonStyles.secondary,
            backgroundColor: NEWS.ink,
            color: colors.white,
            border: `1px solid ${NEWS.ink}`,
          }}
          data-testid="life-event-modal-dismiss"
        >
          Got it
        </button>
      }
    >
      <div
        data-testid="life-event-modal-body"
        style={{
          backgroundColor: NEWS.paper,
          margin: '-16px',
          padding: '20px 22px',
          fontFamily: SERIF,
          color: NEWS.ink,
        }}
      >
        {/* Dateline rule under the masthead */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            borderBottom: `2px solid ${NEWS.ink}`,
            paddingBottom: '6px',
            fontSize: '0.72rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: NEWS.inkSoft,
            fontFamily: SERIF,
          }}
        >
          <span>{dayLabel || 'Special Edition'}</span>
          <span>New York · Permits Desk</span>
        </div>

        {/* Tone-aware kicker — replaces the old red "major disturbance" banner */}
        <div
          data-testid="life-event-modal-kicker"
          style={{
            marginTop: '14px',
            marginBottom: '6px',
            fontSize: '0.74rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: accent,
            fontFamily: SERIF,
          }}
        >
          {toneKicker(tone)}
        </div>

        {/* Headline — the card name set as a newspaper headline */}
        <h3
          style={{
            margin: '0 0 10px 0',
            color: NEWS.ink,
            fontSize: '1.5rem',
            lineHeight: 1.15,
            fontWeight: 700,
            fontFamily: SERIF,
          }}
          data-testid="life-event-modal-card-name"
        >
          {card.card_name || 'Life Event'}
        </h3>

        {/* Article body — the narrative, set as a justified news column */}
        {description && (
          <p
            style={{
              margin: 0,
              color: NEWS.ink,
              fontSize: '1.02rem',
              lineHeight: 1.55,
              textAlign: 'justify',
              whiteSpace: 'pre-wrap',
              fontFamily: SERIF,
            }}
            data-testid="life-event-modal-card-description"
          >
            {description}
          </p>
        )}

        {/* "The bottom line" — the realized outcome, framed as a boxed sidebar.
            This is what the player should read instead of any "roll a die"
            instruction: it shows what actually changed (fb:7a2a2956). */}
        {hasEffects && (
          <div
            data-testid="life-event-modal-effects"
            style={{
              marginTop: '18px',
              padding: '12px 14px',
              backgroundColor: '#fffdf6',
              border: `1px solid ${NEWS.ink}`,
              borderLeft: `4px solid ${accent}`,
            }}
          >
            <div
              data-testid="life-event-modal-effects-heading"
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: NEWS.inkSoft,
                marginBottom: '8px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily: SERIF,
              }}
            >
              The bottom line
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
                      fontSize: '0.98rem',
                      color: NEWS.ink,
                      fontFamily: SERIF,
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
 * Icon for each life-event receipt kind. Money/time use the existing project
 * symbols (💰 / ⏱️) for consistency with the resource panel; approvals get a
 * stamp, card moves get a card face, duration effects get the clock-back to
 * signal "this isn't over yet."
 */
function lifeEventEffectIcon(kind: LifeEventEffectSummary['kind']): string {
  switch (kind) {
    case 'money': return '💰';
    case 'time': return '⏱️';
    case 'approval_revoke': return '🚫';
    case 'card_gained': return '📄';
    case 'card_lost': return '🗑️';
    case 'duration_start': return '🔁';
    case 'competing_reveal': return '🔍';
    case 'leader_reveal': return '🏆';
  }
}

export default LifeEventModal;
