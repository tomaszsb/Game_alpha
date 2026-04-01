/**
 * Reusable parsing utilities for extracting structured data from CSV text values.
 * Centralizes regex patterns previously scattered across EffectFactory, FinancialEffectHandler, and CardService.
 */

import type { CardType } from '../types/DataTypes';

/**
 * Extract a numeric value from a string, stripping all non-digit/minus characters.
 * Replaces the `/[^\d-]/g` pattern used throughout EffectFactory.
 */
export function extractNumeric(value: string | number): number {
  if (typeof value === 'number') return value;
  const cleaned = value.replace(/[^\d-]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract a positive numeric value (no negatives) from a string.
 * Replaces the `/[^\d]/g` pattern used in parseLoanAmount, parseTurnSkip, parseDuration.
 */
export function extractPositiveNumeric(value: string): number {
  const cleaned = value.replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract a percentage value from a string like "8%" or "10% of current".
 * Returns the numeric percentage (e.g., 8 for "8%") or null if no percentage found.
 */
export function extractPercentage(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)%/);
  if (!match) return null;
  const pct = parseFloat(match[1]);
  return isNaN(pct) ? null : pct;
}

/**
 * Parse a card type from text like "W Cards", "B Card", "E Cards".
 * Returns the single-letter CardType or null.
 */
export function parseCardTypeFromText(text: string): CardType | null {
  const match = text.match(/^([WBELI])\s*Cards?$/i);
  if (!match) return null;
  return match[1].toUpperCase() as CardType;
}

/**
 * Parse a card action and count from text like "Draw 2", "Remove 1", "Replace 3".
 * Returns { action, count } or null.
 */
export function parseCardActionFromText(text: string): { action: string; count: number } | null {
  const actionMatch = text.match(/^(Remove|Draw|Replace)\s+(\d+)/i);
  if (actionMatch) {
    return {
      action: actionMatch[1].toLowerCase(),
      count: parseInt(actionMatch[2], 10)
    };
  }
  // Fallback: just extract any number
  const countMatch = text.match(/(\d+)/);
  if (countMatch) {
    return {
      action: 'draw',
      count: parseInt(countMatch[1], 10)
    };
  }
  return null;
}

/**
 * Parse a card draw format like "2 W", "1 B", "3 E" or "2W".
 * Returns { cardType, count } or null.
 */
export function parseCardDrawFormat(text: string): { cardType: CardType; count: number } | null {
  const match = text.trim().match(/(\d+)\s*([WBEILS]?)/i);
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const cardType = (match[2] || 'W').toUpperCase();
  if (!['W', 'B', 'E', 'I', 'L', 'S'].includes(cardType)) return null;
  return { cardType: cardType as CardType, count };
}

/**
 * Parse a fee amount from a description string.
 * Handles percentage fees ("2%"), fixed dollar fees ("$50,000"), and tiered structures.
 * Returns { type, value } or null for dice-based/unparseable fees.
 */
export function parseFeeFromDescription(description: string): { type: 'percentage' | 'fixed'; value: number } | null {
  const desc = description.toLowerCase();

  // Percentage fee
  const pct = extractPercentage(description);
  if (pct !== null) {
    return { type: 'percentage', value: pct };
  }

  // Fixed dollar amount (e.g., "$50,000" or "50000")
  const amountMatch = desc.match(/\$?([\d,]+)/);
  if (amountMatch) {
    const amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(amount) && amount > 0) {
      return { type: 'fixed', value: amount };
    }
  }

  return null;
}

/**
 * Determine fee type from a fee description string.
 * Returns 'LOAN_PERCENTAGE', 'DICE_BASED', or 'FIXED'.
 */
export function determineFeeType(feeDescription: string): 'LOAN_PERCENTAGE' | 'FIXED' | 'DICE_BASED' {
  const desc = feeDescription.toLowerCase();
  if (desc.includes('dice') || desc.includes('roll')) {
    return 'DICE_BASED';
  } else if (desc.includes('%')) {
    return 'LOAN_PERCENTAGE';
  }
  return 'FIXED';
}
