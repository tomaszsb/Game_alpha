// buildingIcon - the one picture each town building wears (TOWN.csv `icon`: a character portrait role like
// `owner`, or an emoji), shared so the project steps on the player's clipboard can wear the SAME pictures as the
// buildings they belong to (Tom, 2026-10-13: "use the same icons on the buildings"). Which step goes with which
// building is data: `mat_icon` rows in TOWN.csv (id = the step's id, building = the building whose icon it wears).

import type { TownCsvRow } from '../types/DataTypes';
import { getNpcImagePath, type NpcAppearances, type NpcImageRole } from '../constants/characters';

/** The icon values that are a character portrait (drawn from the game's portraits) rather than an emoji. */
export const PORTRAIT_ROLES = new Set(['owner', 'architect', 'engineer', 'dob_examiner', 'dob_clerk', 'fdny_examiner', 'fdny_clerk', 'contractor', 'inspector']);

/** The portrait image for an icon value, or null when it is an emoji (or this game has no appearance for the role yet). */
export function portraitSrc(icon: string, appearances: NpcAppearances | undefined): string | null {
  if (!PORTRAIT_ROLES.has(icon)) return null;
  const a = appearances?.[icon as NpcImageRole];
  return a ? getNpcImagePath(icon as NpcImageRole, a) : null;
}

/** The icon value a project step wears: the icon of the building its `mat_icon` row names, or undefined (no row, or no such building). */
export function matIcon(rows: TownCsvRow[] | undefined, stepId: string): string | undefined {
  const row = (rows ?? []).find(r => r.kind === 'mat_icon' && r.id === stepId);
  if (!row) return undefined;
  const building = (rows ?? []).find(r => r.kind === 'building' && r.id === row.building);
  return building?.icon || undefined;
}
