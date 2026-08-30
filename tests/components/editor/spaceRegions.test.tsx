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

// ---------------------------------------------------------------------------
// Working in a field the panel would not otherwise be showing.
//
// The preview draws what a PLAYER would see, so anything unset was simply not
// drawn — and clicking into its (blank) fields lit nothing. Reported
// 2026-08-30: "it displays only if it already exists. if the item is currently
// blank it does not open up a new area to show. and it does not expand the
// view if it was colappsed."
//
// Two fixes, pinned here: a placeholder slot for the region being edited, and
// a fold-out that opens itself when its own fields take the cursor.
// ---------------------------------------------------------------------------
describe('the part being edited is always somewhere you can see it', () => {
  const preview = (over: Partial<SpaceRow>, editingRegion?: string | null, modalConfigData: ModalConfigRow[] = []) =>
    render(
      <PlayerPreviewPanel
        currentSpace={row(over)}
        visitType="First"
        diceRollData={[]}
        modalConfigData={modalConfigData}
        onEditRegion={vi.fn()}
        editingRegion={editingRegion}
      />
    );

  const regionEl = (c: HTMLElement, id: string) => c.querySelector(`[data-region-id="${id}"]`);

  describe('a slot that does not exist yet', () => {
    it('stays out of the way while nothing is being edited', () => {
      // All five actions blank. The panel must look exactly as it did: a
      // player sees no scope-worktypes action here, so neither does the editor.
      const { container } = preview({ w_card: '', b_card: '', i_card: '', l_card: '', e_card: '' }, null);
      expect(regionEl(container, 'action-W')).toBeNull();
      expect(container.textContent).not.toContain('nothing set here yet');
    });

    it('appears, lit, for the blank action whose fields hold the cursor', () => {
      const { container } = preview({ w_card: '', b_card: '', i_card: '', l_card: '', e_card: '' }, 'action-W');
      const ghost = regionEl(container, 'action-W');
      expect(ghost).toBeTruthy();
      expect(ghost!.textContent).toContain('nothing set here yet');
      // Lit the same way every other edited part is — one mechanism, not two.
      expect(ghost!.className).toContain('space-region--being-edited');
    });

    it('appears for ONLY that one, never for every unset action at once', () => {
      // The whole reason this is scoped to the edited region: five permanent
      // grey rows is the crowding v3.2.35 was told off for.
      const { container } = preview({ w_card: '', b_card: '', i_card: '', l_card: '', e_card: '' }, 'action-W');
      expect(container.querySelectorAll('[data-region-id^="action-"]')).toHaveLength(1);
      expect(regionEl(container, 'action-B')).toBeNull();
      expect(regionEl(container, 'action-E')).toBeNull();
    });

    it('does not double up when the action is actually set', () => {
      const { container } = preview({ w_card: 'Draw 1' }, 'action-W');
      expect(container.querySelectorAll('[data-region-id="action-W"]')).toHaveLength(1);
      expect(container.textContent).not.toContain('nothing set here yet');
    });

    it('gives a blank space somewhere to point even with nothing else to do', () => {
      // No actions, no destinations — "Things you can do" would not render at
      // all, so the ghost has to bring its own section with it.
      const { container } = preview(
        { w_card: '', b_card: '', i_card: '', l_card: '', e_card: '', space_1: '', space_2: '' },
        'action-B',
      );
      expect(screen.getByText('Things you can do')).toBeTruthy();
      expect(regionEl(container, 'action-B')).toBeTruthy();
    });

    it('shows a pop-up the space never raises, so its wording can still be aimed at something', () => {
      // No l_card, so the life-event pop-up is not in the panel own list.
      const { container } = preview({ l_card: '' }, 'popup-L');
      const ghost = regionEl(container, 'popup-L');
      expect(ghost).toBeTruthy();
      expect(screen.getByText('Pop-ups players will see')).toBeTruthy();
      expect(ghost!.className).toContain('space-region--being-edited');
    });

    it('shows the negotiate button on a space where negotiating is off', () => {
      const { container } = preview({ Negotiate: 'NO' }, 'try-again');
      const ghost = regionEl(container, 'try-again');
      expect(ghost).toBeTruthy();
      expect(ghost!.textContent).toContain('negotiating is off for this space');
    });

    it('leaves again when the cursor moves to a part that is really there', () => {
      const blank = { w_card: '', b_card: '', i_card: '', l_card: '', e_card: '' };
      const { container, rerender } = preview(blank, 'action-W');
      expect(regionEl(container, 'action-W')).toBeTruthy();

      rerender(
        <PlayerPreviewPanel
          currentSpace={row(blank)}
          visitType="First"
          diceRollData={[]}
          modalConfigData={[]}
          onEditRegion={vi.fn()}
          editingRegion="story"
        />
      );
      expect(regionEl(container, 'action-W')).toBeNull();
    });
  });

  describe('a section folded away', () => {
    it('opens itself when its own fields take the cursor', () => {
      // "What to do & why" starts shut, matching what a player first sees.
      const { container } = preview({}, null);
      expect(container.textContent).not.toContain('What to do:');

      const opened = preview({}, 'guidance');
      expect(opened.container.textContent).toContain('What to do:');
      expect(opened.container.textContent).toContain('Pay the fee, or push back.');
    });

    it('opens the movement list when a destination field takes the cursor', () => {
      // Two destinations, so the panel draws the collapsible "Move — N options".
      const { container } = preview({ space_1: 'ARCH-SCOPE-CHECK', space_2: 'ARCH-DONE' }, null);
      expect(container.textContent).toContain('Move — 2 options');

      const opened = preview({ space_1: 'ARCH-SCOPE-CHECK', space_2: 'ARCH-DONE' }, 'destinations');
      // The individual destinations are now visible rather than folded away.
      expect(opened.container.textContent).toMatch(/Scope Check/);
    });

    it('can still be closed by its own button afterwards', () => {
      // The reason auto-opening adjusts state during render instead of in an
      // effect. An effect re-runs on every re-render while the cursor sits in
      // those fields, forcing the section back open and making the fold-out's
      // own button useless. Opening once, by setting the same state the button
      // sets, leaves the button working.
      const { container } = preview({}, 'guidance');
      expect(container.textContent).toContain('What to do:');

      fireEvent.click(screen.getByRole('button', { name: /What to do & why/ }));
      expect(container.textContent).not.toContain('What to do:');
    });

    it('stays open when the cursor moves on, rather than snapping shut', () => {
      const { container, rerender } = preview({}, 'guidance');
      expect(container.textContent).toContain('What to do:');

      rerender(
        <PlayerPreviewPanel
          currentSpace={row()}
          visitType="First"
          diceRollData={[]}
          modalConfigData={[]}
          onEditRegion={vi.fn()}
          editingRegion="story"
        />
      );
      expect(container.textContent).toContain('What to do:');
    });
  });
});
