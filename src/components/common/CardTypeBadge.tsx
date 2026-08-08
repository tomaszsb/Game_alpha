// src/components/common/CardTypeBadge.tsx
// Standardized card type badge using theme colors for consistent appearance

import React from 'react';
import { colors, theme } from '../../styles/theme';
import { getCardTypeName } from '../../utils/cardTypeNames';

export type CardType = 'W' | 'B' | 'E' | 'L' | 'I';

export interface CardTypeBadgeProps {
  /** Card type (W, B, E, L, I) */
  type: CardType | string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show the emoji */
  showEmoji?: boolean;
  /** Whether to show the label text */
  showLabel?: boolean;
  /** Custom className */
  className?: string;
  /** Whether this is a compact/pill style */
  variant?: 'badge' | 'pill' | 'tag';
}

/**
 * CardTypeBadge - Standardized badge for displaying card types
 *
 * Uses the theme.colors.game.cardTypes for consistent colors across the app.
 * Supports different sizes and variants for various contexts.
 */
export function CardTypeBadge({
  type,
  size = 'md',
  showEmoji = true,
  showLabel = true,
  className = '',
  variant = 'badge',
}: CardTypeBadgeProps): JSX.Element {
  // Get card type config from theme, with fallback for unknown types
  const cardTypeConfig = colors.game.cardTypes[type as CardType] || {
    primary: colors.secondary.main,
    bg: colors.secondary.light,
    border: colors.secondary.main,
    text: colors.text.primary,
    emoji: '?',
    label: type,
  };

  // Size configurations
  const sizeStyles = {
    sm: {
      fontSize: '12px',
      padding: variant === 'pill' ? '2px 8px' : '3px 6px',
      emojiSize: '12px',
      gap: '3px',
      minHeight: '20px',
    },
    md: {
      fontSize: '14px',
      padding: variant === 'pill' ? '4px 12px' : '4px 8px',
      emojiSize: '14px',
      gap: '4px',
      minHeight: '28px',
    },
    lg: {
      fontSize: '16px',
      padding: variant === 'pill' ? '6px 16px' : '6px 12px',
      emojiSize: '18px',
      gap: '6px',
      minHeight: '36px',
    },
  };

  const currentSize = sizeStyles[size];

  // Variant-specific border radius
  const borderRadius = {
    badge: theme.borderRadius.sm,
    pill: '999px',
    tag: '4px',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: currentSize.gap,
    padding: currentSize.padding,
    fontSize: currentSize.fontSize,
    fontWeight: 600,
    color: cardTypeConfig.text,
    backgroundColor: cardTypeConfig.bg,
    border: `2px solid ${cardTypeConfig.border}`,
    borderRadius: borderRadius[variant],
    minHeight: currentSize.minHeight,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  };

  const emojiStyle: React.CSSProperties = {
    fontSize: currentSize.emojiSize,
    lineHeight: 1,
  };

  // Build display content — label comes from the CSV-driven pipeline
  // (getCardTypeName), NOT cardTypeConfig.label. cardTypeConfig.label is
  // theme.ts's hardcoded fallback (still fine for colors/emoji, which
  // aren't reskin-sensitive), but using it for the visible label bypassed
  // CARD_TYPES.csv overrides — the same bug class fixed elsewhere in
  // v3.1.0 (audit 2026-08-03). This was latent: the badge's only caller
  // today renders with showLabel={false}, so the unsafe default was never
  // actually on screen.
  const displayLabel = showLabel ? getCardTypeName(type) : type;

  return (
    <span style={badgeStyle} className={className} data-card-type={type}>
      {showEmoji && <span style={emojiStyle}>{cardTypeConfig.emoji}</span>}
      {(showLabel || !showEmoji) && <span>{displayLabel}</span>}
    </span>
  );
}

/**
 * Get the card type colors from theme for use in other components
 */
export function getCardTypeColors(type: CardType | string) {
  return colors.game.cardTypes[type as CardType] || {
    primary: colors.secondary.main,
    bg: colors.secondary.light,
    border: colors.secondary.main,
    text: colors.text.primary,
    emoji: '?',
    label: type,
  };
}

/**
 * Get just the primary color for a card type (common use case)
 */
export function getCardTypePrimaryColor(type: CardType | string): string {
  const config = colors.game.cardTypes[type as CardType];
  return config?.primary || colors.secondary.main;
}

/**
 * Get the background color for a card type
 */
export function getCardTypeBgColor(type: CardType | string): string {
  const config = colors.game.cardTypes[type as CardType];
  return config?.bg || colors.secondary.light;
}

/**
 * Get the emoji for a card type
 */
export function getCardTypeEmoji(type: CardType | string): string {
  const config = colors.game.cardTypes[type as CardType];
  return config?.emoji || '?';
}

export default CardTypeBadge;
