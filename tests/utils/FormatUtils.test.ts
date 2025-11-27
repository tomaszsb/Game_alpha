import { FormatUtils } from '../../src/utils/FormatUtils';

describe('FormatUtils', () => {
  describe('formatMoney', () => {
    it('should format basic amounts correctly', () => {
      expect(FormatUtils.formatMoney(0)).toBe('$0');
      expect(FormatUtils.formatMoney(500)).toBe('$500');
      expect(FormatUtils.formatMoney(1500)).toBe('$1.5K');
      expect(FormatUtils.formatMoney(1500000)).toBe('$1.5M');
      expect(FormatUtils.formatMoney(2100000000)).toBe('$2.1B');
    });

    it('should handle negative amounts', () => {
      expect(FormatUtils.formatMoney(-50000)).toBe('-$50K');
      expect(FormatUtils.formatMoney(-1500000)).toBe('-$1.5M');
    });

    it('should respect showSign option', () => {
      expect(FormatUtils.formatMoney(50000, { showSign: true })).toBe('+$50K');
      expect(FormatUtils.formatMoney(-50000, { showSign: true })).toBe('-$50K');
    });

    it('should work without currency symbol', () => {
      expect(FormatUtils.formatMoney(1500000, { showCurrency: false })).toBe('1.5M');
    });

    it('should work in non-compact mode', () => {
      expect(FormatUtils.formatMoney(1500000, { compact: false })).toBe('$1,500,000');
    });

    it('should handle null/undefined/NaN', () => {
      expect(FormatUtils.formatMoney(null as any)).toBe('$0');
      expect(FormatUtils.formatMoney(undefined as any)).toBe('$0');
      expect(FormatUtils.formatMoney(NaN)).toBe('$0');
    });
  });

  describe('formatTime', () => {
    it('should format days correctly with proper pluralization', () => {
      expect(FormatUtils.formatTime(0)).toBe('0 days');
      expect(FormatUtils.formatTime(1)).toBe('1 day');
      expect(FormatUtils.formatTime(2)).toBe('2 days');
      expect(FormatUtils.formatTime(15)).toBe('15 days');
    });

    it('should work without unit', () => {
      expect(FormatUtils.formatTime(15, { showUnit: false })).toBe('15');
    });

    it('should format in compact mode for longer durations', () => {
      expect(FormatUtils.formatTime(365, { compact: true })).toBe('1 year');
      expect(FormatUtils.formatTime(730, { compact: true })).toBe('2 years');
      expect(FormatUtils.formatTime(60, { compact: true })).toBe('2 months');
      expect(FormatUtils.formatTime(30, { compact: true })).toBe('1 month');
    });

    it('should handle null/undefined/NaN', () => {
      expect(FormatUtils.formatTime(null as any)).toBe('0 days');
      expect(FormatUtils.formatTime(undefined as any)).toBe('0 days');
      expect(FormatUtils.formatTime(NaN)).toBe('0 days');
    });
  });

  describe('parseMoney', () => {
    it('should parse basic money strings', () => {
      expect(FormatUtils.parseMoney('$500')).toBe(500);
      expect(FormatUtils.parseMoney('$1,500')).toBe(1500);
      expect(FormatUtils.parseMoney('500')).toBe(500);
    });

    it('should parse abbreviated amounts', () => {
      expect(FormatUtils.parseMoney('$1.5K')).toBe(1500);
      expect(FormatUtils.parseMoney('$2M')).toBe(2000000);
      expect(FormatUtils.parseMoney('$1.5M')).toBe(1500000);
      expect(FormatUtils.parseMoney('$2.1B')).toBe(2100000000);
    });

    it('should handle negative amounts', () => {
      expect(FormatUtils.parseMoney('-$50K')).toBe(-50000);
      expect(FormatUtils.parseMoney('$-50K')).toBe(-50000);
    });

    it('should handle invalid inputs', () => {
      expect(FormatUtils.parseMoney('')).toBe(0);
      expect(FormatUtils.parseMoney(null as any)).toBe(0);
      expect(FormatUtils.parseMoney(undefined as any)).toBe(0);
      expect(FormatUtils.parseMoney('invalid')).toBe(0);
    });
  });

  describe('formatResourceChange', () => {
    it('should format money changes with correct colors', () => {
      const gain = FormatUtils.formatResourceChange(50000, 'money');
      expect(gain.text).toBe('+$50K');
      expect(gain.color).toBe('#28a745');
      expect(gain.className).toBe('resource-gain');

      const loss = FormatUtils.formatResourceChange(-25000, 'money');
      expect(loss.text).toBe('-$25K');
      expect(loss.color).toBe('#dc3545');
      expect(loss.className).toBe('resource-loss');
    });

    it('should format time changes with correct colors', () => {
      const timeGain = FormatUtils.formatResourceChange(5, 'time');
      expect(timeGain.text).toBe('+5 days');
      expect(timeGain.color).toBe('#28a745');

      const timeLoss = FormatUtils.formatResourceChange(-3, 'time');
      expect(timeLoss.text).toBe('-3 days');
      expect(timeLoss.color).toBe('#dc3545');
    });

    it('should handle zero changes', () => {
      const neutral = FormatUtils.formatResourceChange(0, 'money');
      expect(neutral.text).toBe('$0');
      expect(neutral.color).toBe('#6c757d'); // Updated to match theme colors.secondary.main
      expect(neutral.className).toBe('resource-neutral');
    });
  });

  describe('formatCardCost', () => {
    it('should format free cards', () => {
      expect(FormatUtils.formatCardCost(0)).toBe('Free');
    });

    it('should format paid cards', () => {
      expect(FormatUtils.formatCardCost(50000)).toBe('$50K');
      expect(FormatUtils.formatCardCost(1500000)).toBe('$1.5M');
    });
  });

  describe('formatTurnNumber', () => {
    it('should format turn numbers with ordinals', () => {
      expect(FormatUtils.formatTurnNumber(0)).toBe('Setup');
      expect(FormatUtils.formatTurnNumber(1)).toBe('1st');
      expect(FormatUtils.formatTurnNumber(2)).toBe('2nd');
      expect(FormatUtils.formatTurnNumber(3)).toBe('3rd');
      expect(FormatUtils.formatTurnNumber(4)).toBe('4th');
      expect(FormatUtils.formatTurnNumber(11)).toBe('11th');
      expect(FormatUtils.formatTurnNumber(21)).toBe('21st');
      expect(FormatUtils.formatTurnNumber(22)).toBe('22nd');
      expect(FormatUtils.formatTurnNumber(23)).toBe('23rd');
    });
  });

  describe('formatGameDuration', () => {
    it('should format game duration correctly', () => {
      expect(FormatUtils.formatGameDuration(0)).toBe('00:00:00');
      expect(FormatUtils.formatGameDuration(65000)).toBe('00:01:05'); // 1 min 5 sec
      expect(FormatUtils.formatGameDuration(3665000)).toBe('01:01:05'); // 1 hour 1 min 5 sec
    });

    it('should handle invalid durations', () => {
      expect(FormatUtils.formatGameDuration(-1000)).toBe('00:00:00');
      expect(FormatUtils.formatGameDuration(null as any)).toBe('00:00:00');
    });
  });
});