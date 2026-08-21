// tests/server/instanceCatalog.test.ts
// Phase 2 catalog composition — the Classroom Setup screen's data source.
// Pins: full deck including off spaces, classroom state per card,
// protection passed through, safe-subset stock fields only.

import { describe, it, expect } from 'vitest';
import { buildCatalog, EDITABLE_FIELDS } from '../../server/instanceCatalog.js';

const HEADER =
  'space_name,phase,visit_type,Title,Event,Action,Outcome,Time,Fee,space_1,' +
  'is_starting_space,is_ending_space,is_resume_hub,path_choice_memory_key,is_path_choice_lock_point,secret_col';

const STOCK = [
  HEADER,
  'ALPHA-START,SETUP,First,Start,Begin.,Go,Done,1,0,BETA-MIDDLE,Yes,No,No,,No,hidden1',
  'BETA-MIDDLE,SETUP,First,Middle,Mid.,Go,Done,2,50,ZETA-END,No,No,No,,No,hidden2',
  'BETA-MIDDLE,SETUP,Subsequent,Middle,Again.,Go,Done,1,25,ZETA-END,No,No,No,,No,hidden3',
  'ZETA-END,CONSTRUCTION,First,End,Fin.,Go,Done,0,0,,No,Yes,No,,No,hidden4',
].join('\n') + '\n';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseConfig = (): any => ({
  meta: { id: 'classroom-1' },
  configVersion: 3,
  slots: {},
  teacherCopies: {},
  detours: {},
});

