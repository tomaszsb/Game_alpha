import { describe, it, expect } from 'vitest';
import { exportSpacesCSV, exportDiceRollCSV } from '../../../src/components/editor/utils/csvExport';
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
});
