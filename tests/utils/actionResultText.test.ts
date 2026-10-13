import { describe, it, expect } from 'vitest';
import { getActionResultText, effectFragment, getEndTurnCostPreview } from '../../src/utils/costPreview';
import type { SpaceEffect } from '../../src/types/DataTypes';

// Tom, 2026-10-13: the action rows are two columns, the button on the left and its PROPOSED result on the right.
// The wording comes from the same per-effect rules the End Turn preview has always used, so the two cannot disagree.
const eff = (o: Partial<SpaceEffect>): SpaceEffect => ({
  space_name: 'S', visit_type: 'First', effect_type: 'cards', effect_action: 'draw_e', effect_value: '3',
  condition: '', description: '', trigger_type: 'manual', ...o,
} as SpaceEffect);

const services: any = {
  stateService: { getTurnOutflow: () => ({ moneySpent: 0 }), getPlayer: () => undefined, getActionLog: () => [] },
  dataService: { shouldAutoApplyFunding: () => false, getSpaceEffects: () => [] },
};
const none = { manualActions: {} };

describe('the proposed result of an action row', () => {
  it('a fixed card draw says how many, a dice roll says "Varies" (never a guessed number)', () => {
    expect(getActionResultText(services, [eff({})], 'p1', none)).toBe('+3 Expeditors');
    expect(getActionResultText(services, [eff({ effect_type: 'dice', effect_action: '', effect_value: 'W Cards' })], 'p1', none)).toBe('Varies');
  });

  it('a button that runs two effects joins their results, without repeating the same words', () => {
    const a = eff({ effect_type: 'dice', effect_value: 'W Cards' });
    const b = eff({ effect_type: 'dice', effect_value: 'Fee Paid' });
    expect(getActionResultText(services, [a, b], 'p1', none)).toBe('Varies');
    expect(getActionResultText(services, [eff({}), eff({ effect_action: 'draw_w', effect_value: '2' })], 'p1', none)).toBe('+3 Expeditors + +2 Work Packages');
  });

  it('an effect with nothing to show gives nothing, so the row shows its dash', () => {
    expect(getActionResultText(services, [eff({ effect_type: 'dice', effect_action: '', effect_value: 'L Cards' })], 'p1', none)).toBe('');
    expect(getActionResultText(services, [], 'p1', none)).toBe('');
  });

  it('once the action is done a fixed draw still reads its real result', () => {
    const done = { manualActions: { 'cards:draw_e': 'x' } };
    expect(getActionResultText(services, [eff({})], 'p1', done)).toBe('+3 Expeditors');
  });

  it('the End Turn preview still builds from the same per-effect rule', () => {
    const svc: any = { ...services, dataService: { ...services.dataService, getSpaceEffects: () => [eff({})] }, stateService: { ...services.stateService, getPlayer: () => undefined, getActionLog: () => [], getLoanOnTable: () => 0, getGameState: () => ({ players: [] }) } };
    expect(effectFragment(eff({}), svc, 'p1', none)).toEqual({ bucket: 'expediting', text: '+3 Expeditors' });
    expect(getEndTurnCostPreview(svc, 'S', 'First', 'p1', none).find(r => r.key === 'expediting')?.value).toBe('+3 Expeditors');
  });
});
