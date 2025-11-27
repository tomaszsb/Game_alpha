/**
 * Formatting utilities for money, time, and other game values
 * Provides consistent formatting across the entire application
 */
import { colors } from '../styles/theme';

export interface FormatOptions {
  showCurrency?: boolean;
  showSign?: boolean;
  compact?: boolean;
  precision?: number;
}

export class FormatUtils {
  
  /**
   * Formats money amounts with proper currency symbols and abbreviations
   * Examples: $1,500,000 → $1.5M, $50,000 → $50K, $500 → $500
   */
  static formatMoney(amount: number, options: FormatOptions = {}): string {
    const {
      showCurrency = true,
      showSign = false,
      compact = true,
      precision = 1
    } = options;

    // Handle null/undefined/NaN
    if (amount == null || isNaN(amount)) {
      return showCurrency ? '$0' : '0';
    }

    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : (showSign && amount > 0 ? '+' : '');
    const currency = showCurrency ? '$' : '';
    
    let formattedAmount: string;
    
    if (!compact || absAmount < 1000) {
      // No abbreviation for amounts under $1,000
      formattedAmount = absAmount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } else if (absAmount < 1000000) {
      // Thousands: $50K
      const thousands = Math.round(absAmount / 1000 * Math.pow(10, precision)) / Math.pow(10, precision);
      formattedAmount = thousands.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
      }) + 'K';
    } else if (absAmount < 1000000000) {
      // Millions: $1.5M
      const millions = Math.round(absAmount / 1000000 * Math.pow(10, precision)) / Math.pow(10, precision);
      formattedAmount = millions.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
      }) + 'M';
    } else {
      // Billions: $2.1B
      const billions = Math.round(absAmount / 1000000000 * Math.pow(10, precision)) / Math.pow(10, precision);
      formattedAmount = billions.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision
      }) + 'B';
    }

    return `${sign}${currency}${formattedAmount}`;
  }

  /**
   * Formats time duration in days with proper pluralization
   * Examples: 0 → "0 days", 1 → "1 day", 15 → "15 days", 365 → "1 year"
   */
  static formatTime(days: number, options: { showUnit?: boolean; compact?: boolean } = {}): string {
    const { showUnit = true, compact = false } = options;

    // Handle null/undefined/NaN
    if (days == null || isNaN(days)) {
      return showUnit ? '0 days' : '0';
    }

    const roundedDays = Math.round(days);

    if (!showUnit) {
      return roundedDays.toString();
    }

    if (compact && roundedDays >= 365) {
      // Show in years for very long projects
      const years = Math.round(roundedDays / 365 * 10) / 10; // Round to 1 decimal
      return years === 1 ? '1 year' : `${years} years`;
    }

    if (compact && roundedDays >= 30) {
      // Show in months for medium projects  
      const months = Math.round(roundedDays / 30);
      return months === 1 ? '1 month' : `${months} months`;
    }

    // Default: show in days
    if (roundedDays === 0) {
      return '0 days';
    } else if (roundedDays === 1) {
      return '1 day';
    } else {
      return `${roundedDays} days`;
    }
  }

  /**
   * Formats percentage values
   * Examples: 0.15 → "15%", 0.05 → "5%", 1.25 → "125%"
   */
  static formatPercentage(value: number, precision: number = 0): string {
    if (value == null || isNaN(value)) {
      return '0%';
    }
    
    const percentage = value * 100;
    return `${percentage.toFixed(precision)}%`;
  }

  /**
   * Parses money strings back to numbers
   * Examples: "$1.5M" → 1500000, "$50K" → 50000, "$500" → 500
   */
  static parseMoney(moneyString: string): number {
    if (!moneyString || typeof moneyString !== 'string') {
      return 0;
    }

    // Remove currency symbols and whitespace
    let cleaned = moneyString.replace(/[$,\s]/g, '');
    
    // Handle negative values
    const isNegative = cleaned.includes('-');
    cleaned = cleaned.replace(/-/g, '');
    
    // Extract the multiplier
    let multiplier = 1;
    if (cleaned.includes('K')) {
      multiplier = 1000;
      cleaned = cleaned.replace('K', '');
    } else if (cleaned.includes('M')) {
      multiplier = 1000000;
      cleaned = cleaned.replace('M', '');
    } else if (cleaned.includes('B')) {
      multiplier = 1000000000;
      cleaned = cleaned.replace('B', '');
    }
    
    const baseAmount = parseFloat(cleaned) || 0;
    const result = baseAmount * multiplier;
    
    return isNegative ? -result : result;
  }

  /**
   * Formats card costs for display
   */
  static formatCardCost(cost: number): string {
    if (cost === 0) {
      return 'Free';
    }
    return FormatUtils.formatMoney(cost, { compact: true });
  }

  /**
   * Formats resource changes with appropriate +/- signs and colors
   */
  static formatResourceChange(amount: number, type: 'money' | 'time'): {
    text: string;
    color: string;
    className: string;
  } {
    if (amount === 0) {
      return {
        text: type === 'money' ? '$0' : '0 days',
        color: colors.text.secondary,
        className: 'resource-neutral'
      };
    }

    const isPositive = amount > 0;
    
    let text: string;
    if (type === 'money') {
      text = FormatUtils.formatMoney(amount, { showSign: true });
    } else {
      // For time, we need to manually add the sign since formatTime doesn't have showSign
      const timeText = FormatUtils.formatTime(Math.abs(amount));
      const sign = amount > 0 ? '+' : '-';
      text = amount === 0 ? timeText : `${sign}${timeText}`;
    }
    
    return {
      text,
      color: isPositive ? colors.success.main : colors.danger.main,
      className: isPositive ? 'resource-gain' : 'resource-loss'
    };
  }

  /**
   * Formats project scope values for W cards
   */
  static formatProjectScope(cost: number): string {
    if (cost === 0) {
      return 'Scope Definition';
    }
    return `Est. ${FormatUtils.formatMoney(cost)} scope`;
  }

  /**
   * Formats large numbers with appropriate abbreviations
   */
  static formatNumber(value: number, compact: boolean = true): string {
    if (value == null || isNaN(value)) {
      return '0';
    }

    if (!compact || Math.abs(value) < 1000) {
      return value.toLocaleString('en-US');
    }

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (absValue < 1000000) {
      return `${sign}${(absValue / 1000).toFixed(1)}K`;
    } else if (absValue < 1000000000) {
      return `${sign}${(absValue / 1000000).toFixed(1)}M`;
    } else {
      return `${sign}${(absValue / 1000000000).toFixed(1)}B`;
    }
  }

  /**
   * Formats game duration (elapsed time since game start)
   */
  static formatGameDuration(milliseconds: number): string {
    if (!milliseconds || milliseconds < 0) {
      return '00:00:00';
    }

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Formats turn numbers with ordinal suffixes
   */
  static formatTurnNumber(turn: number): string {
    if (turn <= 0) {
      return 'Setup';
    }

    const suffix = FormatUtils.getOrdinalSuffix(turn);
    return `${turn}${suffix}`;
  }

  /**
   * Gets ordinal suffix for numbers (1st, 2nd, 3rd, 4th, etc.)
   */
  private static getOrdinalSuffix(n: number): string {
    const lastDigit = n % 10;
    const lastTwoDigits = n % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }
    
    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
}