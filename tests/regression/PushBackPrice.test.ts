// tests/regression/PushBackPrice.test.ts
//
// Pins the REAL data: every push-back ("Try Again") control costs days.
//
// Until v3.2.75 five controls — Investor Review (first visit), Hire a Builder
// (both), Final Approval (both) — charged nothing. Their time is a dice roll, so
// they have no fixed time row, and a push-back used to charge only the fixed rows.
// Pushing back threw away a bad roll (Investor Review rolls 30–70 days) for free.
// Tom, 2026-09-24: "these items in real life take time" — and he approved a price
// for each. Old snapshots of the game (Game_Archive, 2024–2027) confirm the dice
// days never changed and that no push-back price ever existed for these spaces.
//
// If this fails because a NEW push-back control was added: give it a price (a fixed
// time row on the space, or `try_again_days` in Spaces.csv → SPACE_CONTENT.csv).
// If it fails because a price moved: that is a balance decision — ask Tom.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCsvWithHeaders } from '../../server/processGameData.js';
import { calculatePushBackDays } from '../../src/utils/costPreview';
import type { SpaceEffect } from '../../src/types/DataTypes';

const CLEAN = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
const readCsv = (file: string): Record<string, string>[] =>
  parseCsvWithHeaders(readFileSync(join(CLEAN, file), 'utf-8'));

const effects = readCsv('SPACE_EFFECTS.csv') as unknown as SpaceEffect[];
const controls = readCsv('SPACE_CONTENT.csv').filter(
  (r) => (r.can_negotiate || '').trim().toUpperCase() === 'YES',
);

/** Same reading the game does: blank or non-numeric = no price set. */
const priceOf = (raw: string | undefined): number | undefined =>
  /^\d+(\.\d+)?$/.test((raw ?? '').trim()) ? Number(raw!.trim()) : undefined;

function pushBackDays(space: string, visit: string): number {
  const row = controls.find((r) => r.space_name === space && r.visit_type === visit)!;
  return calculatePushBackDays(
    effects.filter((e) => e.space_name === space && e.visit_type === visit),
    { try_again_days: priceOf(row.try_again_days) },
  );
}

describe('push-back price (real CLEAN data)', () => {
  it('finds the push-back controls at all (guards this test against a silent empty pass)', () => {
    expect(controls.length).toBeGreaterThanOrEqual(26);
  });

  it('no push-back is free', () => {
    const free = controls
      .filter((r) => pushBackDays(r.space_name, r.visit_type) <= 0)
      .map((r) => `${r.space_name} (${r.visit_type})`);
    expect(free).toEqual([]);
  });

  it('the five formerly-free controls cost what Tom approved (2026-09-24)', () => {
    expect(pushBackDays('INVESTOR-FUND-REVIEW', 'First')).toBe(15);
    expect(pushBackDays('CON-INITIATION', 'First')).toBe(5);
    expect(pushBackDays('CON-INITIATION', 'Subsequent')).toBe(5);
    expect(pushBackDays('REG-DOB-FINAL-REVIEW', 'First')).toBe(1);
    expect(pushBackDays('REG-DOB-FINAL-REVIEW', 'Subsequent')).toBe(1);
  });

  it('the controls that already had a fixed price are untouched (the price column is only used where there was none)', () => {
    // Fixed-row prices as of v3.2.74 — a sample across every tier (1 / 5 / 10 / 15 / 50).
    // (Bank Review used to be the "1": since v3.2.76 its days follow the loan — see
    // BankReviewDays.test.ts — so the "1" tier is sampled from a space whose Time is a
    // plain "1 day".)
    expect(pushBackDays('OWNER-SCOPE-INITIATION', 'First')).toBe(1);
    expect(pushBackDays('LEND-SCOPE-CHECK', 'First')).toBe(5);
    expect(pushBackDays('REG-DOB-PLAN-EXAM', 'First')).toBe(10);
    expect(pushBackDays('ARCH-FEE-REVIEW', 'Subsequent')).toBe(15);
    expect(pushBackDays('ARCH-FEE-REVIEW', 'First')).toBe(50);
    for (const r of controls) {
      const fixed = effects
        .filter((e) => e.space_name === r.space_name && e.visit_type === r.visit_type)
        .filter((e) => e.effect_type === 'time' && e.effect_action === 'add').length;
      if (fixed > 0) expect(priceOf(r.try_again_days), `${r.space_name} (${r.visit_type})`).toBeUndefined();
    }
  });
});
