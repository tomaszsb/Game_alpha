import { describe, it, expect } from 'vitest';
import {
  extractNumeric,
  extractPositiveNumeric,
  extractPercentage,
  parseCardTypeFromText,
  parseCardActionFromText,
  parseCardDrawFormat,
  parseFeeFromDescription,
  determineFeeType,
} from '../../src/utils/parseUtils';

describe('parseUtils', () => {
  describe('extractNumeric', () => {
    it('extracts number from clean numeric string', () => {
      expect(extractNumeric('50000')).toBe(50000);
    });

    it('extracts number from dollar-formatted string', () => {
      expect(extractNumeric('$50,000')).toBe(50000);
    });

    it('handles negative values', () => {
      expect(extractNumeric('-25000')).toBe(-25000);
    });

    it('extracts number from text with units', () => {
      expect(extractNumeric('+2 weeks')).toBe(2);
    });

    it('returns 0 for non-numeric strings', () => {
      expect(extractNumeric('no change')).toBe(0);
    });

    it('passes through number type directly', () => {
      expect(extractNumeric(42)).toBe(42);
    });

    it('handles empty string', () => {
      expect(extractNumeric('')).toBe(0);
    });
  });

  describe('extractPositiveNumeric', () => {
    it('extracts positive number', () => {
      expect(extractPositiveNumeric('50000')).toBe(50000);
    });

    it('strips negative sign', () => {
      expect(extractPositiveNumeric('-25000')).toBe(25000);
    });

    it('extracts from text', () => {
      expect(extractPositiveNumeric('skip 2 turns')).toBe(2);
    });

    it('returns 0 for no digits', () => {
      expect(extractPositiveNumeric('permanent')).toBe(0);
    });
  });

  describe('extractPercentage', () => {
    it('extracts integer percentage', () => {
      expect(extractPercentage('8%')).toBe(8);
    });

    it('extracts percentage from longer text', () => {
      expect(extractPercentage('10% of current')).toBe(10);
    });

    it('extracts decimal percentage', () => {
      expect(extractPercentage('2.5%')).toBe(2.5);
    });

    it('returns null for no percentage', () => {
      expect(extractPercentage('$50,000')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractPercentage('')).toBeNull();
    });
  });

  describe('parseCardTypeFromText', () => {
    it('parses "W Cards"', () => {
      expect(parseCardTypeFromText('W Cards')).toBe('W');
    });

    it('parses "B Card" (singular)', () => {
      expect(parseCardTypeFromText('B Card')).toBe('B');
    });

    it('parses lowercase "e cards"', () => {
      expect(parseCardTypeFromText('e cards')).toBe('E');
    });

    it('parses all valid types', () => {
      expect(parseCardTypeFromText('I Cards')).toBe('I');
      expect(parseCardTypeFromText('L Cards')).toBe('L');
    });

    it('returns null for non-card text', () => {
      expect(parseCardTypeFromText('money')).toBeNull();
    });

    it('returns null for partial match', () => {
      expect(parseCardTypeFromText('Draw W Cards')).toBeNull();
    });
  });

  describe('parseCardActionFromText', () => {
    it('parses "Draw 2"', () => {
      expect(parseCardActionFromText('Draw 2')).toEqual({ action: 'draw', count: 2 });
    });

    it('parses "Remove 1"', () => {
      expect(parseCardActionFromText('Remove 1')).toEqual({ action: 'remove', count: 1 });
    });

    it('parses "Replace 3"', () => {
      expect(parseCardActionFromText('Replace 3')).toEqual({ action: 'replace', count: 3 });
    });

    it('parses case-insensitive', () => {
      expect(parseCardActionFromText('DRAW 5')).toEqual({ action: 'draw', count: 5 });
    });

    it('falls back to extracting just a count', () => {
      expect(parseCardActionFromText('3')).toEqual({ action: 'draw', count: 3 });
    });

    it('returns null for no number', () => {
      expect(parseCardActionFromText('No change')).toBeNull();
    });
  });

  describe('parseCardDrawFormat', () => {
    it('parses "2 W"', () => {
      expect(parseCardDrawFormat('2 W')).toEqual({ cardType: 'W', count: 2 });
    });

    it('parses "1 B"', () => {
      expect(parseCardDrawFormat('1 B')).toEqual({ cardType: 'B', count: 1 });
    });

    it('parses without space "3E"', () => {
      expect(parseCardDrawFormat('3E')).toEqual({ cardType: 'E', count: 3 });
    });

    it('defaults to W when no type specified', () => {
      expect(parseCardDrawFormat('2')).toEqual({ cardType: 'W', count: 2 });
    });

    it('returns null for empty string', () => {
      expect(parseCardDrawFormat('')).toBeNull();
    });

    it('parses all valid types', () => {
      expect(parseCardDrawFormat('1 I')).toEqual({ cardType: 'I', count: 1 });
      expect(parseCardDrawFormat('1 L')).toEqual({ cardType: 'L', count: 1 });
    });
  });

  describe('parseFeeFromDescription', () => {
    it('parses percentage fee', () => {
      expect(parseFeeFromDescription('2% of loan')).toEqual({ type: 'percentage', value: 2 });
    });

    it('parses fixed dollar fee', () => {
      expect(parseFeeFromDescription('$50,000')).toEqual({ type: 'fixed', value: 50000 });
    });

    it('parses fixed fee without dollar sign', () => {
      expect(parseFeeFromDescription('50000')).toEqual({ type: 'fixed', value: 50000 });
    });

    it('returns null for unparseable text', () => {
      expect(parseFeeFromDescription('roll dice')).toBeNull();
    });
  });

  describe('determineFeeType', () => {
    it('returns DICE_BASED for dice descriptions', () => {
      expect(determineFeeType('Roll dice for fee')).toBe('DICE_BASED');
    });

    it('returns DICE_BASED for roll descriptions', () => {
      expect(determineFeeType('roll to determine')).toBe('DICE_BASED');
    });

    it('returns LOAN_PERCENTAGE for percentage descriptions', () => {
      expect(determineFeeType('2% of loan')).toBe('LOAN_PERCENTAGE');
    });

    it('returns FIXED for other descriptions', () => {
      expect(determineFeeType('$50,000')).toBe('FIXED');
    });

    it('returns FIXED for empty string', () => {
      expect(determineFeeType('')).toBe('FIXED');
    });
  });
});
