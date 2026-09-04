import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { formatManualEffectButton } from '../../src/utils/buttonFormatting';

/**
 * Guard for the plain-English button labels (v3.2.51).
 *
 * Same shape as boardCommon.test.ts's tile-label uniqueness guard, and it
 * exists for the same reason: before v3.2.51, ZERO of the 80 manual effect
 * rows carried an authored `button_label`, so every player-facing button fell
 * through to a hardcoded generator in buttonFormatting.ts — structurally the
 * identical defect as the 22-of-27 tiles that fell through `shortName()`.
 *
 * The rule this pins (maintainer, 2026-09-04): "buttons say what you're doing,
 * in everyday words. No trade jargon on buttons." The deciding reason is
 * structural, not stylistic — `TextWithTerms` renders `<span role="button">`
 * with `stopPropagation()`, so a glossary link inside a real `<button>`
 * swallows the click and the action never fires. A button is therefore the one
 * surface where a hard word can never explain itself. Vocabulary is taught in
 * the story prose and the glossary; the button just names the action.
 *
 * Reads the REAL generated CSV rather than a fixture, so a regeneration that
 * drops the labels fails here instead of silently shipping "Determine Time
 * Impact" back to players.
 */

const CLEAN = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');

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

function manualEffectRows(): Row[] {
  const text = readFileSync(join(CLEAN, 'SPACE_EFFECTS.csv'), 'utf-8');
  return parseCsv(text).filter(r => r.trigger_type?.toLowerCase() === 'manual');
}

/**
 * Terms that must never appear on a button. Deliberately short: this is the
 * vocabulary a beginner does not have, not a general style list. Each of these
 * IS taught — in story prose and the glossary, where a link can explain it.
 */
const JARGON = ['expeditor', 'work package', 'bank loan', 'investment', 'prof cert'];

describe('player-facing button labels', () => {
  it('every manual effect row carries an authored button label', () => {
    const rows = manualEffectRows();
    expect(rows.length).toBeGreaterThan(0);

    const unlabelled = rows
      .filter(r => !r.button_label)
      .map(r => `${r.space_name}/${r.visit_type} (${r.effect_action})`);

    expect(
      unlabelled,
      `${unlabelled.length} manual effect row(s) have no authored button_label and would ` +
      `fall through to buttonFormatting.ts's generated wording:\n  ${unlabelled.join('\n  ')}`
    ).toEqual([]);
  });

  it('no button label contains construction jargon', () => {
    const offenders = manualEffectRows()
      .filter(r => r.button_label)
      .flatMap(r => {
        const hit = JARGON.find(term => r.button_label.toLowerCase().includes(term));
        return hit ? [`"${r.button_label}" (${r.space_name}/${r.visit_type}) contains "${hit}"`] : [];
      });

    expect(
      offenders,
      `A glossary term can never be linked inside a button (TextWithTerms swallows the ` +
      `click), so a hard word on a button can never explain itself:\n  ${offenders.join('\n  ')}`
    ).toEqual([]);
  });

  // The data being right is only half of it — the render path has to honour it.
  // This is the half that was actually broken: processGameData routed the
  // authored dice label into `description` only, and formatManualEffectButton's
  // dice branch deliberately ignores `description`, so all 46 dice labels were
  // inert until the generator also emitted `button_label`.
  it('formatManualEffectButton honours an authored label on a DICE row', () => {
    const effect = {
      space_name: 'REG-DOB-PLAN-EXAM',
      visit_type: 'First',
      effect_type: 'dice',
      effect_action: 'dice_outcome',
      effect_value: 'Time outcomes',
      condition: '',
      description: 'Roll for Time outcomes',
      button_label: 'See how long the check takes',
      trigger_type: 'manual',
    } as unknown as Parameters<typeof formatManualEffectButton>[0];

    expect(formatManualEffectButton(effect).text).toBe('See how long the check takes');
  });

  it('an unauthored dice row still falls back to the generated wording', () => {
    const effect = {
      space_name: 'REG-DOB-PLAN-EXAM',
      visit_type: 'First',
      effect_type: 'dice',
      effect_action: 'dice_outcome',
      effect_value: 'Time outcomes',
      condition: '',
      description: 'Roll for Time outcomes',
      button_label: '',
      trigger_type: 'manual',
    } as unknown as Parameters<typeof formatManualEffectButton>[0];

    // Must NOT be the raw `description` — that column's auto-generated text is
    // the game-language leak the dice branch exists to keep off the button.
    const text = formatManualEffectButton(effect).text;
    expect(text).not.toBe('Roll for Time outcomes');
    expect(text).toBeTruthy();
  });

  it('button labels are short enough to read on a tile', () => {
    // Widest authored label measured at the compact tile's own metrics during
    // the v3.2.50 tile pass; buttons have more room than tiles, so this is a
    // generous ceiling that still catches a runaway sentence.
    const tooLong = manualEffectRows()
      .filter(r => r.button_label && r.button_label.length > 40)
      .map(r => `${r.button_label} (${r.button_label.length} chars, ${r.space_name})`);

    expect(tooLong).toEqual([]);
  });
});
