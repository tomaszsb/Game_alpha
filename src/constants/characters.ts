// src/constants/characters.ts
// Shared NPC character constants — single source of truth for CharacterBadge, SpeechService, and portrait system.

import type { CharacterCsvRow } from '../types/DataTypes';

export type Ethnicity = 'asian' | 'black' | 'hispanic' | 'white';
export type Gender = 'male' | 'female';

export interface NpcAppearance {
  ethnicity: Ethnicity;
  gender: Gender;
}

/** Image role keys matching filenames in public/images/characters/ */
export type NpcImageRole =
  | 'owner'
  | 'architect'
  | 'engineer'
  | 'dob_examiner'
  | 'dob_clerk'
  | 'fdny_examiner'
  | 'fdny_clerk'
  | 'contractor'
  | 'inspector';

export const ALL_IMAGE_ROLES: NpcImageRole[] = [
  'owner', 'architect', 'engineer',
  'dob_examiner', 'dob_clerk',
  'fdny_examiner', 'fdny_clerk',
  'contractor', 'inspector',
];

export const ALL_ETHNICITIES: Ethnicity[] = ['asian', 'black', 'hispanic', 'white'];
export const ALL_GENDERS: Gender[] = ['male', 'female'];

/** Record mapping every image role to its assigned appearance */
export type NpcAppearances = Record<NpcImageRole, NpcAppearance>;

export interface CharacterInfo {
  emoji: string;
  name: string;
  phase: string;
  color: string;
  /** Which image roles this space prefix maps to (primary first) */
  imageRoles: NpcImageRole[];
  /**
   * 2026-08-09: CSV-portability lift. Short agency/role label used where
   * narration needs a bare noun instead of the full `name` — e.g. "DOB
   * approval" / "FDNY Plan Examiner" instead of "DOB Examiner approval".
   * Reskin hook: flows through the same npc_speaker override chain as
   * `name`/`emoji`/`color` (see getNpcCharacterInfo) — no separate CSV
   * column needed. See ApprovalService.getDobLabel/getFdnyLabel.
   */
  shortLabel: string;
}

/**
 * 2026-08-09: CSV-portability lift, reskin item 4. Built-in fallback for the
 * 9 stock NPCs -- used verbatim when data/CHARACTERS.csv is missing or every
 * row in it fails validation (see configureCharacterMap below), and as
 * CHARACTER_MAP's initial value so a module that reads CHARACTER_MAP
 * synchronously at import time (SpeechService's CHARACTER_PROFILES, built
 * before App's async data load resolves) always sees valid data.
 */
const DEFAULT_CHARACTER_MAP: Record<string, CharacterInfo> = {
  OWNER:      { emoji: '\u{1F454}', name: 'The Owner',        phase: 'Initiation',   color: '#2196F3', imageRoles: ['owner'], shortLabel: 'Owner' },
  ARCH:       { emoji: '\u{1F4D0}', name: 'The Architect',    phase: 'Design',       color: '#9C27B0', imageRoles: ['architect'], shortLabel: 'Architect' },
  ENG:        { emoji: '\u2699\uFE0F',  name: 'The Engineer',     phase: 'Engineering',  color: '#FF9800', imageRoles: ['engineer'], shortLabel: 'Engineer' },
  'REG-DOB':  { emoji: '\u{1F4CB}', name: 'DOB Examiner',     phase: 'Regulatory',   color: '#f44336', imageRoles: ['dob_examiner', 'dob_clerk'], shortLabel: 'DOB' },
  // FDNY previously shared DOB's exact red — indistinguishable on the board's
  // discipline badge (fb:feedback-1782657383215-a9d3221a). Distinct magenta.
  'REG-FDNY': { emoji: '\u{1F692}', name: 'FDNY Inspector',   phase: 'Regulatory',   color: '#E91E63', imageRoles: ['fdny_examiner', 'fdny_clerk'], shortLabel: 'FDNY' },
  CON:        { emoji: '\u{1F3D7}\uFE0F', name: 'The Contractor',   phase: 'Construction', color: '#4CAF50', imageRoles: ['contractor', 'inspector'], shortLabel: 'Contractor' },
  // Funding-phase trio named 2026-08-02 (TODO "Bank/Investor/Lender character
  // naming"). No portrait art exists for these roles yet \u2014 imageRoles empty,
  // which falls back to the emoji everywhere a portrait would otherwise show
  // (see useNpcPortrait.getPortraitForSpace). Colors picked distinct from
  // every color above AND from each other, since all three share FUNDING's
  // phase color (#FF9800) and would otherwise blend into it or one another,
  // same reasoning as the earlier REG-DOB/REG-FDNY split.
  BANK:       { emoji: '\u{1F3E6}', name: 'The Bank',          phase: 'Funding',      color: '#009688', imageRoles: [], shortLabel: 'Bank' },
  LEND:       { emoji: '\u{1F91D}', name: 'The Lender',        phase: 'Funding',      color: '#FFC107', imageRoles: [], shortLabel: 'Lender' },
  INVESTOR:   { emoji: '\u{1F4BC}', name: 'The Investor',      phase: 'Funding',      color: '#3F51B5', imageRoles: [], shortLabel: 'Investor' },
};

