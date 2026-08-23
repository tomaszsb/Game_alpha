// tests/components/editor/spaceRegions.test.tsx
//
// One map, read from both ends.
//
// The player view and the editing fields both have to agree about which
// fields make which part of the panel. They agree by both reading
// src/components/editor/spaceRegions.ts and nothing else. These tests pin
// that: the map's anchors actually exist in the editor, the editor reports
// anchors the map recognises, and clicking a part of the player view lands on
// the field the map names.
//
// This is the "parallel-systems audit" habit from docs/core/CLAUDE.md applied
// before the drift rather than after it.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpaceEditor } from '../../../src/components/editor/SpaceEditor';
import { PlayerPreviewPanel } from '../../../src/components/editor/PlayerPreviewPanel';
import {
  SPACE_REGIONS, firstAnchorOf, regionForAnchor, regionForField,
  fieldsOfRegion, editRegionLabel,
} from '../../../src/components/editor/spaceRegions';
import type { SpaceRow, ModalConfigRow } from '../../../src/components/editor/types/EditorTypes';

const row = (over: Partial<SpaceRow> = {}): SpaceRow => ({
  space_name: 'ARCH-FEE-REVIEW', phase: 'DESIGN', visit_type: 'First',
  Title: "Let's talk about my fee", Event: 'We need to talk money.',
  Action: 'Pay the fee, or push back.', Outcome: 'Fee agreed.',
  w_card: 'Draw 1', b_card: '', i_card: '', l_card: '', e_card: '',
  Time: '3 days', Fee: '5%',
  space_1: 'ARCH-SCOPE-CHECK', space_2: 'ARCH-DONE', space_3: '', space_4: '', space_5: '',
  Negotiate: 'YES', requires_dice_roll: 'No', path: 'Main', rolls: '',
  end_turn_label: '', try_again_label: '',
  w_card_label: '', b_card_label: '', i_card_label: '', l_card_label: '', e_card_label: '',
  shake_on: '', tts_field: '',
  w_card_narrative: '', b_card_narrative: '', i_card_narrative: '', l_card_narrative: '', e_card_narrative: '',
  ...over,
});

function renderEditor(props: Partial<React.ComponentProps<typeof SpaceEditor>> = {}) {
  const onFieldChange = vi.fn();
  const onEdited = vi.fn();
  const view = render(
    <SpaceEditor
      // Every action switched on, so every spot the map names is on screen —
      // the point of the check is the map, not which actions a space happens
      // to deal.
      spaceFirst={row({
        requires_dice_roll: 'Yes', rolls: '1',
        w_card: 'Draw 1', b_card: 'Draw 1', i_card: 'Draw 1', l_card: 'Draw 1', e_card: 'Draw 1',
      })}
      spaceSubsequent={null}
      visitType="First"
      allSpaceNames={['ARCH-FEE-REVIEW', 'ARCH-SCOPE-CHECK', 'ARCH-DONE']}
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
      onEdited={onEdited}
      {...props}
    />
  );
  return { ...view, onFieldChange, onEdited };
}

describe('the one map of which fields make which part', () => {
  it('never claims the same spot for two different parts', () => {
    const seen = new Map<string, string>();
    for (const region of SPACE_REGIONS) {
      for (const anchor of region.anchors) {
        expect(seen.has(anchor), `${anchor} is claimed by both ${seen.get(anchor)} and ${region.id}`)
          .toBe(false);
        seen.set(anchor, region.id);
      }
    }
  });

  it('reads the same both ways round', () => {
    for (const region of SPACE_REGIONS) {
      for (const anchor of region.anchors) {
        expect(regionForAnchor(anchor)?.id).toBe(region.id);
      }
      for (const field of fieldsOfRegion(region.id)) {
        expect(regionForField(field)?.id).toBe(region.id);
      }
      expect(firstAnchorOf(region.id)).toBe(region.anchors[0]);
    }
  });

  it('says out loud what each part opens, in plain words', () => {
    for (const region of SPACE_REGIONS) {
      const spoken = editRegionLabel(region.id);
      expect(spoken.startsWith('Edit ')).toBe(true);
      // No jargon in anything a person hears or reads.
      expect(spoken).not.toMatch(/region|field id|selector|anchor/i);
    }
  });

  it('knows nothing about a part that is not on the map', () => {
    expect(firstAnchorOf('not-a-part')).toBeNull();
    expect(regionForAnchor('field:made_up')).toBeNull();
  });
});

