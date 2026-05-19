import { describe, it, expect } from 'vitest';
import {
  exportSpacesCSV,
  exportDiceRollCSV,
  parseSpacesCSV,
  parseDiceRollCSV
} from '../../../src/components/editor/utils/csvExport';
import { SpaceRow, DiceRollRow } from '../../../src/components/editor/types/EditorTypes';

describe('csvExport', () => {
  describe('exportSpacesCSV', () => {
    it('exports empty array with just headers', () => {
      const result = exportSpacesCSV([]);
      const lines = result.trim().split('\n');

      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('space_name');
      expect(lines[0]).toContain('phase');
      expect(lines[0]).toContain('visit_type');
    });

    it('exports single space row correctly', () => {
      const spaces: any[] = [{
        space_name: 'TEST-SPACE',
        phase: 'SETUP',
        visit_type: 'First',
        Event: 'Test event',
        Action: 'Test action',
        Outcome: 'Test outcome',
        w_card: 'Draw 1',
        b_card: '',
        i_card: '',
        l_card: '',
        e_card: '',
        Time: '5 days',
        Fee: '',
        space_1: 'NEXT-SPACE',
        space_2: '',
        space_3: '',
        space_4: '',
        space_5: '',
        Negotiate: 'YES',
        requires_dice_roll: 'Yes',
        path: 'Main',
        rolls: '1'
      }];

      const result = exportSpacesCSV(spaces);
      const lines = result.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(lines[1]).toContain('TEST-SPACE');
      expect(lines[1]).toContain('SETUP');
      expect(lines[1]).toContain('First');
      expect(lines[1]).toContain('Test event');
      expect(lines[1]).toContain('Draw 1');
      expect(lines[1]).toContain('NEXT-SPACE');
    });

    it('escapes commas in values', () => {
      const spaces: any[] = [{
        space_name: 'TEST-SPACE',
        phase: 'SETUP',
        visit_type: 'First',
        Event: 'Event with, comma',
        Action: 'Action',
        Outcome: 'Outcome',
        w_card: '',
        b_card: '',
        i_card: '',
        l_card: '',
        e_card: '',
        Time: '',
        Fee: '',
        space_1: '',
        space_2: '',
        space_3: '',
        space_4: '',
        space_5: '',
        Negotiate: 'NO',
        requires_dice_roll: 'No',
        path: 'Main',
        rolls: ''
      }];

      const result = exportSpacesCSV(spaces);

      expect(result).toContain('"Event with, comma"');
    });

    it('escapes quotes in values', () => {
      const spaces: any[] = [{
        space_name: 'TEST-SPACE',
        phase: 'SETUP',
        visit_type: 'First',
        Event: 'Event with "quotes"',
        Action: 'Action',
        Outcome: 'Outcome',
        w_card: '',
        b_card: '',
        i_card: '',
        l_card: '',
        e_card: '',
        Time: '',
        Fee: '',
        space_1: '',
        space_2: '',
        space_3: '',
        space_4: '',
        space_5: '',
        Negotiate: 'NO',
        requires_dice_roll: 'No',
        path: 'Main',
        rolls: ''
      }];

      const result = exportSpacesCSV(spaces);

      expect(result).toContain('"Event with ""quotes"""');
    });

    it('exports multiple space rows', () => {
      const spaces: any[] = [
        {
          space_name: 'SPACE-1',
          phase: 'SETUP',
          visit_type: 'First',
          Event: 'Event 1',
          Action: 'Action 1',
          Outcome: 'Outcome 1',
          w_card: '',
          b_card: '',
          i_card: '',
          l_card: '',
          e_card: '',
          Time: '',
          Fee: '',
          space_1: '',
          space_2: '',
          space_3: '',
          space_4: '',
          space_5: '',
          Negotiate: 'YES',
          requires_dice_roll: 'Yes',
          path: 'Main',
          rolls: '1'
        },
        {
          space_name: 'SPACE-1',
          phase: 'SETUP',
          visit_type: 'Subsequent',
          Event: 'Event 1 sub',
          Action: 'Action 1 sub',
          Outcome: 'Outcome 1 sub',
          w_card: '',
          b_card: '',
          i_card: '',
          l_card: '',
          e_card: '',
          Time: '',
          Fee: '',
          space_1: '',
          space_2: '',
          space_3: '',
          space_4: '',
          space_5: '',
          Negotiate: 'NO',
          requires_dice_roll: 'No',
          path: 'Main',
          rolls: ''
        }
      ];

      const result = exportSpacesCSV(spaces);
      const lines = result.trim().split('\n');

      expect(lines.length).toBe(3); // header + 2 rows
      expect(lines[1]).toContain('First');
      expect(lines[2]).toContain('Subsequent');
    });
  });

  describe('exportDiceRollCSV', () => {
    it('exports empty array with just headers', () => {
      const result = exportDiceRollCSV([]);
      const lines = result.trim().split('\n');

      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('space_name,die_roll,visit_type,1,2,3,4,5,6,button_label,roll_group');
    });

    it('exports single dice roll row correctly', () => {
      const diceRolls: DiceRollRow[] = [{
        space_name: 'TEST-SPACE',
        die_roll: 'W Cards',
        visit_type: 'First',
        roll_1: 'Draw 1',
        roll_2: 'Draw 1',
        roll_3: 'Draw 2',
        roll_4: 'Draw 2',
        roll_5: 'Draw 3',
        roll_6: 'Draw 3',
        button_label: '',
        roll_group: ''
      }];

      const result = exportDiceRollCSV(diceRolls);
      const lines = result.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(lines[1]).toBe('TEST-SPACE,W Cards,First,Draw 1,Draw 1,Draw 2,Draw 2,Draw 3,Draw 3,,');
    });

    it('exports multiple dice roll rows', () => {
      const diceRolls: DiceRollRow[] = [
        {
          space_name: 'SPACE-1',
          die_roll: 'W Cards',
          visit_type: 'First',
          roll_1: 'Draw 1',
          roll_2: 'Draw 1',
          roll_3: 'Draw 2',
          roll_4: 'Draw 2',
          roll_5: 'Draw 3',
          roll_6: 'Draw 3',
          button_label: '',
          roll_group: ''
        },
        {
          space_name: 'SPACE-1',
          die_roll: 'Next Step',
          visit_type: 'First',
          roll_1: 'SPACE-2',
          roll_2: 'SPACE-2',
          roll_3: 'SPACE-3',
          roll_4: 'SPACE-3',
          roll_5: 'SPACE-4',
          roll_6: 'SPACE-4',
          button_label: '',
          roll_group: ''
        }
      ];

      const result = exportDiceRollCSV(diceRolls);
      const lines = result.trim().split('\n');

      expect(lines.length).toBe(3); // header + 2 rows
      expect(lines[1]).toContain('W Cards');
      expect(lines[2]).toContain('Next Step');
    });

    it('handles empty roll values', () => {
      const diceRolls: DiceRollRow[] = [{
        space_name: 'TEST-SPACE',
        die_roll: 'Test',
        visit_type: 'First',
        roll_1: 'Value 1',
        roll_2: '',
        roll_3: '',
        roll_4: '',
        roll_5: '',
        roll_6: 'Value 6',
        button_label: '',
        roll_group: ''
      }];

      const result = exportDiceRollCSV(diceRolls);
      const lines = result.trim().split('\n');

      expect(lines[1]).toBe('TEST-SPACE,Test,First,Value 1,,,,,Value 6,,');
    });
  });

  describe('parseSpacesCSV → exportSpacesCSV round-trip', () => {
    // Regression for fb:2426489c. Spaces.csv has gained 16+ columns since the
    // editor was first written (is_starting_space, pos_x, funding_source, …).
    // A naive positional parser would silently strip them; this confirms the
    // header-aware parser captures them and the exporter writes them back.

    // Build the fixture column-by-column so column counts can't drift silently.
    const fixtureHeaders = [
      'space_name', 'phase', 'visit_type', 'Title', 'Event', 'Action', 'Outcome',
      'w_card', 'b_card', 'i_card', 'l_card', 'e_card',
      'Time', 'Fee',
      'space_1', 'space_2', 'space_3', 'space_4', 'space_5',
      'Negotiate', 'requires_dice_roll', 'path', 'rolls',
      'end_turn_label', 'try_again_label',
      'w_card_label', 'b_card_label', 'i_card_label', 'l_card_label', 'e_card_label',
      'shake_on', 'tts_field',
      'w_card_narrative', 'b_card_narrative', 'i_card_narrative', 'l_card_narrative', 'e_card_narrative',
      // Workstream 6 + Phase A + v2.65.6 additions (16 columns total)
      'is_starting_space', 'is_resume_hub', 'is_point_of_no_return',
      'min_w_cards_to_leave', 'fee_calculation_method', 'fee_label',
      'auto_apply_funding', 'auto_trigger_card_types',
      'path_choice_memory_key', 'is_path_choice_lock_point',
      'display_label_override', 'review_loop_message',
      'pos_x', 'pos_y', 'funding_source'
    ];

    const rowFromObj = (vals: Record<string, string>): string =>
      fixtureHeaders.map(h => vals[h] ?? '').join(',');

    const row1 = rowFromObj({
      space_name: 'OWNER-SCOPE-INITIATION',
      phase: 'OWNER',
      visit_type: 'First',
      Title: 'Owner Scope Initiation',
      w_card: 'Draw 3',
      space_1: 'DEST-1',
      Negotiate: 'YES',
      path: 'Main',
      end_turn_label: 'End Turn',
      try_again_label: 'Try Again',
      is_starting_space: 'YES',
      min_w_cards_to_leave: '3',
      path_choice_memory_key: 'scope',
      display_label_override: 'Scope',
      pos_x: '100',
      pos_y: '200',
      funding_source: 'owner'
    });

    const row2 = rowFromObj({
      space_name: 'OWNER-FUND-INITIATION',
      phase: 'FUNDING',
      visit_type: 'First',
      Title: 'Owner Fund Init',
      pos_x: '150',
      pos_y: '200',
      funding_source: 'owner'
    });

    const realSpacesCSV = [fixtureHeaders.join(','), row1, row2].join('\n') + '\n';

    it('round-trips a Spaces.csv with the 16 post-Workstream-6 columns intact', () => {
      const parsed = parseSpacesCSV(realSpacesCSV);
      expect(parsed.length).toBe(2);

      // Sanity: known columns parsed
      expect(parsed[0].space_name).toBe('OWNER-SCOPE-INITIATION');
      expect(parsed[0].phase).toBe('OWNER');
      expect(parsed[0].Title).toBe('Owner Scope Initiation');

      // Unknown columns captured into _extraColumns
      expect(parsed[0]._extraColumns).toBeDefined();
      expect(parsed[0]._extraColumns?.is_starting_space).toBe('YES');
      expect(parsed[0]._extraColumns?.min_w_cards_to_leave).toBe('3');
      expect(parsed[0]._extraColumns?.path_choice_memory_key).toBe('scope');
      expect(parsed[0]._extraColumns?.display_label_override).toBe('Scope');
      expect(parsed[0]._extraColumns?.pos_x).toBe('100');
      expect(parsed[0]._extraColumns?.pos_y).toBe('200');
      expect(parsed[0]._extraColumns?.funding_source).toBe('owner');

      // Export round-trip preserves every extra column header
      const exported = exportSpacesCSV(parsed);
      const headerLine = exported.split('\n')[0];

      for (const expectedHeader of [
        'is_starting_space', 'is_resume_hub', 'is_point_of_no_return',
        'min_w_cards_to_leave', 'fee_calculation_method', 'fee_label',
        'auto_apply_funding', 'auto_trigger_card_types',
        'path_choice_memory_key', 'is_path_choice_lock_point',
        'display_label_override', 'review_loop_message',
        'pos_x', 'pos_y', 'funding_source'
      ]) {
        expect(headerLine).toContain(expectedHeader);
      }

      // Values survive the round-trip
      expect(exported).toContain('owner');
      expect(exported).toContain('100');
      expect(exported).toContain('200');
      expect(exported).toContain('scope');
    });

    it('round-tripping unchanged rows reproduces the same column count', () => {
      const parsed = parseSpacesCSV(realSpacesCSV);
      const exported = exportSpacesCSV(parsed);

      const originalHeaders = realSpacesCSV.split('\n')[0].split(',');
      const exportedHeaders = exported.split('\n')[0].split(',');

      expect(exportedHeaders.length).toBe(originalHeaders.length);
      // Same set of headers (order may differ — known first, then extras).
      expect(new Set(exportedHeaders)).toEqual(new Set(originalHeaders));
    });

    it('preserves _extraColumns when no rows have extras', () => {
      const minimalCSV =
        'space_name,phase,visit_type,Title,Event,Action,Outcome,w_card,b_card,i_card,l_card,e_card,Time,Fee,space_1,space_2,space_3,space_4,space_5,Negotiate,requires_dice_roll,path,rolls,end_turn_label,try_again_label,w_card_label,b_card_label,i_card_label,l_card_label,e_card_label,shake_on,tts_field,w_card_narrative,b_card_narrative,i_card_narrative,l_card_narrative,e_card_narrative\n' +
        'X,Y,First,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,\n';
      const parsed = parseSpacesCSV(minimalCSV);
      expect(parsed[0]._extraColumns).toBeUndefined();
      const exported = exportSpacesCSV(parsed);
      expect(exported.split('\n')[0].split(',').length).toBe(37);
    });
  });

  describe('parseDiceRollCSV', () => {
    it('parses standard DiceRoll Info.csv', () => {
      const csv =
        'space_name,die_roll,visit_type,1,2,3,4,5,6,button_label,roll_group\n' +
        'SPACE-A,W Cards,First,Draw 1,Draw 1,Draw 2,Draw 2,Draw 3,Draw 3,Roll for W,\n';
      const parsed = parseDiceRollCSV(csv);
      expect(parsed.length).toBe(1);
      expect(parsed[0].space_name).toBe('SPACE-A');
      expect(parsed[0].roll_1).toBe('Draw 1');
      expect(parsed[0].roll_6).toBe('Draw 3');
      expect(parsed[0].button_label).toBe('Roll for W');
    });

    it('strips BOM from header', () => {
      const csv =
        '﻿space_name,die_roll,visit_type,1,2,3,4,5,6,button_label,roll_group\n' +
        'SPACE-A,W,First,a,b,c,d,e,f,,\n';
      const parsed = parseDiceRollCSV(csv);
      expect(parsed.length).toBe(1);
      expect(parsed[0].space_name).toBe('SPACE-A');
    });
  });
});
