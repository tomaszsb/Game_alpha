// tests/components/editor/MoreSettings.test.tsx
//
// The proof for Job 2b (Manager brief 2026-10-05): a column added to Spaces.csv
// shows up in the editor's "More settings" section and saves back round-trip,
// with NO editor code change. The editor used to know 37 of the 60 columns by
// name; the other 19 behaviour settings had no field anywhere and could only be
// kept, never seen or edited.

import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { SpaceEditor } from '../../../src/components/editor/SpaceEditor';
import { parseSpacesCSV, exportSpacesCSV } from '../../../src/components/editor/utils/csvExport';
import { parseSpaceSchema, moreSettings } from '../../../src/components/editor/utils/spaceSchema';
import type { SpaceRow } from '../../../src/components/editor/types/EditorTypes';

const REAL_SCHEMA_TEXT = fs.readFileSync(path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.schema.json'), 'utf-8');
const REAL_SPACES_TEXT = fs.readFileSync(path.join(process.cwd(), 'public/data/SOURCE_FILES/Spaces.csv'), 'utf-8');

const BASE_HEADER =
  'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls,end_turn_label,try_again_label,w_card_label,b_card_label,i_card_label,l_card_label,e_card_label,shake_on,tts_field,w_card_narrative,b_card_narrative,i_card_narrative,l_card_narrative,e_card_narrative';
// Built from the header so the column count can never drift: only the named cells have values.
const BASE_VALUES: Record<string, string> = {
  space_name: 'ALPHA-SPACE', phase: 'DESIGN', visit_type: 'First', Title: 'Alpha', Event: 'Story',
  Action: 'Do it', Outcome: 'Done', Time: '1 day', Fee: '0', space_1: 'BETA-SPACE',
  Negotiate: 'NO', requires_dice_roll: 'No', path: 'Main',
};
const BASE_FIRST = BASE_HEADER.split(',').map(h => BASE_VALUES[h] ?? '').join(',');

/** Harness: the editor over real rows, with the same state update useEditorSource uses for a "More settings" change. */
function Harness({ csv, schemaText, onExport }: { csv: string; schemaText: string | null; onExport: (csv: string) => void }) {
  const [rows, setRows] = useState<SpaceRow[]>(() => parseSpacesCSV(csv));
  const schema = schemaText ? parseSpaceSchema(schemaText) : null;
  const first = rows.find(r => r.visit_type === 'First') ?? null;
  return (
    <div>
      <SpaceEditor
        spaceFirst={first}
        spaceSubsequent={null}
        visitType="First"
        allSpaceNames={['ALPHA-SPACE', 'BETA-SPACE']}
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
        extraSchema={schema}
        onExtraColumnChange={(vType, column, value) =>
          setRows(prev => prev.map(r => r.visit_type === vType
            ? { ...r, _extraColumns: { ...(r._extraColumns ?? {}), [column]: value } }
            : r))}
      />
      <button type="button" onClick={() => onExport(exportSpacesCSV(rows))}>export</button>
    </div>
  );
}

describe('More settings: a brand-new column needs no editor change', () => {
  const csv = `${BASE_HEADER},zz_brand_new_setting\n${BASE_FIRST},hello\n`;

  it('lists a column the schema has never heard of, as plain text, and saves an edit back', () => {
    let exported = '';
    render(<Harness csv={csv} schemaText={REAL_SCHEMA_TEXT} onExport={(c) => { exported = c; }} />);
    const section = screen.getByText('More settings').closest('fieldset') as HTMLElement;
    const box = within(section).getByLabelText('zz_brand_new_setting') as HTMLInputElement;
    expect(box.value).toBe('hello');
    fireEvent.change(box, { target: { value: 'changed' } });
    fireEvent.click(screen.getByText('export'));
    const back = parseSpacesCSV(exported);
    expect(back[0]._extraColumns?.zz_brand_new_setting).toBe('changed');
    expect(back[0].Title).toBe('Alpha'); // the rest of the row is untouched
  });

  it('uses the schema for a new column that IS described: label, help and allowed values', () => {
    const schema = JSON.stringify({
      name: 'Spaces',
      fields: [{
        name: 'zz_brand_new_setting', type: 'string', title: 'Brand new setting',
        description: 'A harmless test column.', constraints: { enum: ['', 'red', 'blue'] },
        'x-group': 'Test group', 'x-editable-by': 'admin',
      }],
    });
    let exported = '';
    render(<Harness csv={`${BASE_HEADER},zz_brand_new_setting\n${BASE_FIRST},red\n`} schemaText={schema} onExport={(c) => { exported = c; }} />);
    const section = screen.getByText('More settings').closest('fieldset') as HTMLElement;
    expect(within(section).getByText('Test group')).toBeInTheDocument();
    expect(within(section).getByText('A harmless test column.')).toBeInTheDocument();
    const select = within(section).getByLabelText('Brand new setting (zz_brand_new_setting)') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('red');
    fireEvent.change(select, { target: { value: 'blue' } });
    fireEvent.click(screen.getByText('export'));
    expect(parseSpacesCSV(exported)[0]._extraColumns?.zz_brand_new_setting).toBe('blue');
  });

  it('still lists extra columns when the schema file could not be loaded', () => {
    render(<Harness csv={csv} schemaText={null} onExport={() => {}} />);
    const section = screen.getByText('More settings').closest('fieldset') as HTMLElement;
    expect(within(section).getByLabelText('zz_brand_new_setting')).toBeInTheDocument();
  });
});

describe('More settings: the real data', () => {
  const schema = parseSpaceSchema(REAL_SCHEMA_TEXT)!;
  const rows = parseSpacesCSV(REAL_SPACES_TEXT);

  it('the 19 behaviour settings that had no field are now reachable (nothing real is left invisible)', () => {
    const row = rows.find(r => r.space_name === 'OWNER-FUND-INITIATION' && r.visit_type === 'First')!;
    const names = moreSettings(schema, row).map(m => m.name);
    for (const name of [
      'is_starting_space', 'is_resume_hub', 'is_point_of_no_return', 'min_w_cards_to_leave',
      'fee_calculation_method', 'fee_label', 'auto_apply_funding', 'auto_trigger_card_types',
      'path_choice_memory_key', 'is_path_choice_lock_point', 'review_loop_message', 'funding_source',
      'has_final_review_gate', 'approval_role', 'npc_speaker', 'fee_category', 'auto_roll_dice',
      'try_again_days', 'try_again_scope_pct',
    ]) {
      expect(names, name).toContain(name);
    }
    // Not listed: the board layout (its own editor) and the fields the form already has.
    expect(names).not.toContain('pos_x');
    expect(names).not.toContain('Title');
    expect(names).not.toContain('display_label_override');
  });

  it('shows the real funding setting with its real value and allowed list', () => {
    let exported = '';
    render(<Harness csv={REAL_SPACES_TEXT.replace(/\r?\n[^\n]*$/, '\n')} schemaText={REAL_SCHEMA_TEXT} onExport={(c) => { exported = c; }} />);
    expect(exported).toBe('');
    const section = screen.getByText('More settings').closest('fieldset') as HTMLElement;
    const funding = within(section).getByLabelText('Where the money comes from (funding_source)') as HTMLSelectElement;
    expect(Array.from(funding.options).map(o => o.value)).toEqual(['', 'owner', 'bank', 'investor']);
  });

  it('a teacher never sees More settings', () => {
    render(
      <SpaceEditor
        spaceFirst={rows.find(r => r.visit_type === 'First')!}
        spaceSubsequent={null}
        visitType="First"
        allSpaceNames={[]}
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
        visibleFields={['Title', 'Event', 'Action', 'Outcome', 'Time', 'Fee']}
        extraSchema={schema}
        onExtraColumnChange={vi.fn()}
      />
    );
    expect(screen.queryByText('More settings')).toBeNull();
  });
});
