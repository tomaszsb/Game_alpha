import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { matIcon, portraitSrc, PORTRAIT_ROLES } from '../../src/utils/buildingIcon';
import { configureTrophyRules, getTrophyRules } from '../../src/utils/trophyRules';
import type { TownCsvRow } from '../../src/types/DataTypes';

const CLEAN = path.join(__dirname, '../../public/data/CLEAN_FILES');
const rows = (): TownCsvRow[] => {
  const [head, ...lines] = fs.readFileSync(path.join(CLEAN, 'TOWN.csv'), 'utf-8').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map(l => { const v = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()])) as unknown as TownCsvRow; });
};
const row = (o: Partial<TownCsvRow>): TownCsvRow => ({ kind: '', id: '', name: '', building: '', col: '', row: '', width: '', depth: '', height: '', color: '', icon: '', value: '', ...o });

// Tom, 2026-10-13: "use the same icons on the buildings": a project step wears its building's picture.
describe("project steps wear their building's icon", () => {
  it('every stock step has an icon, and it is the icon of the building named in the town list', () => {
    configureTrophyRules([]);
    const town = rows();
    for (const t of getTrophyRules().mat) {
      const icon = matIcon(town, t.id);
      expect(icon, `step ${t.id}`).toBeTruthy();
      const named = town.find(r => r.kind === 'mat_icon' && r.id === t.id)!;
      expect(icon).toBe(town.find(r => r.kind === 'building' && r.id === named.building)!.icon);
    }
  });

  it('the stock pairings: scope with the owner, funded with the bank, approvals with their examiners', () => {
    const town = rows();
    expect(matIcon(town, 'scope')).toBe('owner');
    expect(matIcon(town, 'funded')).toBe('🏦');
    expect(matIcon(town, 'dob')).toBe('dob_examiner');
    expect(matIcon(town, 'fdny')).toBe('fdny_examiner');
    expect(matIcon(town, 'builder')).toBe('contractor');
    expect(matIcon(town, 'finish')).toBe('🎀');
  });

  it('no row, or a row naming a building that is not there, means no icon (the plain mark is used)', () => {
    expect(matIcon([], 'scope')).toBeUndefined();
    expect(matIcon(undefined, 'scope')).toBeUndefined();
    expect(matIcon([row({ kind: 'mat_icon', id: 'scope', building: 'ghost' })], 'scope')).toBeUndefined();
  });

  it('a portrait role draws the character portrait; an emoji does not', () => {
    expect(PORTRAIT_ROLES.has('owner')).toBe(true);
    expect(portraitSrc('🏦', { owner: 'x' } as never)).toBeNull();
    expect(portraitSrc('owner', undefined)).toBeNull();
  });
});
