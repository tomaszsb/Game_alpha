import { describe, it, expect } from 'vitest';
import {
  resolveTargetDate,
  resolveWhen,
  buildICSForDate,
  buildICS,
} from '../../src/playtest/generateICS';

describe('generateICS', () => {
  describe('resolveTargetDate', () => {
    it('tonight is 7pm today, or ~1h out if already past 7pm', () => {
      const now = new Date();
      const d = resolveTargetDate('tonight');
      expect(d.getTime()).toBeGreaterThan(now.getTime());
      const sevenPm = now.getHours() < 19;
      if (sevenPm) {
        expect(d.getHours()).toBe(19);
        expect(d.getMinutes()).toBe(0);
      } else {
        // bumped to now + 1h
        expect(d.getTime() - now.getTime()).toBeLessThanOrEqual(61 * 60 * 1000);
      }
    });

    it('tomorrow-evening is 7pm and in the future', () => {
      const d = resolveTargetDate('tomorrow-evening');
      expect(d.getHours()).toBe(19);
      expect(d.getMinutes()).toBe(0);
      expect(d.getTime()).toBeGreaterThan(Date.now());
    });

    it('saturday-afternoon lands on a Saturday at 2pm', () => {
      const d = resolveTargetDate('saturday-afternoon');
      expect(d.getDay()).toBe(6); // Saturday
      expect(d.getHours()).toBe(14);
      expect(d.getTime()).toBeGreaterThan(Date.now());
    });

    it('saturday-afternoon is never "today" even if today is Saturday', () => {
      const d = resolveTargetDate('saturday-afternoon');
      // Must be strictly after today's date.
      const startOfTomorrow = new Date();
      startOfTomorrow.setHours(0, 0, 0, 0);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      expect(d.getTime()).toBeGreaterThanOrEqual(startOfTomorrow.getTime());
    });

    it('next-weekend is a Saturday more than a week out', () => {
      const d = resolveTargetDate('next-weekend');
      expect(d.getDay()).toBe(6);
      expect(d.getTime() - Date.now()).toBeGreaterThan(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('resolveWhen', () => {
    it('maps a preset to its human label + resolved date', () => {
      const { date, label } = resolveWhen('tomorrow-evening');
      expect(label).toBe('tomorrow evening');
      expect(date.getHours()).toBe(19);
    });

    it('passes a custom date straight through with a formatted label', () => {
      const custom = new Date('2026-09-10T22:00:00Z');
      const { date, label } = resolveWhen({ custom });
      expect(date.getTime()).toBe(custom.getTime());
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  describe('buildICSForDate', () => {
    const fixed = new Date('2026-08-15T18:30:00Z');
    const ics = buildICSForDate(fixed);

    it('is a well-formed VCALENDAR/VEVENT with CRLF line endings', () => {
      expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('END:VEVENT');
      expect(ics.endsWith('END:VCALENDAR')).toBe(true);
      expect(ics).toContain('\r\n');
    });

    it('encodes DTSTART in UTC compact form and DTEND one hour later', () => {
      expect(ics).toContain('DTSTART:20260815T183000Z');
      expect(ics).toContain('DTEND:20260815T193000Z');
    });

    it('escapes commas in the description per RFC 5545', () => {
      expect(ics).toContain('PC\\, TV\\, or tablet');
    });

    it('carries a URL line', () => {
      expect(ics).toMatch(/URL:https:\/\/game\.unravelcodes\.com\/challenge/);
    });
  });

  describe('buildICS (preset shortcut)', () => {
    it('produces the same shape as the date-based builder', () => {
      const ics = buildICS('tonight');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Play Unravel Codes');
    });
  });
});
