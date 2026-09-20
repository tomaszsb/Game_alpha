import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getTooltipService,
  initializeTooltipService,
  resetTooltipService,
} from '../../src/services/TooltipService';
import {
  diceCategoryOf,
  formatManualEffectButton,
  getManualEffectTooltip,
} from '../../src/utils/buttonFormatting';
import { collapsePairedDiceActions } from '../../src/components/player/pendingActionsCollapse';
import { isSkippableEffectAction } from '../../src/utils/skippableActions';
import { DICE_BUTTON } from '../../src/constants/uiStrings';
import type { SpaceEffect } from '../../src/types/DataTypes';

/**
 * Guard for the "What's this?" copy (v3.2.69, Onboarding Phase C).
 *
 * Two questions, both answered against the REAL files rather than fixtures:
 *   1. Does every "?" a player can actually press get authored copy? Before
 *      v3.2.69 only the 6 card rows did, and the 45 dice buttons — most of the
 *      action row, and the ones a beginner most needs explained — answered
 *      with the button's own label: tapping "?" on "See what he wants built"
 *      opened a box that said "See what he wants built."
 *   2. Is that copy in the game's voice? (No "dice", "roll", "card", "draw".)
 *
 * The check on (1) goes through the panel's OWN collapse helper, because two
 * dice rows that share a roll are merged into one button, and on 8 space/visit
 * combinations that button stands for TWO different outcomes. A test that only
 * looked at single rows would have passed while those 8 buttons explained half
 * of what pressing them does.
 */

const CLEAN = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');
const TOOLTIPS_CSV = readFileSync(join(CLEAN, 'ACTION_TOOLTIPS.csv'), 'utf-8');

interface Row { [key: string]: string }

/** Minimal quote-aware CSV parse — SPACE_EFFECTS has commas inside fields. */
function parseCsv(text: string): Row[] {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i];
    if (inQuotes) {
      if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows[0];
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

function manualEffects(): SpaceEffect[] {
  const text = readFileSync(join(CLEAN, 'SPACE_EFFECTS.csv'), 'utf-8');
  return parseCsv(text)
    .filter(r => r.trigger_type?.toLowerCase() === 'manual')
    .map(r => ({
      space_name: r.space_name,
      visit_type: r.visit_type,
      effect_type: r.effect_type,
      effect_action: r.effect_action,
      effect_value: r.effect_value,
      condition: r.condition,
      description: r.description,
      trigger_type: 'manual',
      button_label: r.button_label,
    }) as unknown as SpaceEffect);
}

/** What PlayerPanelV2 builds for each row before collapsing — same key rule. */
function panelActions(effects: SpaceEffect[]) {
  return effects.map(effect => ({
    effectKey: effect.effect_action ? `${effect.effect_type}:${effect.effect_action}` : effect.effect_type,
    label: formatManualEffectButton(effect).text,
    isDiceEffect: effect.effect_type === 'dice',
    effect,
  }));
}

/** The buttons a player sees on one space/visit, after merging shared rolls. */
function buttonsAt(space: string, visit: string) {
  const here = manualEffects().filter(e => e.space_name === space && e.visit_type === visit);
  return collapsePairedDiceActions(panelActions(here));
}

/** The one dice button on a space/visit — spaces can also carry card buttons. */
function diceButtonAt(space: string, visit: string) {
  const button = buttonsAt(space, visit).find(b => b.isDiceEffect);
  if (!button) throw new Error(`${space}/${visit} has no dice button`);
  return button;
}

function tooltipOf(button: ReturnType<typeof buttonsAt>[number]) {
  return getManualEffectTooltip(button.effect, button.mergedFrom?.map(m => m.effect));
}

/** The authored row behind a category, straight from the loaded file. */
function row(kind: 'cards' | 'dice', value: string) {
  const r = getTooltipService().getTooltip(kind, value);
  if (!r) throw new Error(`ACTION_TOOLTIPS.csv has no ${kind}/${value} row`);
  return r;
}

// Per TEST, not per file: tests/vitest.setup.ts resets the TooltipService
// singleton after every test (state-leak prevention), so a beforeAll load would
// leave every test but the first looking at an empty service.
beforeEach(async () => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(TOOLTIPS_CSV) }) as unknown as typeof fetch;
  await initializeTooltipService().loadTooltips();
});

