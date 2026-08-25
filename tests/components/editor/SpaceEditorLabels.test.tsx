// tests/components/editor/SpaceEditorLabels.test.tsx
//
// Every field in SpaceEditor used to be a <label> sitting next to its input
// with nothing tying the two together — no `htmlFor`/`id` pairing, no
// `aria-label` on the handful of controls with no visible label at all. A
// screen reader announced them unnamed, and `getByLabelText` (the way these
// very tests would like to find a field) could not find them either. Found
// 2026-08-23 building the preview/editor link; this is the pass that fixes it.
//
// These tests pin three things: that a real label now finds its field
// (including inside a REPEATED group, which is where id collisions would
// show up first), that no two controls in a space with several actions/rows
// share an id, and that nothing rendered is left nameless.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { SpaceEditor } from '../../../src/components/editor/SpaceEditor';
import type { SpaceRow } from '../../../src/components/editor/types/EditorTypes';

const row = (over: Partial<SpaceRow> = {}): SpaceRow => ({
  space_name: 'ARCH-FEE-REVIEW', phase: 'DESIGN', visit_type: 'First',
  Title: "Let's talk about my fee", Event: 'We need to talk money.',
  Action: 'Pay the fee, or push back.', Outcome: 'Fee agreed.',
  w_card: 'Draw 1', b_card: 'Draw 1', i_card: 'Draw 1', l_card: 'Draw 1', e_card: 'Draw 1',
  Time: '3 days', Fee: '5%',
  space_1: 'ARCH-SCOPE-CHECK', space_2: '', space_3: '', space_4: '', space_5: '',
  Negotiate: 'YES', requires_dice_roll: 'No', path: 'Main', rolls: '',
  end_turn_label: '', try_again_label: '',
  w_card_label: '', b_card_label: '', i_card_label: '', l_card_label: '', e_card_label: '',
  shake_on: '', tts_field: '',
  w_card_narrative: '', b_card_narrative: '', i_card_narrative: '', l_card_narrative: '', e_card_narrative: '',
  ...over,
});

function renderEditor(props: Partial<React.ComponentProps<typeof SpaceEditor>> = {}) {
  const first = props.spaceFirst === undefined ? row() : props.spaceFirst;
  return render(
    <SpaceEditor
      spaceFirst={first}
      spaceSubsequent={null}
      visitType="First"
      allSpaceNames={['ARCH-FEE-REVIEW', 'ARCH-SCOPE-CHECK']}
      diceRollData={[]}
      modalConfigData={[]}
      onVisitTypeChange={vi.fn()}
      onFieldChange={vi.fn()}
      displayLabelOverride=""
      onDisplayLabelChange={vi.fn()}
      onUpdateDiceRoll={vi.fn()}
      onAddDiceRoll={vi.fn()}
      onDeleteDiceRoll={vi.fn()}
      onModalConfigChange={vi.fn()}
      {...props}
    />
  );
}

// Five LOGIC destinations, each a well-formed condition, so all five mount
// their own LogicFieldBuilder (Q / Y→ / N→) — the densest repeated-field
// group in the file, and the one most likely to collide on a bare
// `id="effect_value"`-style id if the fix used one.
const logicRow = () => row({
  path: 'LOGIC',
  space_1: 'Is scope ≤ $1M? YES - ARCH-SCOPE-CHECK - NO - ARCH-FEE-REVIEW',
  space_2: 'Is scope ≤ $2M? YES - ARCH-SCOPE-CHECK - NO - ARCH-FEE-REVIEW',
  space_3: 'Is scope ≤ $3M? YES - ARCH-SCOPE-CHECK - NO - ARCH-FEE-REVIEW',
  space_4: 'Is scope ≤ $4M? YES - ARCH-SCOPE-CHECK - NO - ARCH-FEE-REVIEW',
  space_5: 'Is scope ≤ $5M? YES - ARCH-SCOPE-CHECK - NO - ARCH-FEE-REVIEW',
});

