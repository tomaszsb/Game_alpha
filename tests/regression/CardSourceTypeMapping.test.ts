// tests/regression/CardSourceTypeMapping.test.ts

/**
 * Regression Test: EffectFactory's card sourceType map didn't match
 * CARD_TYPES.csv (2026-08-09).
 *
 * Bug: EffectFactory.createEffectsFromCard mapped card_type 'B' (Bank Loan,
 * per CARD_TYPES.csv) to sourceType 'owner', and card_type 'L' (Life Event)
 * to sourceType 'bank'. 'I' (Investment) -> 'investment' was already correct.
 *
 * This wasn't cosmetic: sourceType drives real gameplay behavior downstream.
 * - FinancialEffectHandler.notifyMoneyReceived shows the "Owner Funding"
 *   toast only when sourceType === 'owner', so a B-card bank loan incorrectly
 *   displayed as owner funding.
 * - ResourceService pushes an entry into player.loans[] only when
 *   sourceType === 'bank' (used later for LOAN_PERCENTAGE regulatory fees
 *   charged against total loan principal). B-card loans were dodging that
 *   fee entirely, while L-card life-event payouts were incorrectly counted
 *   as bank loans and inflated moneySources.bankLoans.
 *
 * Fix: sourceTypeMap now only maps 'B' -> 'bank' and 'I' -> 'investment',
 * matching CARD_TYPES.csv. 'L' (and 'W'/'E') fall through to the existing
 * 'other' default — Life Event cards aren't a funding-source category.
 *
 * Real Owner Funding (OWNER_SEED_MONEY, triggered by a SPACE_EFFECTS row with
 * effect_action === 'owner_seed_money') is a separate code path in
 * EffectEngineService that hardcodes sourceType: 'owner' directly and does
 * not read this map — this fix does not touch or regress that path.
 *
 * Coverage split, deliberately:
 * - The B (Bank Loan) case below exercises the REAL production B001 row
 *   from CARDS_EXPANDED.csv end-to-end through EffectFactory, because B001
 *   genuinely carries a loan_amount and is the exact shape that triggered
 *   the bug.
 * - As of this fix, no L-type row in CARDS_EXPANDED.csv actually has a
 *   non-empty money_effect (verified against the real file via the
 *   production CSV parser — the ~13-card claim in the original bug report
 *   didn't hold up against current data), and EffectFactory doesn't read
 *   investment_amount at all (that field is only wired up in
 *   CardService.ts's separate parseCardIntoEffects, which already hardcodes
 *   the correct sourceType literals and isn't part of this bug). So there is
 *   no real CSV row today that exercises the L->'other' or I->'investment'
 *   branches through EffectFactory. Those branches are covered with
 *   synthetic cards in tests/utils/EffectFactory.test.ts instead. This file
 *   additionally locks CARD_TYPES.csv's own labels in place, so a future
 *   change to that CSV's card-type semantics fails this test rather than
 *   silently drifting from the map again.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataService } from '../../src/services/DataService';
import { EffectFactory } from '../../src/utils/EffectFactory';

// Minimal Node-filesystem DataService: parses only CARDS_EXPANDED.csv (the
// file under test) directly off disk using the real production parser, so
// this test is validated against the real card data, not a hand-written mock.
class CardsOnlyDataService extends DataService {
  async loadData(): Promise<void> {
    const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
    const cardsCsv = readFileSync(join(dataDir, 'CARDS_EXPANDED.csv'), 'utf-8');
    (this as any).cards = (this as any).parseCardsCsv(cardsCsv);
    (this as any).rebuildLookupMaps();
    (this as any).loaded = true;
  }
}

describe('EffectFactory card sourceType matches CARD_TYPES.csv', () => {
  it('maps the real B001 "Small Business Loan" card (loan_amount) to sourceType: bank', async () => {
    const dataService = new CardsOnlyDataService();
    await dataService.loadData();

    const card = dataService.getCardById('B001');
    expect(card).toBeDefined();
    expect(card!.card_type).toBe('B');
    expect(card!.loan_amount).toBeTruthy();

    const effects = EffectFactory.createEffectsFromCard(card!, 'p1');
    // B001 also carries a `cost` field, which produces its own MONEY
    // RESOURCE_CHANGE effect with no sourceType at all (see "CARD COST
    // DEDUCTION" above the loan_amount block in EffectFactory.ts) — filter
    // to the effect that actually carries a sourceType so this test targets
    // the loan_amount path specifically, not the unrelated cost deduction.
    const loanEffect = effects.find(
      e =>
        e.effectType === 'RESOURCE_CHANGE' &&
        (e.payload as any).resource === 'MONEY' &&
        (e.payload as any).sourceType !== undefined
    );
    expect(loanEffect).toBeDefined();
    // The actual bug: this used to be 'owner' because the old map read
    // 'B': 'owner'.
    expect((loanEffect!.payload as any).sourceType).toBe('bank');
  });

  it('CARD_TYPES.csv labels B/L/I the way the sourceType map now assumes', () => {
    const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
    const csv = readFileSync(join(dataDir, 'CARD_TYPES.csv'), 'utf-8');
    const rows = csv
      .trim()
      .split('\n')
      .slice(1)
      .map(line => line.split(','));
    const labelByType = Object.fromEntries(rows.map(([type, label]) => [type, label]));

    // These are the two entries the fixed sourceTypeMap relies on.
    expect(labelByType['B']).toBe('Bank Loan');
    expect(labelByType['I']).toBe('Investment');
    // L is a Life Event, not a funding source — this is why the fixed map
    // no longer has an 'L' entry and lets it fall through to 'other'.
    expect(labelByType['L']).toBe('Life Event');
  });
});
