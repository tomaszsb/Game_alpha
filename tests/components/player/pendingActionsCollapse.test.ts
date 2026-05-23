// Locks the v2.70.1 fix that collapses CHEAT-BYPASS's paired dice rows
// (Time outcomes / Fees Paid) into a single "🎲 Roll dice" button.
//
// Background: SPACE_EFFECTS.csv has multiple dice_outcome rows at CHEAT-BYPASS
// that all resolve to the same effectKey ("dice:dice_outcome") and share one
// physical dice roll (blank roll_group, same-roll pairing — see v2.70.0).
// Before v2.70.1 the player saw two buttons that both fired the same roll;
// after, they see one button. Stale-tab playtester reports (e.g. fb:218367b6)
// re-surface the old two-button state — this test prevents accidental
// regression to that behavior.

import { describe, it, expect } from 'vitest';
import { collapsePairedDiceActions, COLLAPSED_DICE_LABEL } from '../../../src/components/player/pendingActionsCollapse';

interface TestAction {
  effectKey: string;
  isDiceEffect: boolean;
  label: string;
}

const cheatBypassActions = (): TestAction[] => [
  { effectKey: 'cards:return_e', isDiceEffect: false, label: 'Return 1 E card' },
  { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Time Impact' },
  { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Fee Amount' },
];

describe('collapsePairedDiceActions', () => {
  it('collapses two CHEAT-BYPASS dice rows into one "🎲 Roll dice" button', () => {
    const result = collapsePairedDiceActions(cheatBypassActions());

    expect(result).toHaveLength(2);
    expect(result[0].effectKey).toBe('cards:return_e');
    expect(result[1].effectKey).toBe('dice:dice_outcome');
    expect(result[1].label).toBe(COLLAPSED_DICE_LABEL);

    const diceLabels = result.filter(a => a.isDiceEffect).map(a => a.label);
    expect(diceLabels).not.toContain('Determine Time Impact');
    expect(diceLabels).not.toContain('Determine Fee Amount');
  });

  it('leaves a single dice action alone (no collapse, original label preserved)', () => {
    const single: TestAction[] = [
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Time Impact' },
    ];

    const result = collapsePairedDiceActions(single);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Determine Time Impact');
  });

  it('does not collapse distinct effectKeys even if both are dice effects', () => {
    const distinct: TestAction[] = [
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Time Impact' },
      { effectKey: 'dice:dice_quality', isDiceEffect: true, label: 'Assess Quality' },
    ];

    const result = collapsePairedDiceActions(distinct);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.label)).toEqual(['Determine Time Impact', 'Assess Quality']);
  });

  it('preserves order of non-dice actions', () => {
    const mixed: TestAction[] = [
      { effectKey: 'cards:return_e', isDiceEffect: false, label: 'Return 1 E card' },
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Time Impact' },
      { effectKey: 'money:fee', isDiceEffect: false, label: 'Pay Fee' },
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Fee Amount' },
    ];

    const result = collapsePairedDiceActions(mixed);

    expect(result.map(a => a.effectKey)).toEqual([
      'cards:return_e',
      'dice:dice_outcome',
      'money:fee',
    ]);
    expect(result.find(a => a.isDiceEffect)?.label).toBe(COLLAPSED_DICE_LABEL);
  });

  it('handles three dice rows with the same key (Time + Fees + Next Step scenario)', () => {
    const three: TestAction[] = [
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Time Impact' },
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Fee Amount' },
      { effectKey: 'dice:dice_outcome', isDiceEffect: true, label: 'Determine Next Step' },
    ];

    const result = collapsePairedDiceActions(three);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe(COLLAPSED_DICE_LABEL);
  });

  it('returns an empty array unchanged', () => {
    expect(collapsePairedDiceActions([])).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = cheatBypassActions();
    const snapshot = JSON.parse(JSON.stringify(input));

    collapsePairedDiceActions(input);

    expect(input).toEqual(snapshot);
  });
});
