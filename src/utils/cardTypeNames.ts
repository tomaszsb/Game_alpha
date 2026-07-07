import { colors } from '../styles/theme';
import { Card } from '../types/DataTypes';

/**
 * Single source of truth for player-facing card-type names. Reads from
 * theme.cardTypes[type].label and applies simple 's' pluralization. Voice
 * rule: never surface the letter codes (W/B/E/L/I) or the word "card".
 */
export function getCardTypeName(type: string, count: number = 1): string {
  const label = colors.game.cardTypes[type]?.label ?? type;
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
 */
export function getCardEffectSummary(card: Card): string | null {
  const parts: string[] = [];
  const tick = card.tick_modifier ? parseInt(card.tick_modifier, 10) : undefined;
  if (tick != null && !isNaN(tick) && tick !== 0) {
    parts.push(`${tick < 0 ? '-' : '+'}${Math.abs(tick)} day${Math.abs(tick) === 1 ? '' : 's'}`);
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