afterEach(() => {
  resetTooltipService();
});

/**
 * Every ACTION_TOOLTIPS row a player can reach. The other ~36 rows (Life Events,
 * `give_E`, the `choice` rows, the movement/negotiation helpers) are unreachable
 * from the UI and deliberately left exactly as they were — rewording text nobody
 * can see is effort with no player benefit (AUTHORED_COPY_REVIEW.md, Part 3).
 */
const LIVE_ROWS: Array<['cards' | 'dice', string]> = [
  ['cards', 'draw_W'], ['cards', 'draw_B'], ['cards', 'draw_I'], ['cards', 'draw_E'],
  ['cards', 'replace_E'], ['cards', 'return_E'], ['cards', 'transfer_E'],
  ['dice', 'dice_outcome_time'], ['dice', 'dice_outcome_fee'], ['dice', 'dice_outcome_W'],
  ['dice', 'dice_outcome_I'], ['dice', 'dice_outcome_E'], ['dice', 'dice_outcome_quality'],
  ['dice', 'dice_outcome_multiplier'], ['dice', 'dice_outcome_quality_multiplier'],
];

describe('"What\'s this?" copy reaches every button a player can press', () => {
  it('every manual action resolves to authored copy, not the button\'s own label', () => {
    const effects = manualEffects();
    expect(effects.length).toBeGreaterThan(0);

    const bySpace = new Map<string, SpaceEffect[]>();
    for (const e of effects) {
      const k = `${e.space_name}/${e.visit_type}`;
      bySpace.set(k, [...(bySpace.get(k) ?? []), e]);
    }

    const unanswered: string[] = [];
    let merged = 0;
    for (const [where, group] of bySpace) {
      for (const button of collapsePairedDiceActions(panelActions(group))) {
        if (button.mergedFrom) merged++;
        const t = tooltipOf(button);
        const fallback = button.effect.description || 'Complete this action to progress';
        if (!t.tooltip || t.tooltip === fallback) {
          unanswered.push(`${where}: "${button.label}" (${button.effectKey}) -> "${t.tooltip}"`);
        }
      }
    }

    expect(
      unanswered,
      `${unanswered.length} button(s) would open a "?" that only repeats their own label:\n  ${unanswered.join('\n  ')}`
    ).toEqual([]);

    // Sanity: this run really did cover the merged path, otherwise a regression
    // there would pass silently on a board with no merged buttons.
    expect(merged).toBeGreaterThan(0);
  });

  it('a "?" on a dice button no longer just echoes the button', () => {
    // The exact case from the 2026-09-18 live check.
    const button = diceButtonAt('OWNER-SCOPE-INITIATION', 'First');
    const t = tooltipOf(button);
    expect(t.tooltip).not.toBe(button.label);
    expect(t.tooltip).toBe(row('dice', 'dice_outcome_W').tooltip_why);
  });
});

