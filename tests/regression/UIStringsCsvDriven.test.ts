// tests/regression/UIStringsCsvDriven.test.ts

/**
 * Regression test: button/notification text is CSV-driven (2026-08-14).
 *
 * Workstream 6 CSV-only-reskin audit (2026-08-03, TODO.md) flagged
 * uiStrings.ts as hardcoded English copy a CSV-only reskin couldn't touch.
 * Scoped 2026-08-14 (see TODO.md/CHANGELOG): the project already had the
 * right mechanism for this — templateInterpolation.ts's `{token}` syntax,
 * already used for ModalConfig.csv text — so this just extends that same
 * pattern to uiStrings.ts's ~40 button/notification strings via a new
 * UI_STRINGS.csv (key -> template) and a configureUIStrings() override.
 *
 * Each test uses vi.resetModules() + a dynamic import to get a fresh copy
 * of uiStrings.ts, since its override map is mutable module-level state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UIStringCsvRow } from '../../src/types/DataTypes';

describe('button/notification text is CSV-driven (reskin: vocabulary swap)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loading the shipped CSV yields identical output to the previous hardcoded defaults', async () => {
    const ui = await import('../../src/constants/uiStrings');
    const before = {
      work: ui.DICE_BUTTON.WORK,
      got: ui.DICE_FEEDBACK.got(3, 'Work Package', 's'),
      diceRollEmpty: ui.NOTIF.diceRollMedium(''),
      diceRollWithSummary: ui.NOTIF.diceRollMedium('you drew a card'),
      returnButton: ui.CARD_REPLACE.RETURN_BUTTON,
    };

    ui.configureUIStrings([{ key: 'DICE_BUTTON.WORK', template: 'Get Work Packages' }]);

    expect(ui.DICE_BUTTON.WORK).toBe(before.work);
    expect(ui.DICE_FEEDBACK.got(3, 'Work Package', 's')).toBe(before.got);
    expect(ui.NOTIF.diceRollMedium('')).toBe(before.diceRollEmpty);
    expect(ui.NOTIF.diceRollMedium('you drew a card')).toBe(before.diceRollWithSummary);
    expect(ui.CARD_REPLACE.RETURN_BUTTON).toBe(before.returnButton);
  });

  it('a reskin CSV swaps a plain-string button label', async () => {
    const ui = await import('../../src/constants/uiStrings');
    expect(ui.DICE_BUTTON.EXPEDITOR).toBe('Hire Expeditors');

    ui.configureUIStrings([{ key: 'DICE_BUTTON.EXPEDITOR', template: 'Recruit a Scout' }]);

    expect(ui.DICE_BUTTON.EXPEDITOR).toBe('Recruit a Scout');
    // Untouched keys stay at their default.
    expect(ui.DICE_BUTTON.BANK).toBe('Apply for Bank Loans');
  });

  it('a reskin CSV swaps a templated string and interpolation still works', async () => {
    const ui = await import('../../src/constants/uiStrings');

    ui.configureUIStrings([{ key: 'DICE_FEEDBACK.gained', template: 'Found {amount} gold' }]);

    expect(ui.DICE_FEEDBACK.gained(50)).toBe('Found 50 gold');
  });

  it('a reskin CSV can override each branch of a conditional string independently', async () => {
    const ui = await import('../../src/constants/uiStrings');

    ui.configureUIStrings([
      { key: 'NOTIF.diceRollMedium.withSummary', template: '⚔ {summary}' },
      { key: 'NOTIF.diceRollMedium.empty', template: 'Nothing happens' },
    ]);

    expect(ui.NOTIF.diceRollMedium('you found treasure')).toBe('⚔ you found treasure');
    expect(ui.NOTIF.diceRollMedium('')).toBe('Nothing happens');
  });

  it('an unrecognized key is skipped without crashing, and does not block other valid rows', async () => {
    const ui = await import('../../src/constants/uiStrings');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const rows: UIStringCsvRow[] = [
      { key: 'DICE_BUTTON.NOT_A_REAL_KEY', template: 'Whatever' },
      { key: 'DICE_BUTTON.WORK', template: 'Gather Supplies' },
    ];
    expect(() => ui.configureUIStrings(rows)).not.toThrow();

    expect(ui.DICE_BUTTON.WORK).toBe('Gather Supplies');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('missing CSV (empty rows) falls back to the built-in defaults without crashing', async () => {
    const ui = await import('../../src/constants/uiStrings');
    const before = ui.DICE_BUTTON.WORK;

    expect(() => ui.configureUIStrings([])).not.toThrow();

    expect(ui.DICE_BUTTON.WORK).toBe(before);
  });

  it('cardPlayDetailed (not in the shipped CSV — embeds literal quotes) still works after unrelated overrides', async () => {
    const ui = await import('../../src/constants/uiStrings');

    ui.configureUIStrings([{ key: 'DICE_BUTTON.WORK', template: 'Gather Supplies' }]);

    expect(ui.NOTIF.cardPlayDetailed('Alice', 'Rush Job', '-2 days')).toBe(
      'Alice activated "Rush Job" with effects: -2 days'
    );
    expect(ui.NOTIF.cardPlayDetailed('Alice', 'Rush Job', '')).toBe('Alice activated "Rush Job"');
  });
});