describe('the editing fields carry every spot the map names', () => {
  it('every anchor on the map exists in the editor', () => {
    const { container } = renderEditor();
    const missing: string[] = [];
    for (const region of SPACE_REGIONS) {
      for (const anchor of region.anchors) {
        if (!container.querySelector(`[data-editor-anchor="${anchor}"]`)) missing.push(anchor);
      }
    }
    expect(missing).toEqual([]);
  });

  it('reports the spot it changed, and the map recognises it', () => {
    const { container, onEdited } = renderEditor();
    const story = container.querySelector('[data-editor-anchor="field:Event"] textarea');
    fireEvent.change(story!, { target: { value: 'A new story.' } });
    expect(onEdited).toHaveBeenCalledWith('field:Event');
    expect(regionForAnchor('field:Event')?.id).toBe('story');
  });
});

describe('clicking the player view', () => {
  const preview = (over: Partial<SpaceRow> = {}, onEditRegion?: (id: string) => void) =>
    render(
      <PlayerPreviewPanel
        currentSpace={row(over)}
        visitType="First"
        diceRollData={[]}
        modalConfigData={[]}
        onEditRegion={onEditRegion}
      />
    );

  it('offers a real, named control for each part it shows', () => {
    preview({}, vi.fn());
    // Named by what it opens, so it is usable without seeing the panel.
    expect(screen.getByRole('button', { name: 'Edit what players read here' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit what this costs' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit what to do and why' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit where they go next' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit the button that ends the turn' })).toBeTruthy();
  });

  it('asks for the part the map knows, not for a field of its own choosing', () => {
    const onEditRegion = vi.fn();
    preview({}, onEditRegion);
    fireEvent.click(screen.getByRole('button', { name: 'Edit what players read here' }));
    expect(onEditRegion).toHaveBeenCalledWith('story');
    expect(firstAnchorOf('story')).toBe('field:Title');
  });

  it('is only a picture when there is nothing to open', () => {
    preview();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();
  });
});

describe('what the pop-ups say is visible', () => {
  const config: ModalConfigRow[] = [{
    space_name: 'ARCH-FEE-REVIEW', visit_type: 'First', effect_action: 'deduct',
    modal_title: 'The filing fee is due',
    modal_description: 'The department takes its cut before the review starts.',
    modal_button_label: 'Pay it', modal_summary: 'Paid in full.', dice_value: '',
  }];

  it('shows the words a pop-up will say, and says they are a pop-up', () => {
    render(
      <PlayerPreviewPanel
        currentSpace={row()}
        visitType="First"
        diceRollData={[]}
        modalConfigData={config}
      />
    );
    expect(screen.getByText('Pop-ups players will see')).toBeTruthy();
    expect(screen.getByText('The filing fee is due')).toBeTruthy();
    expect(screen.getByText('The department takes its cut before the review starts.')).toBeTruthy();
    expect(screen.getByText('Pay it')).toBeTruthy();
  });

  it('opens its wording boxes through the same map as everything else', () => {
    const onEditRegion = vi.fn();
    render(
      <PlayerPreviewPanel
        currentSpace={row()}
        visitType="First"
        diceRollData={[]}
        modalConfigData={config}
        onEditRegion={onEditRegion}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit the pop-up when a fee is charged' }));
    expect(onEditRegion).toHaveBeenCalledWith('popup-fee');
    expect(firstAnchorOf('popup-fee')).toBe('modal:deduct');
  });
});
