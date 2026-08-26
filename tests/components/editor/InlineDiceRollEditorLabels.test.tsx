// tests/components/editor/InlineDiceRollEditorLabels.test.tsx
//
// Same family of problem as SpaceEditorLabels.test.tsx, one file over. The
// dice-roll editor drew a die number in a <span> above each outcome field,
// wrote "Button:" and "Roll Group:" in <label>s with no `htmlFor`, and gave
// the "+ Add dice roll..." <select> nothing at all — so a screen reader
// announced every one of them unnamed. (That last one is why the SpaceEditor
// suite had to skip the whole outcomes subtree to pass; the skip is gone now
// that this pass is done.)
//
// These tests pin the same three things: a label finds its field, the ids
// stay unique across REPEATED roll rows, and nothing is left nameless — for
// every shape SmartRollInput can take, since each branch renders a different
// control that has to carry the id.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { InlineDiceRollEditor } from '../../../src/components/editor/InlineDiceRollEditor';
import type { DiceRollRow } from '../../../src/components/editor/types/EditorTypes';

const roll = (over: Partial<DiceRollRow> = {}): DiceRollRow => ({
  space_name: 'ARCH-FEE-REVIEW', die_roll: 'W Cards', visit_type: 'First',
  roll_1: '', roll_2: '', roll_3: '', roll_4: '', roll_5: '', roll_6: '',
  button_label: '', roll_group: '',
  ...over,
});

function editor(diceRolls: DiceRollRow[]): JSX.Element {
  return (
    <InlineDiceRollEditor
      diceRolls={diceRolls}
      spaceName="ARCH-FEE-REVIEW"
      visitType="First"
      allSpaceNames={['ARCH-FEE-REVIEW', 'ARCH-SCOPE-CHECK']}
      onUpdateDiceRoll={vi.fn()}
      onAddDiceRoll={vi.fn()}
      onDeleteDiceRoll={vi.fn()}
    />
  );
}

const renderEditor = (diceRolls: DiceRollRow[] = []) => render(editor(diceRolls));

// One row per SmartRollInput branch, so every control shape it can return is
// on screen at once: preset select, free-text input (a value outside the
// presets), the % and $ number inputs, the plain number input, and the
// space-name select. Plus a Time outcomes row, which is the plain fallback.
const everyShape = (): DiceRollRow[] => [
  roll({ die_roll: 'W Cards', roll_1: 'Draw 1' }),               // preset select
  roll({ die_roll: 'I Cards', roll_1: 'Draw 4 and a half' }),    // off-preset -> text
  roll({ die_roll: 'Fees Paid', roll_1: '5%' }),                 // % number input
  roll({ die_roll: 'Fee Paid', roll_1: '$250' }),                // $ number input
  roll({ die_roll: 'Quality', roll_1: 'HIGH' }),                 // quality select
  roll({ die_roll: 'Multiplier', roll_1: '2' }),                 // plain number input
  roll({ die_roll: 'Next Step', roll_1: 'ARCH-SCOPE-CHECK' }),   // space select
  roll({ die_roll: 'Time outcomes', roll_1: '3 days' }),         // fallback text input
];

describe('InlineDiceRollEditor — fields are findable by their visible label', () => {
  it('finds the Button and Roll Group fields by the labels sitting next to them', () => {
    renderEditor([roll({ button_label: 'Roll for scope', roll_group: 'scope' })]);
    expect(screen.getByLabelText('Button:')).toHaveValue('Roll for scope');
    expect(screen.getByLabelText('Roll Group:')).toHaveValue('scope');
  });

  it('finds each of the six outcome fields by its own die number', () => {
    renderEditor([roll({ die_roll: 'Next Step', roll_3: 'ARCH-SCOPE-CHECK' })]);
    expect(screen.getByLabelText('3')).toHaveValue('ARCH-SCOPE-CHECK');
    ['1', '2', '4', '5', '6'].forEach(n => {
      expect(screen.getByLabelText(n)).toHaveValue('');
    });
  });

  it('names the add-a-row select, which has no visible label at all', () => {
    renderEditor();
    expect(screen.getByLabelText('Add dice roll category')).toBeInTheDocument();
  });

  it('finds every field in a REPEATED row by its own label, not just the first', () => {
    renderEditor([
      roll({ die_roll: 'W Cards', button_label: 'Roll for work' }),
      roll({ die_roll: 'I Cards', button_label: 'Roll for inspection' }),
      roll({ die_roll: 'Quality', button_label: 'Roll for quality' }),
    ]);
    const buttons = screen.getAllByLabelText('Button:');
    expect(buttons.map(el => (el as HTMLInputElement).value))
      .toEqual(['Roll for work', 'Roll for inspection', 'Roll for quality']);
    // Six outcome fields per row, three rows — all found, none collided.
    expect(screen.getAllByLabelText('1')).toHaveLength(3);
  });
});

describe('InlineDiceRollEditor — ids stay unique across repeated rows', () => {
  it('renders no duplicate id with a row of every input shape on screen', () => {
    const { container } = renderEditor(everyShape());
    const ids = Array.from(container.querySelectorAll('[id]')).map(el => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps ids distinct between two editors mounted side by side', () => {
    const { container } = render(
      <div>
        {editor([roll()])}
        {editor([roll()])}
      </div>
    );
    const ids = Array.from(container.querySelectorAll('[id]')).map(el => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('InlineDiceRollEditor — nothing rendered is left nameless', () => {
  it('every input and select has an accessible name, in every input shape', () => {
    const { container } = renderEditor(everyShape());
    const controls = Array.from(container.querySelectorAll('input, textarea, select'));
    // 8 rows x (6 outcome fields + Button + Roll Group) + the add select.
    expect(controls).toHaveLength(65);
    const nameless = controls.filter(el => computeAccessibleName(el).trim() === '');
    expect(nameless).toEqual([]);
  });

  it('names the empty state too, where the add select is the only control', () => {
    const { container } = renderEditor();
    const controls = Array.from(container.querySelectorAll('input, textarea, select'));
    expect(controls).toHaveLength(1);
    const nameless = controls.filter(el => computeAccessibleName(el).trim() === '');
    expect(nameless).toEqual([]);
  });
});

describe('InlineDiceRollEditor — still renders (smoke)', () => {
  it('shows the empty state, then a row per category, without throwing', () => {
    const { rerender } = renderEditor();
    expect(screen.getByText('No dice roll rows yet')).toBeInTheDocument();

    rerender(editor(everyShape()));
    expect(screen.queryByText('No dice roll rows yet')).not.toBeInTheDocument();
    expect(screen.getByText('Next Step')).toBeInTheDocument();
    // Values still land in the right fields, i.e. the id wiring did not
    // rearrange anything.
    expect(screen.getAllByLabelText('1').map(el => (el as HTMLInputElement).value))
      .toEqual(['Draw 1', 'Draw 4 and a half', '5', '250', 'HIGH', '2', 'ARCH-SCOPE-CHECK', '3 days']);
  });
});
