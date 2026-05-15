import { colors } from '../styles/theme';

/**
 * Single source of truth for player-facing card-type names. Reads from
 * theme.cardTypes[type].label and applies simple 's' pluralization. Voice
 * rule: never surface the letter codes (W/B/E/L/I) or the word "card".
 */
export function getCardTypeName(type: string, count: number = 1): string {
  const label = colors.game.cardTypes[type]?.label ?? type;
  return count === 1 ? label : `${label}s`;
}
