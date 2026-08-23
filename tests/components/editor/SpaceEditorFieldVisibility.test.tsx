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
import { regionHeading, regionShortLabel } from '../../../src/components/editor/spaceRegions';
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
    expect(screen.getByText('How this space behaves')).toBeInTheDocument();
    expect(screen.getByText(regionHeading('destinations'))).toBeInTheDocument();
    expect(screen.getByText('The buttons that end the turn')).toBeInTheDocument();
    expect(screen.getByText('The actions players can take')).toBeInTheDocument();
    expect(screen.getByTestId('space-tile-label-input')).toBeInTheDocument();
  });

  // The maintainer's verdict on the merged screen was that it was "hard to
  // find things on the left that match things on the right" — the editor named
  // its sections after the data model while the player view named the same
  // things plainly. These headings are read off spaceRegions.ts precisely so
  // that a rename on one side cannot leave the other behind.
  it('heads its sections with the words the player view uses', () => {
    renderEditor({ spaceFirst: row({ requires_dice_roll: 'yes' }) });
    for (const id of ['story', 'guidance', 'cost', 'outcomes', 'destinations',
                      'popup-outcome', 'popup-choice', 'popup-negotiate', 'popup-end-game']) {
      expect(screen.getByText(regionHeading(id))).toBeInTheDocument();
    }
  });

  // Five columns that used to read "🏗️ W", "🏦 B", … against a player view
  // saying "The scope worktypes action".
  it('names each action column the way the player view names that action', () => {
    renderEditor();
    for (const type of ['W', 'B', 'I', 'L', 'E']) {
      expect(screen.getByText(regionShortLabel(`action-${type}`))).toBeInTheDocument();
    }
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
    expect(screen.queryByText(regionHeading('destinations'))).toBeNull();
    expect(screen.queryByText('How this space behaves')).toBeNull();
    expect(screen.queryByText('The buttons that end the turn')).toBeNull();
    expect(screen.queryByText(regionHeading('popup-choice'))).toBeNull();
    expect(screen.queryByText(regionHeading('popup-negotiate'))).toBeNull();
    expect(screen.queryByText(regionHeading('popup-end-game'))).toBeNull();
    expect(screen.queryByText('The actions players can take')).toBeNull();
    // Renaming the board tile changes what the whole table looks at.
    expect(screen.queryByTestId('space-tile-label-input')).toBeNull();
  });

  it('hides the dice editors from the subset even on a dice space', () => {
    renderEditor({
      spaceFirst: row({ requires_dice_roll: 'Yes' }),
      visibleFields: SAFE_FIELD_SUBSET,
    });
    expect(screen.queryByText(regionHeading('outcomes'))).toBeNull();
    expect(screen.queryByText(regionHeading('popup-outcome'))).toBeNull();
  });
});

// The panel already lit up when you TYPED. It said nothing when you merely
// clicked into a field — and a field you are still deciding what to write in is
// exactly when you want telling what it feeds. Maintainer, 2026-08-23:
// "nothing still shows what it is editing when the edit side is clicked on
// (i see it works in the reverse)".
describe('SpaceEditor — what the cursor is in', () => {
  it('names the part of the player view the focused field feeds', () => {
    const onFocusedRegion = vi.fn();
    renderEditor({ onFocusedRegion });

    fireEvent.focusIn(screen.getByDisplayValue('We need to talk money.'));
    expect(onFocusedRegion).toHaveBeenLastCalledWith('story');

    fireEvent.focusIn(screen.getByDisplayValue('Pay the fee, or push back.'));
    expect(onFocusedRegion).toHaveBeenLastCalledWith('guidance');
  });

  it('names the part from a section heading, which has no field of its own', () => {
    const onFocusedRegion = vi.fn();
    renderEditor({ onFocusedRegion });

    fireEvent.focusIn(screen.getByText(regionHeading('destinations')));
    expect(onFocusedRegion).toHaveBeenLastCalledWith('destinations');
  });

  it('says nothing for a section that feeds no part of the player view', () => {
    const onFocusedRegion = vi.fn();
    renderEditor({ onFocusedRegion });

    fireEvent.focusIn(screen.getByText('How this space behaves'));
    expect(onFocusedRegion).toHaveBeenLastCalledWith(null);
  });

  it('clears when the cursor leaves the editor, but not while it moves inside it', () => {
    const onFocusedRegion = vi.fn();
    renderEditor({ onFocusedRegion });

    const story = screen.getByDisplayValue('We need to talk money.');
    const guidance = screen.getByDisplayValue('Pay the fee, or push back.');
    fireEvent.focusIn(story);

    // Tabbing to the next field is not leaving; clearing here would drop the
    // highlight for a frame on every Tab.
    onFocusedRegion.mockClear();
    fireEvent.focusOut(story, { relatedTarget: guidance });
    expect(onFocusedRegion).not.toHaveBeenCalled();

    fireEvent.focusOut(story, { relatedTarget: document.body });
    expect(onFocusedRegion).toHaveBeenLastCalledWith(null);
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
