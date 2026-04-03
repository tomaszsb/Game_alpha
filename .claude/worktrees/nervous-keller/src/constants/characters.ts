// src/constants/characters.ts
// Shared NPC character constants — single source of truth for CharacterBadge, SpeechService, and portrait system.

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
}

export const CHARACTER_MAP: Record<string, CharacterInfo> = {
  OWNER:      { emoji: '\u{1F454}', name: 'The Owner',        phase: 'Initiation',   color: '#2196F3', imageRoles: ['owner'] },
  ARCH:       { emoji: '\u{1F4D0}', name: 'The Architect',    phase: 'Design',       color: '#9C27B0', imageRoles: ['architect'] },
  ENG:        { emoji: '\u2699\uFE0F',  name: 'The Engineer',     phase: 'Engineering',  color: '#FF9800', imageRoles: ['engineer'] },
  'REG-DOB':  { emoji: '\u{1F4CB}', name: 'DOB Examiner',     phase: 'Regulatory',   color: '#f44336', imageRoles: ['dob_examiner', 'dob_clerk'] },
  'REG-FDNY': { emoji: '\u{1F692}', name: 'FDNY Inspector',   phase: 'Regulatory',   color: '#f44336', imageRoles: ['fdny_examiner', 'fdny_clerk'] },
  CON:        { emoji: '\u{1F3D7}\uFE0F', name: 'The Contractor',   phase: 'Construction', color: '#4CAF50', imageRoles: ['contractor', 'inspector'] },
};

/** Extract space-name prefix (e.g. "OWNER" from "OWNER-SCOPE-INITIATION") */
export function extractPrefix(spaceName: string): string {
  if (spaceName.startsWith('REG-DOB'))  return 'REG-DOB';
  if (spaceName.startsWith('REG-FDNY')) return 'REG-FDNY';
  const idx = spaceName.indexOf('-');
  return idx > 0 ? spaceName.substring(0, idx) : spaceName;
}

/** Build image path for a given role + appearance */
export function getNpcImagePath(role: NpcImageRole, appearance: NpcAppearance): string {
  return `/images/characters/${role}_${appearance.ethnicity}_${appearance.gender}.png`;
}