describe('buildCatalog', () => {
  it('lists the FULL deck including switched-off spaces, with state per card', () => {
    const config = baseConfig();
    config.slots['BETA-MIDDLE'] = { used: false };
    config.detours['BETA-MIDDLE'] = 'ZETA-END';

    const catalog = buildCatalog({ stockSpacesCsv: STOCK, config, stockVersion: 'v1' });
    expect(catalog.spaces.map(s => s.name)).toEqual(['ALPHA-START', 'BETA-MIDDLE', 'ZETA-END']);

    const beta = catalog.spaces.find(s => s.name === 'BETA-MIDDLE')!;
    expect(beta).toMatchObject({ used: false, detour: 'ZETA-END', copyId: null, phase: 'SETUP', title: 'Middle' });
    // Both visit rows' safe-subset values come along for the copy editor.
    expect(beta.stock['First']).toMatchObject({ Title: 'Middle', Fee: '50' });
    expect(beta.stock['Subsequent']).toMatchObject({ Fee: '25' });
  });

  it('exposes only the safe field subset — no other stock columns leak', () => {
    const catalog = buildCatalog({ stockSpacesCsv: STOCK, config: baseConfig() });
    for (const space of catalog.spaces) {
      for (const fields of Object.values(space.stock)) {
        expect(Object.keys(fields).sort()).toEqual([...EDITABLE_FIELDS].sort());
      }
    }
    expect(JSON.stringify(catalog)).not.toContain('hidden1');
  });

  it('carries protection so the UI can disable forbidden switches with reasons', () => {
    const catalog = buildCatalog({ stockSpacesCsv: STOCK, config: baseConfig() });
    expect(catalog.spaces.find(s => s.name === 'ALPHA-START')!.protection).toMatchObject({ tier: 'structural' });
    expect(catalog.spaces.find(s => s.name === 'ZETA-END')!.protection).toMatchObject({ tier: 'structural' });
    expect(catalog.spaces.find(s => s.name === 'BETA-MIDDLE')!.protection).toBeNull();
  });

  it('lists fixed A→B edges for splicing and the existing insertions (Phase 4a)', () => {
    const config = baseConfig();
    config.insertions = {
      'AUTH-CLASSROOM-1-1': { id: 'AUTH-CLASSROOM-1-1', displayName: 'Hearing', from: 'BETA-MIDDLE', to: 'ZETA-END' },
    };
    const catalog = buildCatalog({ stockSpacesCsv: STOCK, config }) as any;
    expect(catalog.edges).toEqual([
      { from: 'ALPHA-START', to: 'BETA-MIDDLE', dice: false },
      { from: 'BETA-MIDDLE', to: 'ZETA-END', dice: false },
    ]);
    expect(catalog.insertions['AUTH-CLASSROOM-1-1']).toMatchObject({ displayName: 'Hearing', from: 'BETA-MIDDLE', to: 'ZETA-END' });
  });

  it('defaults insertions to an empty object and never leaks hidden columns into edges', () => {
    const catalog = buildCatalog({ stockSpacesCsv: STOCK, config: baseConfig() }) as any;
    expect(catalog.insertions).toEqual({});
    expect(JSON.stringify(catalog.edges)).not.toContain('hidden');
  });

  it('enumerates dice-table edges (4b) and never offers a lock-point source', () => {
    // P-ROLL is a dice source whose destinations live only in the dice table;
    // P-LOCK is a path-choice lock point that must never be offered for splicing.
    const DICE_HEADER =
      'space_name,phase,visit_type,Title,Event,Action,Outcome,Time,Fee,space_1,space_2,' +
      'requires_dice_roll,is_path_choice_lock_point';
    // P-FEE has requires_dice_roll=Yes but only an *effect* roll (Fees Paid) —
    // it still moves along its fixed space_1 (P-END), so that edge must be
    // offered as a normal fixed edge, not looked for in the (empty) dice table.
    const DICE_STOCK = [
      DICE_HEADER,
      'P-START,SETUP,First,Start,Begin,Go,Done,0,0,P-ROLL,,No,No',
      'P-ROLL,REVIEW,First,Roll,Roll it,Go,Done,0,0,,,Yes,No',
      'P-LOCK,REVIEW,First,Lock,Pick,Go,Done,0,0,P-LEFT,P-RIGHT,No,Yes',
      'P-LEFT,REVIEW,First,Left,L,Go,Done,0,0,P-END,,No,No',
      'P-RIGHT,REVIEW,First,Right,R,Go,Done,0,0,P-END,,No,No',
      'P-FEE,REVIEW,First,Fee,Pay,Go,Done,0,0,P-END,,Yes,No',
      'P-END,DONE,First,End,Fin,Go,Done,0,0,,,No,No',
    ].join('\n') + '\n';
    // die_roll='Next Step' is movement; 'Fees Paid' is an effect (not movement).
    const DICE_CSV =
      'space_name,die_roll,visit_type,1,2,3,4,5,6\n' +
      'P-ROLL,Next Step,First,P-LEFT,P-LEFT,P-RIGHT,P-RIGHT,P-END,P-END\n' +
      'P-FEE,Fees Paid,First,$100,$100,$200,$200,$300,$300\n';

    const catalog = buildCatalog({ stockSpacesCsv: DICE_STOCK, diceCsv: DICE_CSV, config: baseConfig() }) as any;
    // Dice edges come from the dice table, flagged dice:true.
    expect(catalog.edges).toContainEqual({ from: 'P-ROLL', to: 'P-LEFT', dice: true });
    expect(catalog.edges).toContainEqual({ from: 'P-ROLL', to: 'P-RIGHT', dice: true });
    expect(catalog.edges).toContainEqual({ from: 'P-ROLL', to: 'P-END', dice: true });
    // Fixed edges still flagged dice:false.
    expect(catalog.edges).toContainEqual({ from: 'P-START', to: 'P-ROLL', dice: false });
    // An effect-only-roll space offers its fixed edge as dice:false (drift fix).
    expect(catalog.edges).toContainEqual({ from: 'P-FEE', to: 'P-END', dice: false });
    // The lock-point source is never offered as a spliceable edge.
    expect(catalog.edges.some((e: any) => e.from === 'P-LOCK')).toBe(false);
  });

  // ===== Card Library stage 1: entry.dice must follow the PLAYED CARD =====
  // The breadcrumb from the dice slice, now due. entry.dice used to be
  // computed from the STOCK dice table alone, so once a card could carry its
  // own dice rows the catalog kept reporting stock's answer to "is this a
  // dice space?" — the same parallel-systems drift as the 2026-06-20
  // requires_dice_roll-vs-Next Step bug. It drives the editor's own "pick an
  // edge" dropdown, so a stale answer offers edges that do not exist.
  describe("entry.dice consults the played card's dice, not stock's", () => {
    const CARD_HEADER =
      'space_name,phase,visit_type,Title,Event,Action,Outcome,Time,Fee,space_1,space_2,' +
      'requires_dice_roll,is_path_choice_lock_point';
    const CARD_STOCK = [
      CARD_HEADER,
      'P-ROLL,REVIEW,First,Roll,Roll it,Go,Done,0,0,,,Yes,No',
      'P-FIXED,REVIEW,First,Fixed,Walk,Go,Done,0,0,P-LEFT,,No,No',
      'P-LEFT,REVIEW,First,Left,L,Go,Done,0,0,P-END,,No,No',
      'P-RIGHT,REVIEW,First,Right,R,Go,Done,0,0,P-END,,No,No',
      'P-END,DONE,First,End,Fin,Go,Done,0,0,,,No,No',
    ].join('\n') + '\n';
    const CARD_DICE =
      'space_name,die_roll,visit_type,1,2,3,4,5,6\n' +
      'P-ROLL,Next Step,First,P-LEFT,P-LEFT,P-LEFT,P-LEFT,P-LEFT,P-LEFT\n';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playing = (slot: string, diceRows: any[]): any => {
      const config = baseConfig();
      config.teacherCopies['card_1'] = {
        slot, rows: {}, owner: { tier: 'official', id: null }, diceRows,
      };
      config.slots[slot] = { used: true, card: 'card_1' };
      return config;
    };

    it("uses the card's destinations where stock's would have been wrong", () => {
      const config = playing('P-ROLL', [
        { space_name: 'P-ROLL', die_roll: 'Next Step', visit_type: 'First',
          '1': 'P-RIGHT', '2': 'P-RIGHT', '3': 'P-RIGHT', '4': 'P-RIGHT', '5': 'P-RIGHT', '6': 'P-RIGHT' },
      ]);
      const catalog = buildCatalog({ stockSpacesCsv: CARD_STOCK, diceCsv: CARD_DICE, config }) as any;
      expect(catalog.edges).toContainEqual({ from: 'P-ROLL', to: 'P-RIGHT', dice: true });
      // Stock's destination is gone — the card replaced it wholesale, exactly
      // as applyConfigToDiceCsv does at bake time.
      expect(catalog.edges.some((e: any) => e.from === 'P-ROLL' && e.to === 'P-LEFT')).toBe(false);
    });

    it('a card whose rolls are all EFFECTS makes the space NOT a dice space', () => {
      // Stock says P-ROLL routes by dice. The card's only roll is a fee, so it
      // does not — and with no dice movement it falls back to its fixed
      // space_N cells (empty here), which is the honest answer.
      const config = playing('P-ROLL', [
        { space_name: 'P-ROLL', die_roll: 'Fees Paid', visit_type: 'First',
          '1': '$1', '2': '$1', '3': '$2', '4': '$2', '5': '$3', '6': '$3' },
      ]);
      const catalog = buildCatalog({ stockSpacesCsv: CARD_STOCK, diceCsv: CARD_DICE, config }) as any;
      expect(catalog.edges.some((e: any) => e.from === 'P-ROLL')).toBe(false);
    });

    it('a card can ADD dice movement to a space stock routes with a fixed edge', () => {
      const config = playing('P-FIXED', [
        { space_name: 'P-FIXED', die_roll: 'Next Step', visit_type: 'First',
          '1': 'P-LEFT', '2': 'P-LEFT', '3': 'P-LEFT', '4': 'P-RIGHT', '5': 'P-RIGHT', '6': 'P-RIGHT' },
      ]);
      const catalog = buildCatalog({ stockSpacesCsv: CARD_STOCK, diceCsv: CARD_DICE, config }) as any;
      expect(catalog.edges).toContainEqual({ from: 'P-FIXED', to: 'P-LEFT', dice: true });
      expect(catalog.edges).toContainEqual({ from: 'P-FIXED', to: 'P-RIGHT', dice: true });
    });

    it('a card WITHOUT dice rows of its own leaves stock’s answer alone', () => {
      const config = baseConfig();
      config.teacherCopies['card_1'] = { slot: 'P-ROLL', rows: {}, owner: { tier: 'official', id: null } };
      config.slots['P-ROLL'] = { used: true, card: 'card_1' };
      const catalog = buildCatalog({ stockSpacesCsv: CARD_STOCK, diceCsv: CARD_DICE, config }) as any;
      expect(catalog.edges).toContainEqual({ from: 'P-ROLL', to: 'P-LEFT', dice: true });
    });

    it('an UNPLAYED card never affects the answer (single-pointer lookup)', () => {
      const config = baseConfig();
      config.teacherCopies['card_1'] = {
        slot: 'P-ROLL', rows: {}, owner: { tier: 'official', id: null },
        diceRows: [{ space_name: 'P-ROLL', die_roll: 'Next Step', visit_type: 'First',
          '1': 'P-RIGHT', '2': 'P-RIGHT', '3': 'P-RIGHT', '4': 'P-RIGHT', '5': 'P-RIGHT', '6': 'P-RIGHT' }],
      };
      // The slot exists but does NOT point at the card.
      config.slots['P-ROLL'] = { used: true };
      const catalog = buildCatalog({ stockSpacesCsv: CARD_STOCK, diceCsv: CARD_DICE, config }) as any;
      expect(catalog.edges).toContainEqual({ from: 'P-ROLL', to: 'P-LEFT', dice: true });
    });
  });

  it('reports which slot plays a teacher copy (and ignores dangling card refs)', () => {
    const config = baseConfig();
    config.teacherCopies['beta_middle_copy_1'] = { slot: 'BETA-MIDDLE', rows: {} };
    config.slots['BETA-MIDDLE'] = { used: true, card: 'beta_middle_copy_1' };
    config.slots['ZETA-END'] = { used: true, card: 'ghost_copy_9' }; // dangling

    const catalog = buildCatalog({ stockSpacesCsv: STOCK, config });
    expect(catalog.spaces.find(s => s.name === 'BETA-MIDDLE')!.copyId).toBe('beta_middle_copy_1');
    expect(catalog.spaces.find(s => s.name === 'ZETA-END')!.copyId).toBeNull();
  });
});