/**
 * 2026-08-09: CSV-portability lift, reskin item 4. Mutable \u2014 populated from
 * DEFAULT_CHARACTER_MAP at module load (so every synchronous reader gets
 * today's stock roster immediately) and then overwritten in place by
 * configureCharacterMap() once CHARACTERS.csv loads at app startup. Object
 * identity never changes, so existing `import { CHARACTER_MAP }` references
 * see the CSV-driven data once configureCharacterMap runs.
 */
export const CHARACTER_MAP: Record<string, CharacterInfo> = { ...DEFAULT_CHARACTER_MAP };

/**
 * Call once at app startup (after DataService.loadData() resolves) with
 * every row parsed from CHARACTERS.csv, to let a reskin replace or extend
 * the built-in NPC roster \u2014 e.g. add a "Dungeon Master" entry for the D&D
 * reskin experiment \u2014 without a code edit. Once a new id is present in
 * CHARACTER_MAP, `configureNpcSpeakers`'s existing `npc_speaker` override
 * chain can point any space at it, same as the 9 stock NPCs.
 *
 * A row missing a required field is skipped (logged) \u2014 the rest of the CSV
 * still loads. If the CSV is missing (empty `rows`) or every row fails
 * validation, CHARACTER_MAP keeps its built-in DEFAULT_CHARACTER_MAP
 * contents untouched \u2014 the game never crashes over a bad reskin CSV.
 */
export function configureCharacterMap(rows: CharacterCsvRow[]): void {
  if (!rows || rows.length === 0) return; // missing/empty CHARACTERS.csv \u2014 built-in defaults stand

  const parsed: Record<string, CharacterInfo> = {};
  for (const row of rows) {
    const id = (row.id || '').trim();
    const emoji = (row.emoji || '').trim();
    const name = (row.name || '').trim();
    const phase = (row.phase || '').trim();
    const color = (row.color || '').trim();
    const shortLabel = (row.short_label || '').trim();
    if (!id || !emoji || !name || !phase || !color || !shortLabel) {
      console.error('characters.ts: skipping malformed CHARACTERS.csv row (missing a required field):', row);
      continue;
    }
    const imageRoles = (row.image_roles || '')
      .split(',')
      .map(r => r.trim())
      .filter((r): r is NpcImageRole => (ALL_IMAGE_ROLES as string[]).includes(r));
    parsed[id] = { emoji, name, phase, color, imageRoles, shortLabel };
  }

  if (Object.keys(parsed).length === 0) {
    console.error('characters.ts: CHARACTERS.csv had no valid rows \u2014 falling back to the built-in NPC roster.');
    return;
  }

  for (const key of Object.keys(CHARACTER_MAP)) delete CHARACTER_MAP[key];
  Object.assign(CHARACTER_MAP, parsed);
}

