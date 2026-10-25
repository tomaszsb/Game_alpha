import { describe, it, expect } from 'vitest';
import { clockDate, clockStartIso, clockText, todayIso } from '../../src/utils/gameClock';

describe('gameClock', () => {
  it('todayIso writes the local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
  it('adds a player\'s own days to the start date, across months and years', () => {
    expect(clockText(clockDate('2026-10-25', 0))).toBe('2026 OCT 25');
    expect(clockText(clockDate('2026-10-25', 10))).toBe('2026 NOV 04');
    expect(clockText(clockDate('2026-10-25', 68))).toBe('2027 JAN 01');
    expect(clockText(clockDate('2028-02-28', 1))).toBe('2028 FEB 29'); // leap year
  });
  it('two players on different days read different dates from one start', () => {
    expect(clockText(clockDate('2026-10-25', 30))).not.toBe(clockText(clockDate('2026-10-25', 90)));
  });
  it('treats missing, negative or fractional days as whole days from zero', () => {
    expect(clockText(clockDate('2026-10-25', -5))).toBe('2026 OCT 25');
    expect(clockText(clockDate('2026-10-25', 2.9))).toBe('2026 OCT 27');
    expect(clockText(clockDate('2026-10-25', NaN))).toBe('2026 OCT 25');
  });
  it('start date: the stored one, else the day gameStartTime says, else today', () => {
    expect(clockStartIso({ gameStartDate: '2026-03-02' })).toBe('2026-03-02');
    expect(clockStartIso({ gameStartTime: new Date(2025, 0, 9, 12) })).toBe('2025-01-09');
    expect(clockStartIso({ gameStartTime: new Date(2025, 0, 9, 12).toISOString() })).toBe('2025-01-09');
    expect(clockStartIso({}, new Date(2026, 5, 1))).toBe('2026-06-01');
    expect(clockStartIso({ gameStartDate: 'junk' }, new Date(2026, 5, 1))).toBe('2026-06-01');
  });
});