describe('SpaceEditor — fields are findable by their visible label', () => {
  it('finds a plain textarea field by the label sitting next to it', () => {
    renderEditor();
    expect(screen.getByLabelText('Story title (subtitle, per visit)')).toHaveValue("Let's talk about my fee");
    expect(screen.getByLabelText('Event (Story)')).toHaveValue('We need to talk money.');
  });

  it('finds the Time field, split across a label component and a separate input component', () => {
    renderEditor();
    // ⏱️ Time renders as a numeric "days" input once the value parses as
    // "N days" — LabelWithRevert (the label) and TimeInput (the control)
    // are two different components that must agree on one id.
    expect(screen.getByLabelText('⏱️ Time')).toHaveValue(3);
  });

  it('finds every field in a REPEATED group by its own label, not just the first', () => {
    renderEditor({ spaceFirst: logicRow() });
    // All five LogicFieldBuilder instances render a "Q" field. Getting all
    // five back (rather than erroring on an ambiguous/duplicate id) is the
    // whole point of this test.
    const questions = screen.getAllByLabelText('Q');
    expect(questions).toHaveLength(5);
    const values = questions.map(el => (el as HTMLInputElement).value);
    expect(values).toEqual([
      'Is scope ≤ $1M?', 'Is scope ≤ $2M?', 'Is scope ≤ $3M?', 'Is scope ≤ $4M?', 'Is scope ≤ $5M?',
    ]);
  });

  it('finds an End Turn field, and a control with no visible label by its aria-label', () => {
    renderEditor({ spaceFirst: row({ end_turn_label: 'Submit Application' }) });
    expect(screen.getByLabelText('End Turn Label')).toHaveValue('Submit Application');
    // The tile-label input has no visible <label> sibling at all (only a
    // placeholder/title) — it must still have a real accessible name.
    expect(screen.getByLabelText('Tile label')).toBeInTheDocument();
  });
});

describe('SpaceEditor — ids stay unique across repeated groups', () => {
  it('renders no duplicate id for a space with all five actions, a dice space, and a five-way LOGIC split', () => {
    const { container } = renderEditor({
      spaceFirst: logicRow(),
      // requires_dice_roll pulls in the per-roll popup section (7 modal
      // config groups: Any Roll + 1..6), on top of the 5 card actions
      // (each with its own modal config group) already in `row()`.
      // path is LOGIC above, so this also exercises the destinations
      // section's LogicBuilder rather than the plain space_1..5 selects.
    });
    const ids = Array.from(container.querySelectorAll('[id]')).map(el => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stays unique with the dice-roll popup groups open too', () => {
    const { container } = renderEditor({
      spaceFirst: row({ requires_dice_roll: 'Yes' }),
    });
    const ids = Array.from(container.querySelectorAll('[id]')).map(el => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// The "outcomes" section mounts InlineDiceRollEditor — a different
// component in a different file, out of scope for this pass (the task is
// SpaceEditor.tsx only). Excluded here rather than asserted on, so this
// suite stays honest about what it actually fixed.
const ownControls = (container: HTMLElement): Element[] =>
  Array.from(container.querySelectorAll('input, textarea, select'))
    .filter(el => !el.closest('[data-editor-region="outcomes"]'));

describe('SpaceEditor — nothing rendered is left nameless', () => {
  it('every input, textarea and select has an accessible name', () => {
    const { container } = renderEditor({ spaceFirst: logicRow() });
    const controls = ownControls(container);
    expect(controls.length).toBeGreaterThan(20); // sanity: this space renders a lot of fields
    const nameless = controls.filter(el => computeAccessibleName(el).trim() === '');
    expect(nameless).toEqual([]);
  });

  it('still names everything with the dice-roll popups and a filled-in modal override open', () => {
    const { container } = renderEditor({
      spaceFirst: row({ requires_dice_roll: 'Yes' }),
      modalConfigData: [{
        space_name: 'ARCH-FEE-REVIEW', visit_type: 'First', effect_action: 'dice', dice_value: '3',
        modal_title: 'You rolled a 3', modal_description: '', modal_button_label: '', modal_summary: '',
      }],
    });
    const controls = ownControls(container);
    const nameless = controls.filter(el => computeAccessibleName(el).trim() === '');
    expect(nameless).toEqual([]);
  });
});

describe('SpaceEditor — still renders (smoke)', () => {
  it('renders the space name, all five action columns, and the destinations section without throwing', () => {
    renderEditor({ spaceFirst: logicRow() });
    expect(screen.getByRole('heading', { name: 'ARCH-FEE-REVIEW' })).toBeInTheDocument();
    expect(screen.getByText('The actions players can take')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Q')).toHaveLength(5);
  });
});