/**
 * 2026-07-16: CSV-portability lift — reskin hook. Populated once at app
 * startup (see `configureNpcSpeakers`) from GAME_CONFIG's `npc_speaker`
 * column, keyed by exact space_name. A space present here skips the prefix
 * heuristic below entirely — this is how a reskin CSV can assign the right
 * NPC to a space whose name doesn't follow the OWNER-/ARCH-/ENG-/REG-DOB-/
 * REG-FDNY-/CON- convention.
 */
const SPACE_NPC_OVERRIDES = new Map<string, string>();

/**
 * 2026-07-16: CSV-portability lift. Call once at app startup (after
 * GAME_CONFIG loads) with every space carrying a non-empty `npc_speaker`.
 * A value of 'PM' adds the space to PM_VOICED_SPACES; any other value that
 * matches a CHARACTER_MAP key overrides extractPrefix for that exact space.
 * Unrecognized values are ignored (a reskin CSV without this column is a
 * no-op — today's hardcoded defaults stand).
 */
export function configureNpcSpeakers(assignments: Array<{ spaceName: string; npcSpeaker: string }>): void {
  for (const { spaceName, npcSpeaker } of assignments) {
    if (!npcSpeaker) continue;
    if (npcSpeaker === 'PM') {
      PM_VOICED_SPACES.add(spaceName);
    } else if (npcSpeaker in CHARACTER_MAP) {
      SPACE_NPC_OVERRIDES.set(spaceName, npcSpeaker);
    }
  }
}

/** Extract space-name prefix (e.g. "OWNER" from "OWNER-SCOPE-INITIATION") */
export function extractPrefix(spaceName: string): string {
  const override = SPACE_NPC_OVERRIDES.get(spaceName);
  if (override) return override;
  if (spaceName.startsWith('REG-DOB'))  return 'REG-DOB';
  if (spaceName.startsWith('REG-FDNY')) return 'REG-FDNY';
  const idx = spaceName.indexOf('-');
  return idx > 0 ? spaceName.substring(0, idx) : spaceName;
}

// Five spaces are PM-voiced (the narration is the PM's own first-person
// thought, not an NPC addressing the PM) — per the project NPC-speaker map
// (memory `project_npc_speakers`). Single source of truth: DiceService's
// dice-result summary already branched on this list; CharacterBadge and
// friends did not, so a PM-voiced space whose prefix happens to collide with
// a real NPC entry (ARCH-INITIATION → "The Architect", ENG-INITIATION →
// "The Engineer", REG-DOB-TYPE-SELECT → "DOB Examiner") showed that NPC's
// name/portrait next to first-person "I" text — read as "the boxes are
// confused" (fb:7065e8df, "the owner says words are I"). These same 5 are
// also mirrored in GAME_CONFIG's `npc_speaker=PM` column (2026-07-16); this
// hardcoded default keeps working standalone for a CSV that omits the column.
export const PM_VOICED_SPACES = new Set<string>([
  'PM-DECISION-CHECK',
  'CHEAT-BYPASS',
  'ARCH-INITIATION',
  'ENG-INITIATION',
  'REG-DOB-TYPE-SELECT',
]);

/**
 * Resolve which NPC (if any) is "speaking" for a space — undefined for
 * PM-voiced spaces (no NPC to attribute the text to) or spaces whose prefix
 * has no character entry. Use this instead of `CHARACTER_MAP[extractPrefix(x)]`
 * directly wherever narration is attributed to a character (badges, portraits,
 * accent colors) so PM-voiced spaces never get a stray NPC label.
 */
export function getNpcCharacterInfo(spaceName: string): CharacterInfo | undefined {
  if (PM_VOICED_SPACES.has(spaceName)) return undefined;
  return CHARACTER_MAP[extractPrefix(spaceName)];
}

/** Build image path for a given role + appearance */
export function getNpcImagePath(role: NpcImageRole, appearance: NpcAppearance): string {
  return `/images/characters/${role}_${appearance.ethnicity}_${appearance.gender}.png`;
}
