import { colors } from '../styles/theme';
import { Card, CardTypeLabel } from '../types/DataTypes';

/**
 * 2026-07-16: CSV-portability lift — reskin hook. Populated once at app
 * startup from CARD_TYPES.csv (see `configureCardTypeLabels`). A card type
 * present here overrides theme.ts's hardcoded label; colors/emoji stay in
 * theme.ts unchanged (those aren't real-world jargon, no reskin need there).
 */
const CARD_TYPE_LABEL_OVERRIDES = new Map<string, string>();

/**
 * Call once at app startup (after GAME_CONFIG/CARD_TYPES load) to let a
 * reskin CSV replace theme.ts's hardcoded card-type labels ("Work Package",
 * "Bank Loan", etc.) without touching code. A CSV without CARD_TYPES.csv is
 * a no-op — today's theme.ts defaults stand.
 */
export function configureCardTypeLabels(labels: CardTypeLabel[]): void {
  for (const { card_type, label } of labels) {
    if (card_type && label) CARD_TYPE_LABEL_OVERRIDES.set(card_type, label);
  }
}

/**
 * Single source of truth for player-facing card-type names. Reads the CSV
 * override first, falling back to theme.cardTypes[type].label, and applies
 * simple 's' pluralization. Voice rule: never surface the letter codes
 * (W/B/E/L/I) or the word "card".
 */
export function getCardTypeName(type: string, count: number = 1): string {
  const label = CARD_TYPE_LABEL_OVERRIDES.get(type) ?? colors.game.cardTypes[type]?.label ?? type;
  return count === 1 ? label : `${label}s`;
}

/**
 * Title to show in a card modal/detail view. All 176 Work Package cards have
 * `card_name` authored identical to `description` (verbatim, not a summary),
 * so using card_name as the title just repeats the description a player
 * reads moments later in the same modal (fb:995028c7 — "the title... not the
 * full description repeated again later"). For W cards, the trade
 * (`work_type_restriction`, e.g. "Plumbing", "General Construction") is the
 * real short title; every other card type already has a distinct card_name.
 */
export function getCardDisplayTitle(card: Card): string {
  if (card.card_type === 'W' && card.work_type_restriction) {
    return card.work_type_restriction;
  }
  return card.card_name;
}

/**
 * Short "what happens if you activate this" summary — e.g. "-4 days" or
 * "-4 days · -$500" — for use next to a bare "Activate" button (fb:17cc481c:
 * "maybe activate the button can say + or - x days + or - x $ instead of
 * Activate?"). Mirrors the sign/precedence rules PlayerCardDetailV2's "Key
 * facts" list already uses (cost as cost; money_effect only when there's no
 * separate cost; tick_modifier negative = saves days). Returns null when the
 * card carries no numeric time/money effect to summarize.
 *
 * fb:feedback-1782842888855-aff0e337 — an Expeditor's day-reduction is a flat
 * subtraction from the player's running `timeSpent` total, which floors at 0
 * (ResourceService.updateResources). Play a "-5 days" card at timeSpent=2 and
 * only 2 of the 5 days actually land — the rest is silently wasted. Pass the
 * player's current timeSpent so the summary states the REAL amount that would
 * apply ("-2 of 5 days") instead of the card's face value. Decided as a soft
 * warning (still playable), not a hard block, applying uniformly to every
 * negative-tick card regardless of other bundled effects (design call, made
 * 2026-07-08 — maintainer chose "some benefit is still worth seeing honestly"
 * over gating the button).
 */
export function getCardEffectSummary(card: Card, playerTimeSpent?: number): string | null {
  const parts: string[] = [];
  const tick = card.tick_modifier ? parseInt(card.tick_modifier, 10) : undefined;
  if (tick != null && !isNaN(tick) && tick !== 0) {
    // No player context passed → show the card's face value (unchanged,
    // backward-compatible default). Only apply the partial-benefit warning
    // when a caller explicitly supplies the player's elapsed time.
    if (tick < 0 && playerTimeSpent != null && playerTimeSpent < Math.abs(tick)) {
      parts.push(`-${playerTimeSpent} of ${Math.abs(tick)} day${Math.abs(tick) === 1 ? '' : 's'}`);
    } else {
      parts.push(`${tick < 0 ? '-' : '+'}${Math.abs(tick)} day${Math.abs(tick) === 1 ? '' : 's'}`);
    }
  }
  if (card.cost != null && !isNaN(card.cost) && card.cost > 0) {
    parts.push(`-$${card.cost.toLocaleString()}`);
  } else if (card.money_effect) {
    const m = parseInt(card.money_effect, 10);
    if (!isNaN(m) && m !== 0) {
      parts.push(`${m < 0 ? '-' : '+'}$${Math.abs(m).toLocaleString()}`);
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