describe('the 7 card rows (Part 1)', () => {
  const effectFor = (action: string): SpaceEffect => ({
    effect_type: 'cards', effect_action: action, effect_value: 1, condition: '',
    description: 'DESCRIPTION-FALLBACK', trigger_type: 'manual',
  } as unknown as SpaceEffect);

  it.each([
    ['draw_W'], ['draw_B'], ['draw_I'], ['draw_E'], ['replace_E'], ['return_E'], ['transfer'],
  ])('%s has authored copy', (action) => {
    const t = getManualEffectTooltip(effectFor(action));
    expect(t.tooltip).not.toBe('DESCRIPTION-FALLBACK');
    expect(t.tooltip.length).toBeGreaterThan(20);
  });

  it('draw_E ties the button word to the trade word', () => {
    // The whole reason this row matters most: it is the only place that connects
    // "team member" (the button) to "expeditor" (what the rest of the game says).
    const t = getManualEffectTooltip(effectFor('draw_E')).tooltip.toLowerCase();
    expect(t).toContain('team member');
    expect(t).toContain('expeditor');
  });

  it('replace_E says the newcomer is picked for you — because the engine does', () => {
    // CardService.replaceCard() discards the expeditor the player chose and calls
    // drawCards(playerId, type, 1): the replacement comes off the deck.
    expect(getManualEffectTooltip(effectFor('replace_E')).context).toContain('picked for you');
  });

  it('return_E never claims it can be forced — no space forces it', () => {
    // The old row said "You may be forced to give up help". Every return_E row in
    // the shipped board is a manual button, and the panel tags it Optional. If a
    // future board authors a mandatory one, this copy needs revisiting, so the
    // fact it rests on is asserted here rather than assumed.
    const returns = manualEffects().filter(e => e.effect_action.toLowerCase() === 'return_e');
    expect(returns.length).toBeGreaterThan(0);
    returns.forEach(e => {
      expect(e.trigger_type).toBe('manual');
      expect(isSkippableEffectAction(`${e.effect_type}:${e.effect_action}`)).toBe(true);
    });

    const t = getManualEffectTooltip(effectFor('return_E'));
    expect(`${t.tooltip} ${t.context}`.toLowerCase()).not.toContain('forced');
  });

  it('transfer_E now has a row (its "?" used to fall back to the button label)', () => {
    const t = getManualEffectTooltip(effectFor('transfer'));
    expect(t.context.toLowerCase()).toContain('optional');
    expect(isSkippableEffectAction('cards:transfer')).toBe(true);
  });
});

