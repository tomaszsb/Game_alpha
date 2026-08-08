// tests/regression/CONInitiationChangeOrderFeeCategory.test.ts

/**
 * Regression Test: CON-INITIATION subsequent-visit percentage fee is a
 * construction change-order cost, not an "Engineer fee" (2026-08-08).
 *
 * Bug: EffectFactory.ts categorized every type=money + percentage dice
 * effect as 'architectural' or 'engineering' purely by string-matching
 * "ARCH" in the `dice:<SPACE_NAME>` source. CON-INITIATION's Subsequent
 * money row (a construction change-order cost per ACTION_TOOLTIPS.csv's
 * dice_outcome_change entry and CON-INITIATION's own Subsequent narration
 * in SPACE_CONTENT.csv) doesn't contain "ARCH", so it silently fell into
 * the 'engineering' bucket and displayed as "Engineer fee" everywhere —
 * factually wrong and a voice-rule violation (no invented mechanics,
 * real-world language only).
 *
 * Fix: DICE_EFFECTS.csv now carries an explicit `fee_category` column
 * (public/data/CLEAN_FILES + server/data/game-data mirrors), read by
 * EffectFactory instead of guessing off the space name. This test exercises
 * the real production CSV row (not a synthetic fixture) through the full
 * pipeline: DataService CSV parse -> EffectFactory -> FinancialEffectHandler
 * display text.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DataService } from '../../src/services/DataService';
import { EffectFactory } from '../../src/utils/EffectFactory';
import { FinancialEffectHandler } from '../../src/services/FinancialEffectHandler';
import type {
  IResourceService,
  IStateService,
  IGameRulesService,
  ILoggingService,
} from '../../src/types/ServiceContracts';
import type { Effect, EffectContext } from '../../src/types/EffectTypes';

// Minimal Node-filesystem DataService: parses only DICE_EFFECTS.csv (the file
// under test) directly off disk, so this test is validated against the real
// production CSV, not a hand-written mock.
class DiceEffectsOnlyDataService extends DataService {
  async loadData(): Promise<void> {
    const dataDir = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
    const diceEffectsCsv = readFileSync(join(dataDir, 'DICE_EFFECTS.csv'), 'utf-8');
    (this as any).diceEffects = (this as any).parseDiceEffectsCsv(diceEffectsCsv);
    (this as any).loaded = true;
  }
}

describe('CON-INITIATION subsequent-visit fee is a construction change-order cost', () => {
  it('parses fee_category=construction for the real CON-INITIATION Subsequent money row', async () => {
    const dataService = new DiceEffectsOnlyDataService();
    await dataService.loadData();

    const diceEffects = dataService.getDiceEffects('CON-INITIATION', 'Subsequent');
    const moneyRow = diceEffects.find(e => e.effect_type === 'money');
    expect(moneyRow).toBeDefined();
    expect(moneyRow!.fee_category).toBe('construction');

    // Sanity-check the two rows this fix must NOT regress.
    const archRow = dataService.getDiceEffects('ARCH-FEE-REVIEW', 'First').find(e => e.effect_type === 'money');
    expect(archRow!.fee_category).toBe('architectural');
    const engRow = dataService.getDiceEffects('ENG-FEE-REVIEW', 'First').find(e => e.effect_type === 'money');
    expect(engRow!.fee_category).toBe('engineering');
  });

  it('produces feeCategory: construction end-to-end (CSV -> EffectFactory -> FinancialEffectHandler description)', async () => {
    // --- CSV parse ---
    const dataService = new DiceEffectsOnlyDataService();
    await dataService.loadData();
    const diceEffects = dataService.getDiceEffects('CON-INITIATION', 'Subsequent');

    // --- EffectFactory: roll a 2 -> CSV row roll_2 = '2%' ---
    const effects = EffectFactory.createEffectsFromDiceRoll(
      diceEffects,
      'p1',
      'CON-INITIATION',
      2,
      'Test Player'
    );
    const moneyEffect = effects.find(e => e.effectType === 'RESOURCE_CHANGE' && (e.payload as any).resource === 'MONEY');
    expect(moneyEffect).toBeDefined();
    expect((moneyEffect!.payload as any).percentageOfScope).toBe(2);
    // The actual bug: this used to be 'engineering' because 'dice:CON-INITIATION'
    // doesn't contain "ARCH".
    expect((moneyEffect!.payload as any).feeCategory).toBe('construction');

    // --- FinancialEffectHandler: does the ledger text say "Change order", not "Engineer"? ---
    const player = {
      id: 'p1', name: 'Player 1', currentSpace: 'CON-INITIATION',
      expenditures: { design: 0 },
      costs: { architectural: 0, engineering: 0, total: 0 },
      costHistory: [] as any[],
    } as any;

    const stateService = {
      getPlayer: vi.fn(() => player),
      updateTempState: vi.fn((_id: string, data: any) => {
        if (data?.costHistory) player.costHistory = data.costHistory;
        if (data?.costs) player.costs = data.costs;
        if (data?.expenditures) player.expenditures = { ...player.expenditures, ...data.expenditures };
        return { success: true } as any;
      }),
      emitGameEvent: vi.fn(),
      endGame: vi.fn(),
      getGameState: vi.fn(() => ({ globalTurnCount: 1, turn: 1 } as any)),
    } as unknown as IStateService;

    const resourceService = {
      addMoney: vi.fn(() => true),
      spendMoney: vi.fn(() => true),
      addTime: vi.fn(),
      spendTime: vi.fn(),
    } as unknown as IResourceService;

    const gameRulesService = {
      calculateProjectScope: vi.fn(() => 100_000),
    } as unknown as IGameRulesService;

    const loggingService = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    } as unknown as ILoggingService;

    const handler = new FinancialEffectHandler(resourceService, stateService, gameRulesService, loggingService);
    const ctx: EffectContext = { source: 'test', triggerEvent: 'manual' } as any;

    const result = handler.handleResourceChange(moneyEffect as Effect, ctx);
    expect(result.success).toBe(true);

    expect(player.costHistory).toHaveLength(1);
    const entry = player.costHistory[0];
    expect(entry.category).toBe('construction');
    expect(entry.description).toBe('Change order fee: 2% of scope');
    expect(entry.description).not.toMatch(/Engineer/i);
    expect(entry.description).not.toMatch(/Architect/i);

    // 'construction' is intentionally not one of the CostBreakdown buckets
    // (see DataTypes.ts CostCategory comment) — it must not get misfiled
    // into the engineering total.
    expect(player.costs.engineering).toBe(0);
    expect(player.costs.architectural).toBe(0);
    expect(player.costs.total).toBe(2_000); // 2% of 100,000 project scope
  });
});
