// tests/regression/NumbersSectionCardTypes.test.ts
//
// v3.2.62 (fb:adad1561, Tom 2026-09-17). "What's affecting you" was folded into
// the numbers: each card family is shown on the Money, Scope or Expeditors page,
// or under History. WHERE is authored in CARD_TYPES.csv (numbers_section), not
// compiled as card-type letters, so a reskin files its own families.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataService, BUILT_IN_NUMBERS_SECTIONS } from '../../src/services/DataService';

const SHIPPED_CSV = readFileSync(join(process.cwd(), 'public/data/CLEAN_FILES/CARD_TYPES.csv'), 'utf-8');

const loadCardTypes = (csv: string): DataService => {
  const ds = new DataService();
  (ds as any).cardTypeLabels = (ds as any).parseCardTypeLabelsCsv(csv);
  return ds;
};

describe('numbers_section comes from CARD_TYPES.csv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shipped data: work packages → scope, loans and investments → money, expeditors → expeditors, life events → history', () => {
    const ds = loadCardTypes(SHIPPED_CSV);
    expect(['W', 'B', 'E', 'L', 'I'].map(t => ds.getNumbersSection(t))).toEqual(['scope', 'money', 'expeditors', 'history', 'money']);
  });

  it('a reskin CSV decides where its own families go — no code change', () => {
    const ds = loadCardTypes('card_type,label,numbers_section\nS,Spell,expeditors\nG,Gold,money\nQ,Quest,bogus\n');
    expect(ds.getNumbersSection('S')).toBe('expeditors');
    expect(ds.getNumbersSection('G')).toBe('money');
    expect(ds.getNumbersSection('Q')).toBeNull(); // unknown value → shown nowhere
    expect(ds.getNumbersSection('W')).toBeNull(); // not in this CSV
  });

  it('the built-in fallback equals the shipped CSV (used only when the column is missing)', () => {
    const ds = loadCardTypes(SHIPPED_CSV);
    for (const [t, section] of Object.entries(BUILT_IN_NUMBERS_SECTIONS)) {
      expect(ds.getNumbersSection(t)).toBe(section);
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const legacy = loadCardTypes('card_type,label\nW,Work Package\n');
    expect(legacy.getNumbersSection('E')).toBe('expeditors');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
