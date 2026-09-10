// tests/regression/HandPlayableCardTypes.test.ts
//
// Workstream 6 audit II, B2 (v3.2.56). Which card FAMILIES can be played from
// hand is authored in CARD_TYPES.csv (is_playable_from_hand), not compiled
// into the UI as `card_type === 'E'`. The component suites
// (PlayerPanelV2 / PlayerCardDetailV2) prove the UI obeys the data; this
// file proves the data layer reads it, and that the built-in fallback used
// when the CSV is missing cannot drift from the shipped CSV.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataService, BUILT_IN_HAND_PLAYABLE_CARD_TYPES } from '../../src/services/DataService';

const SHIPPED_CSV = readFileSync(join(process.cwd(), 'public/data/CLEAN_FILES/CARD_TYPES.csv'), 'utf-8');

const loadCardTypes = (csv: string): DataService => {
  const ds = new DataService();
  (ds as any).cardTypeLabels = (ds as any).parseCardTypeLabelsCsv(csv);
  return ds;
};

describe('hand-playable card families come from CARD_TYPES.csv (B2)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shipped data: exactly the Expeditor family is playable from hand (behaviour unchanged)', () => {
    const ds = loadCardTypes(SHIPPED_CSV);
    const playable = ['W', 'B', 'E', 'L', 'I'].filter(t => ds.isCardTypePlayableFromHand(t));
    expect(playable).toEqual(['E']);
  });

  it('a reskin CSV can make a different family playable — no code change', () => {
    const ds = loadCardTypes(
      'card_type,label,is_playable_from_hand\nE,Expeditor,No\nS,Spell,Yes\nP,Potion,Yes\n'
    );
    expect(ds.isCardTypePlayableFromHand('S')).toBe(true);
    expect(ds.isCardTypePlayableFromHand('P')).toBe(true);
    expect(ds.isCardTypePlayableFromHand('E')).toBe(false);
  });

  it('the built-in fallback equals the shipped CSV (so it cannot drift)', () => {
    const ds = loadCardTypes(SHIPPED_CSV);
    const fromCsv = ['W', 'B', 'E', 'L', 'I'].filter(t => ds.isCardTypePlayableFromHand(t));
    expect([...BUILT_IN_HAND_PLAYABLE_CARD_TYPES].sort()).toEqual(fromCsv.sort());
  });

  it('a CSV without the column falls back to the built-in rule — loudly, once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ds = loadCardTypes('card_type,label\nE,Expeditor\nW,Work Package\n');
    expect(ds.isCardTypePlayableFromHand('E')).toBe(true);
    expect(ds.isCardTypePlayableFromHand('W')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/is_playable_from_hand/);
  });

  it('the labels still load alongside the new column', () => {
    const ds = loadCardTypes(SHIPPED_CSV);
    expect(ds.getCardTypeLabels().find(r => r.card_type === 'E')?.label).toBe('Expeditor');
  });
});
