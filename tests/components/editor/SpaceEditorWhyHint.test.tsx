// The teacher's "Why this happens" box shows the standard text as a grey hint (v3.8.54).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { SpaceEditor } from '../../../src/components/editor/SpaceEditor';
import { parseStandardWhy } from '../../../src/components/editor/utils/standardWhy';
import type { SpaceRow } from '../../../src/components/editor/types/EditorTypes';

const CSV = 'action_type,action_value,button_label,tooltip_why,tooltip_context\r\n'
  + 'choice,REG-DOB-AUDIT,Go,Some other row,\r\n'
  + 'why,REG-DOB-AUDIT,Why this happens,"A clean audit, then on you go.",\r\n';

const row = (over: Partial<SpaceRow> = {}): SpaceRow => ({
  space_name: 'REG-DOB-AUDIT', phase: 'REGULATORY', visit_type: 'First', Title: 'T', Event: 'E', Action: 'A', Outcome: 'O',
  w_card: '', b_card: '', i_card: '', l_card: '', e_card: '', Time: '', Fee: '',
  space_1: '', space_2: '', space_3: '', space_4: '', space_5: '',
  Negotiate: '', requires_dice_roll: '', path: 'Main', rolls: '', end_turn_label: '', try_again_label: '',
  w_card_label: '', b_card_label: '', i_card_label: '', l_card_label: '', e_card_label: '',
  shake_on: '', tts_field: '',
  w_card_narrative: '', b_card_narrative: '', i_card_narrative: '', l_card_narrative: '', e_card_narrative: '',
  ...over,
});

function draw(over: Partial<SpaceRow> = {}) {
  render(
    <SpaceEditor spaceFirst={row(over)} spaceSubsequent={null} visitType="First" allSpaceNames={['REG-DOB-AUDIT']}
      diceRollData={[]} modalConfigData={[]} onVisitTypeChange={vi.fn()} onFieldChange={vi.fn()} displayLabelOverride=""
      onDisplayLabelChange={vi.fn()} onUpdateDiceRoll={vi.fn()} onAddDiceRoll={vi.fn()} onDeleteDiceRoll={vi.fn()}
      onModalConfigChange={vi.fn()} />
  );
}

describe('teacher "Why this happens" hint', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => CSV })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('reads only the why rows', () => {
    expect(parseStandardWhy(CSV)).toEqual({ 'REG-DOB-AUDIT': 'A clean audit, then on you go.' });
  });

  it('shows the standard text grey while the box is empty, and the box itself stays empty', async () => {
    draw();
    const area = await waitFor(() => {
      const el = document.querySelector('[data-editor-anchor="field:Why"] textarea') as HTMLTextAreaElement;
      expect(el.placeholder).toBe('A clean audit, then on you go.');
      return el;
    });
    expect(area.value).toBe('');
  });

  it('a space with no standard text gets no hint', async () => {
    draw({ space_name: 'OWNER-X' });
    await new Promise((r) => setTimeout(r, 20));
    const el = document.querySelector('[data-editor-anchor="field:Why"] textarea') as HTMLTextAreaElement;
    expect(el.placeholder).toBe('');
  });
});
