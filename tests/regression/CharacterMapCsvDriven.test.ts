// tests/regression/CharacterMapCsvDriven.test.ts

/**
 * Regression test: CHARACTER_MAP is CSV-driven (2026-08-09, reskin item 4).
 *
 * Workstream 6 CSV-only-reskin audit (2026-08-03, TODO.md) found that
 * CHARACTER_MAP's 9 NPCs were baked into characters.ts as a hardcoded
 * literal. Item 3 (2026-08-09) already let a reskin CSV reassign which
 * *existing* NPC speaks at a space (`configureNpcSpeakers`), but adding a
 * brand-new NPC identity — e.g. "Dungeon Master" for the D&D reskin
 * experiment — still required a code edit.
 *
 * Fix: CHARACTER_MAP is now populated from data/CLEAN_FILES/CHARACTERS.csv
 * (DataService.getCharacterRows -> characters.ts's configureCharacterMap,
 * wired in App.tsx before configureNpcSpeakers so a brand-new id is already
 * present in CHARACTER_MAP by the time npc_speaker overrides are resolved).
 * CHARACTER_MAP itself stays a plain, synchronously-populated object (seeded
 * from a built-in DEFAULT_CHARACTER_MAP at module load) so consumers that
 * read it at import time — SpeechService's CHARACTER_PROFILES — still see
 * valid data before the async CSV fetch resolves.
 *
 * Each test uses vi.resetModules() + a dynamic import to get a fresh copy of
 * characters.ts, since CHARACTER_MAP is mutable module-level state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CharacterCsvRow } from '../../src/types/DataTypes';

// Mirrors public/data/CLEAN_FILES/CHARACTERS.csv exactly (the shipped default).
const STOCK_ROWS: CharacterCsvRow[] = [
  { id: 'OWNER', emoji: '\u{1F454}', name: 'The Owner', phase: 'Initiation', color: '#2196F3', image_roles: 'owner', short_label: 'Owner' },
  { id: 'ARCH', emoji: '\u{1F4D0}', name: 'The Architect', phase: 'Design', color: '#9C27B0', image_roles: 'architect', short_label: 'Architect' },
  { id: 'ENG', emoji: '⚙️', name: 'The Engineer', phase: 'Engineering', color: '#FF9800', image_roles: 'engineer', short_label: 'Engineer' },
  { id: 'REG-DOB', emoji: '\u{1F4CB}', name: 'DOB Examiner', phase: 'Regulatory', color: '#f44336', image_roles: 'dob_examiner,dob_clerk', short_label: 'DOB' },
  { id: 'REG-FDNY', emoji: '\u{1F692}', name: 'FDNY Inspector', phase: 'Regulatory', color: '#E91E63', image_roles: 'fdny_examiner,fdny_clerk', short_label: 'FDNY' },
  { id: 'CON', emoji: '\u{1F3D7}️', name: 'The Contractor', phase: 'Construction', color: '#4CAF50', image_roles: 'contractor,inspector', short_label: 'Contractor' },
  { id: 'BANK', emoji: '\u{1F3E6}', name: 'The Bank', phase: 'Funding', color: '#009688', image_roles: '', short_label: 'Bank' },
  { id: 'LEND', emoji: '\u{1F91D}', name: 'The Lender', phase: 'Funding', color: '#FFC107', image_roles: '', short_label: 'Lender' },
  { id: 'INVESTOR', emoji: '\u{1F4BC}', name: 'The Investor', phase: 'Funding', color: '#3F51B5', image_roles: '', short_label: 'Investor' },
];

describe('CHARACTER_MAP is CSV-driven (reskin item 4)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('loading the current 9 NPCs from CSV yields identical output to the previous hardcoded map', async () => {
    const characters = await import('../../src/constants/characters');
    // Fresh module -> CHARACTER_MAP still holds the built-in default, before
    // any configureCharacterMap call. Snapshot it as the "previous hardcoded
    // map" baseline.
    const builtInSnapshot = JSON.parse(JSON.stringify(characters.CHARACTER_MAP));

    characters.configureCharacterMap(STOCK_ROWS);

    expect(characters.CHARACTER_MAP).toEqual(builtInSnapshot);
    expect(Object.keys(characters.CHARACTER_MAP).sort()).toEqual(
      ['ARCH', 'BANK', 'CON', 'ENG', 'INVESTOR', 'LEND', 'OWNER', 'REG-DOB', 'REG-FDNY'].sort()
    );
  });

  it('adding a new row exposes the new NPC through getNpcCharacterInfo() — no code change needed', async () => {
    const characters = await import('../../src/constants/characters');

    const rowsWithDungeonMaster: CharacterCsvRow[] = [
      ...STOCK_ROWS,
      {
        id: 'DUNGEON_MASTER',
        emoji: '\u{1F409}',
        name: 'The Dungeon Master',
        phase: 'Regulatory',
        color: '#6A0DAD',
        image_roles: '',
        short_label: 'DM',
      },
    ];
    characters.configureCharacterMap(rowsWithDungeonMaster);

    // Directly present in the map.
    expect(characters.CHARACTER_MAP['DUNGEON_MASTER']).toEqual({
      emoji: '\u{1F409}',
      name: 'The Dungeon Master',
      phase: 'Regulatory',
      color: '#6A0DAD',
      imageRoles: [],
      shortLabel: 'DM',
    });

    // Retrievable via getNpcCharacterInfo() once a space is assigned to it —
    // the same npc_speaker override chain item 3 used for existing NPCs.
    characters.configureNpcSpeakers([{ spaceName: 'REG-DOB-CAMPAIGN-START', npcSpeaker: 'DUNGEON_MASTER' }]);
    const info = characters.getNpcCharacterInfo('REG-DOB-CAMPAIGN-START');
    expect(info?.name).toBe('The Dungeon Master');
    expect(info?.shortLabel).toBe('DM');
  });

  it('missing CSV (empty rows) falls back to the built-in map without crashing', async () => {
    const characters = await import('../../src/constants/characters');
    const before = JSON.parse(JSON.stringify(characters.CHARACTER_MAP));

    expect(() => characters.configureCharacterMap([])).not.toThrow();

    expect(characters.CHARACTER_MAP).toEqual(before);
    expect(characters.CHARACTER_MAP['OWNER']).toBeDefined();
  });

  it('malformed CSV (every row missing a required field) falls back to the built-in map without crashing', async () => {
    const characters = await import('../../src/constants/characters');
    const before = JSON.parse(JSON.stringify(characters.CHARACTER_MAP));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const badRows = [
      { id: '', emoji: '\u{1F454}', name: 'The Owner', phase: 'Initiation', color: '#2196F3', image_roles: 'owner', short_label: 'Owner' },
      { id: 'ARCH', emoji: '', name: '', phase: '', color: '', image_roles: '', short_label: '' },
    ] as CharacterCsvRow[];

    expect(() => characters.configureCharacterMap(badRows)).not.toThrow();

    expect(characters.CHARACTER_MAP).toEqual(before);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('a row missing a required field is skipped, but the rest of the CSV still loads', async () => {
    const characters = await import('../../src/constants/characters');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const rows = [
      STOCK_ROWS[0], // OWNER — valid
      { id: 'BROKEN', emoji: '', name: '', phase: '', color: '', image_roles: '', short_label: '' },
    ] as CharacterCsvRow[];

    characters.configureCharacterMap(rows);

    expect(characters.CHARACTER_MAP['OWNER']).toBeDefined();
    expect(characters.CHARACTER_MAP['BROKEN']).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('image_roles rejects unknown values instead of letting them through', async () => {
    const characters = await import('../../src/constants/characters');

    const rows: CharacterCsvRow[] = [
      {
        id: 'OWNER',
        emoji: '\u{1F454}',
        name: 'The Owner',
        phase: 'Initiation',
        color: '#2196F3',
        image_roles: 'owner,not_a_real_role',
        short_label: 'Owner',
      },
    ];
    characters.configureCharacterMap(rows);

    expect(characters.CHARACTER_MAP['OWNER'].imageRoles).toEqual(['owner']);
  });
});