describe('merged dice buttons explain every outcome they fire', () => {
  it('Con-Initiation (first visit) uses the approved combined quality + bid text', () => {
    const button = diceButtonAt('CON-INITIATION', 'First');
    expect(button.mergedFrom).toHaveLength(2);

    const t = tooltipOf(button);
    const combined = row('dice', 'dice_outcome_quality_multiplier');
    expect(t.tooltip).toBe(combined.tooltip_why);
    expect(t.context).toBe(combined.tooltip_context);
    // ...and not a stitched-together pair of the two single rows.
    expect(t.tooltip).not.toBe(row('dice', 'dice_outcome_quality').tooltip_why);
  });

  it('Investor Review joins the investor text and the time text, in row order', () => {
    const button = diceButtonAt('INVESTOR-FUND-REVIEW', 'First');
    const investor = row('dice', 'dice_outcome_I');
    const time = row('dice', 'dice_outcome_time');
    expect(button.mergedFrom).toHaveLength(2);

    const t = tooltipOf(button);
    expect(t.tooltip).toBe(`${investor.tooltip_why}\n\n${time.tooltip_why}`);
    expect(t.context).toBe(`${investor.tooltip_context}\n\n${time.tooltip_context}`);
  });

  it('a row with no grey line (Fee) leaves no empty paragraph behind', () => {
    // CHEAT-BYPASS = time + fee. Fee's context is empty BY DESIGN — its category
    // spans several spaces, so there is no number that is true for all of them.
    const dice = diceButtonAt('CHEAT-BYPASS', 'First');
    const time = row('dice', 'dice_outcome_time');
    const fee = row('dice', 'dice_outcome_fee');
    expect(fee.tooltip_context).toBe('');

    const t = tooltipOf(dice);
    expect(t.tooltip).toBe(`${time.tooltip_why}\n\n${fee.tooltip_why}`);
    expect(t.context).toBe(time.tooltip_context);
    expect(t.context.endsWith('\n')).toBe(false);
  });

  it('every merged button contains the text of each row it stands for', () => {
    // The invariant behind all of the above, checked on every merged button in
    // the shipped board rather than the four I thought to name.
    const effects = manualEffects();
    const spaces = [...new Set(effects.map(e => `${e.space_name}|${e.visit_type}`))];
    let checked = 0;
    for (const key of spaces) {
      const [space, visit] = key.split('|');
      for (const button of buttonsAt(space, visit)) {
        if (!button.mergedFrom) continue;
        checked++;
        const merged = tooltipOf(button).tooltip;
        const combinedRow = row('dice', 'dice_outcome_quality_multiplier').tooltip_why;
        if (merged === combinedRow) continue; // the contractor pair has its own text
        button.mergedFrom.forEach(m => {
          expect(merged, `${key}: missing ${m.effect.effect_value}`).toContain(
            getManualEffectTooltip(m.effect).tooltip
          );
        });
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('voice', () => {
  const GAME_LANGUAGE = /\b(dice|die|roll|rolls|rolled|rolling|card|cards|draw|draws|drawn|drew)\b/i;

  it.each(LIVE_ROWS)('%s / %s uses real-world language only', (kind, value) => {
    const r = row(kind, value);
    const text = `${r.tooltip_why} ${r.tooltip_context}`;
    expect(text).not.toMatch(GAME_LANGUAGE);
    // The review doc marks trade words in **bold**; that markup must not leak.
    expect(text).not.toContain('**');
  });

  it('every reachable row is at most two sentences in the main line', () => {
    // The convention from the review doc: the main line teaches, the grey line
    // carries the one fact worth remembering.
    LIVE_ROWS.forEach(([kind, value]) => {
      const sentences = row(kind, value).tooltip_why.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, `${kind}/${value}: "${row(kind, value).tooltip_why}"`).toBeLessThanOrEqual(2);
    });
  });
});

describe('diceCategoryOf', () => {
  it.each([
    ['W Cards', 'work'], ['w cards', 'work'],
    ['B Cards', 'bank'], ['b card', 'bank'],
    ['I Cards', 'investment'],
    ['E cards', 'expeditor'], ['E card', 'expeditor'],
    ['L Cards', 'life'],
    ['Fees Paid', 'fee'], ['Fee Paid', 'fee'],
    ['Time outcomes', 'time'], ['Time', 'time'],
    ['Quality', 'quality'],
    ['Multiplier', 'multiplier'], ['Multiplier ', 'multiplier'], // the CSV really has a trailing space in places
    ['Next Step', 'next'],
  ])('reads %j as %s', (raw, expected) => {
    expect(diceCategoryOf(raw)).toBe(expected);
  });

  it('returns null for anything it does not recognise, including empty and numeric values', () => {
    expect(diceCategoryOf('Something else')).toBeNull();
    expect(diceCategoryOf('')).toBeNull();
    expect(diceCategoryOf(undefined)).toBeNull();
    expect(diceCategoryOf(3)).toBeNull();
  });
});

describe('formatManualEffectButton — dice wording is unchanged by the shared classifier', () => {
  // The button branch used to keep its own list of these spellings; it now reads
  // diceCategoryOf. This pins that the swap changed nothing a player can see.
  const dice = (effect_value: string) => ({
    effect_type: 'dice', effect_action: 'dice_outcome', effect_value, condition: '',
    description: '', button_label: '', trigger_type: 'manual',
  }) as unknown as SpaceEffect;

  it.each([
    ['W Cards', () => DICE_BUTTON.WORK],
    ['B Cards', () => DICE_BUTTON.BANK],
    ['I Cards', () => DICE_BUTTON.INVESTMENT],
    ['E cards', () => DICE_BUTTON.EXPEDITOR],
    ['L Cards', () => DICE_BUTTON.LIFE_EVENT],
    ['Fees Paid', () => DICE_BUTTON.FEE],
    ['Fee Paid', () => DICE_BUTTON.FEE],
    ['Time outcomes', () => DICE_BUTTON.TIME],
    ['Quality', () => DICE_BUTTON.QUALITY],
    ['Next Step', () => DICE_BUTTON.NEXT_STEP],
    ['Multiplier ', () => DICE_BUTTON.OUTCOME],
    ['Nonsense', () => DICE_BUTTON.OUTCOME],
  ])('%j reads as expected', (value, expected) => {
    expect(formatManualEffectButton(dice(value)).text).toBe(expected());
  });
});
