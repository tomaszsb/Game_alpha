// tests/components/editor/SpaceEditorFieldVisibility.test.tsx
//
// The one editor, seen by two kinds of person.
//
// There used to be two editors — a small one with six fields and a big one
// with about forty — and pressing the wrong button got you the wrong set of
// boxes. The small one is gone. What it was protecting is not: the six fields
// were the teacher-layer spec's deliberate safe subset, so that a teacher
// rewriting words for their own classroom cannot rewire where the board leads.
//
// That intent now lives as a prop on the ONE editor. These tests pin both
// halves of it — everything shown when nothing is asked for, only the safe
// subset when it is — plus the "you changed this, put it back" marking the
// removed editor contributed.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpaceEditor, SAFE_FIELD_SUBSET } from '../../../src/components/editor/SpaceEditor';
import { EDITABLE_FIELDS } from '../../../server/instanceCatalog.js';
import type { SpaceRow } from '../../../src/components/editor/types/EditorTypes';

const row = (over: Partial<SpaceRow> = {}): SpaceRow => ({
  space_name: 'ARCH-FEE-REVIEW', phase: 'DESIGN', visit_type: 'First',
  Title: "Let's talk about my fee", Event: 'We need to talk money.',
  Action: 'Pay the fee, or push back.', Outcome: 'Fee agreed.',
  w_card: '', b_card: '', i_card: '', l_card: '', e_card: '',
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
  const onFieldChange = vi.fn();
  const first = props.spaceFirst === undefined ? row() : props.spaceFirst;
  render(
    <SpaceEditor
      spaceFirst={first}
      spaceSubsequent={null}
      visitType="First"
      allSpaceNames={['ARCH-FEE-REVIEW', 'ARCH-SCOPE-CHECK']}
      diceRollData={[]}
      modalConfigData={[]}
      onVisitTypeChange={vi.fn()}
      onFieldChange={onFieldChange}
      displayLabelOverride=""
      onDisplayLabelChange={vi.fn()}
      onUpdateDiceRoll={vi.fn()}
      onAddDiceRoll={vi.fn()}
      onDeleteDiceRoll={vi.fn()}
      onModalConfigChange={vi.fn()}
      {...props}
    />
  );
  return { onFieldChange };
}

describe('SpaceEditor — how much of it you can see', () => {
  it('the safe subset is exactly what the server calls editable', () => {
    // Two copies of one list would drift, and the one that drifted would be
    // the one deciding what a teacher may rewrite.
    expect(SAFE_FIELD_SUBSET).toEqual(EDITABLE_FIELDS);
  });

  it('shows everything when no subset is asked for (the admin case)', () => {
    renderEditor();
    expect(screen.getByText('🏷️ Identity & Config')).toBeInTheDocument();
    expect(screen.getByText('🚶 Movement Destinations')).toBeInTheDocument();
    expect(screen.getByText('🎮 Button Labels')).toBeInTheDocument();
    expect(screen.getByText('🃏 (C) Actions')).toBeInTheDocument();
    expect(screen.getByTestId('space-tile-label-input')).toBeInTheDocument();
  });

  it('shows only the safe subset when one is asked for (the teacher case)', () => {
    renderEditor({ visibleFields: SAFE_FIELD_SUBSET });

    // What a space SAYS and what it COSTS stay.
    expect(screen.getByText('Story title (subtitle, per visit)')).toBeInTheDocument();
    expect(screen.getByText('Event (Story)')).toBeInTheDocument();
    expect(screen.getByText('⏱️ Time')).toBeInTheDocument();
    expect(screen.getByText('💰 Fee')).toBeInTheDocument();

    // Everything that decides how a space BEHAVES goes — above all, where it
    // leads, which is the whole reason the subset exists.
    expect(screen.queryByText('🚶 Movement Destinations')).toBeNull();
    expect(screen.queryByText('🏷️ Identity & Config')).toBeNull();
    expect(screen.queryByText('🎮 Button Labels')).toBeNull();
    expect(screen.queryByText('❓ Choice Modal')).toBeNull();
    expect(screen.queryByText('🤝 Negotiation Modal')).toBeNull();
    expect(screen.queryByText('🏁 End Game Modal')).toBeNull();
    expect(screen.queryByText('🃏 (C) Actions')).toBeNull();
    // Renaming the board tile changes what the whole table looks at.
    expect(screen.queryByTestId('space-tile-label-input')).toBeNull();
  });

  it('hides the dice editors from the subset even on a dice space', () => {
    renderEditor({
      spaceFirst: row({ requires_dice_roll: 'Yes' }),
      visibleFields: SAFE_FIELD_SUBSET,
    });
    expect(screen.queryByText('🎲 (D) Actions')).toBeNull();
    expect(screen.queryByText('🎲 Dice Outcome Modals')).toBeNull();
  });
});

describe('SpaceEditor — "you changed this, put it back"', () => {
  const original = { First: { Title: "Let's talk about my fee", Event: 'We need to talk money.', Time: '3 days', Fee: '5%' } };

  it('marks nothing when the original is not to hand', () => {
    renderEditor({ spaceFirst: row({ Title: 'Rewritten' }) });
    expect(screen.queryByRole('button', { name: 'changed — put back' })).toBeNull();
  });

  it('marks nothing when the field still says what the original says', () => {
    renderEditor({ original });
    expect(screen.queryByRole('button', { name: 'changed — put back' })).toBeNull();
  });

  it('marks a changed field, names what the original said, and puts it back on its own', () => {
    const { onFieldChange } = renderEditor({ spaceFirst: row({ Title: 'Rewritten' }), original });

    const marks = screen.getAllByRole('button', { name: 'changed — put back' });
    expect(marks).toHaveLength(1); // only Title differs
    expect(marks[0]).toHaveAttribute('title', "The original says: Let's talk about my fee");

    fireEvent.click(marks[0]);
    expect(onFieldChange).toHaveBeenCalledWith('First', 'Title', "Let's talk about my fee");
  });

  it('marks a changed fee the same way — the cost is part of what a space says', () => {
    const { onFieldChange } = renderEditor({ spaceFirst: row({ Fee: '9%' }), original });
    const mark = screen.getByRole('button', { name: 'changed — put back' });
    fireEvent.click(mark);
    expect(onFieldChange).toHaveBeenCalledWith('First', 'Fee', '5%');
  });
});
