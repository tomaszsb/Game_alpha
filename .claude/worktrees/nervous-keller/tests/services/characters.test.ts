// tests/services/characters.test.ts
// Tests for shared character constants and utility functions.

import { describe, it, expect } from 'vitest';
import {
  CHARACTER_MAP,
  extractPrefix,
  getNpcImagePath,
  ALL_IMAGE_ROLES,
  ALL_ETHNICITIES,
  ALL_GENDERS,
  NpcImageRole,
} from '../../src/constants/characters';

describe('characters constants', () => {
  describe('CHARACTER_MAP', () => {
    it('should have entries for all 6 space prefixes', () => {
      const expectedPrefixes = ['OWNER', 'ARCH', 'ENG', 'REG-DOB', 'REG-FDNY', 'CON'];
      for (const prefix of expectedPrefixes) {
        expect(CHARACTER_MAP[prefix]).toBeDefined();
      }
    });

    it('each entry should have emoji, name, phase, color, and imageRoles', () => {
      for (const [prefix, info] of Object.entries(CHARACTER_MAP)) {
        expect(info.emoji).toBeTruthy();
        expect(info.name).toBeTruthy();
        expect(info.phase).toBeTruthy();
        expect(info.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(info.imageRoles.length).toBeGreaterThan(0);
      }
    });

    it('imageRoles should reference valid NPC image roles', () => {
      for (const info of Object.values(CHARACTER_MAP)) {
        for (const role of info.imageRoles) {
          expect(ALL_IMAGE_ROLES).toContain(role);
        }
      }
    });

    it('every image role should be referenced by at least one prefix', () => {
      const referencedRoles = new Set<string>();
      for (const info of Object.values(CHARACTER_MAP)) {
        for (const role of info.imageRoles) {
          referencedRoles.add(role);
        }
      }
      for (const role of ALL_IMAGE_ROLES) {
        expect(referencedRoles.has(role)).toBe(true);
      }
    });
  });

  describe('extractPrefix', () => {
    it('should extract OWNER from OWNER-SCOPE-INITIATION', () => {
      expect(extractPrefix('OWNER-SCOPE-INITIATION')).toBe('OWNER');
    });

    it('should extract ARCH from ARCH-DESIGN-REVIEW', () => {
      expect(extractPrefix('ARCH-DESIGN-REVIEW')).toBe('ARCH');
    });

    it('should extract ENG from ENG-STRUCTURAL', () => {
      expect(extractPrefix('ENG-STRUCTURAL')).toBe('ENG');
    });

    it('should extract REG-DOB from REG-DOB-PLAN-REVIEW', () => {
      expect(extractPrefix('REG-DOB-PLAN-REVIEW')).toBe('REG-DOB');
    });

    it('should extract REG-FDNY from REG-FDNY-FIRE-SAFETY', () => {
      expect(extractPrefix('REG-FDNY-FIRE-SAFETY')).toBe('REG-FDNY');
    });

    it('should extract CON from CON-FOUNDATION', () => {
      expect(extractPrefix('CON-FOUNDATION')).toBe('CON');
    });

    it('should return the full string if no hyphen', () => {
      expect(extractPrefix('START')).toBe('START');
    });
  });

  describe('getNpcImagePath', () => {
    it('should return correct path for a given role and appearance', () => {
      const path = getNpcImagePath('owner', { ethnicity: 'asian', gender: 'female' });
      expect(path).toBe('/images/characters/owner_asian_female.png');
    });

    it('should work for all combinations of ethnicity and gender', () => {
      for (const ethnicity of ALL_ETHNICITIES) {
        for (const gender of ALL_GENDERS) {
          const path = getNpcImagePath('architect', { ethnicity, gender });
          expect(path).toBe(`/images/characters/architect_${ethnicity}_${gender}.png`);
        }
      }
    });

    it('should work for all image roles', () => {
      const appearance = { ethnicity: 'black' as const, gender: 'male' as const };
      for (const role of ALL_IMAGE_ROLES) {
        const path = getNpcImagePath(role, appearance);
        expect(path).toBe(`/images/characters/${role}_black_male.png`);
      }
    });
  });

  describe('ALL_IMAGE_ROLES', () => {
    it('should contain exactly 9 roles', () => {
      expect(ALL_IMAGE_ROLES).toHaveLength(9);
    });

    it('should include all expected roles', () => {
      const expected: NpcImageRole[] = [
        'owner', 'architect', 'engineer',
        'dob_examiner', 'dob_clerk',
        'fdny_examiner', 'fdny_clerk',
        'contractor', 'inspector',
      ];
      for (const role of expected) {
        expect(ALL_IMAGE_ROLES).toContain(role);
      }
    });
  });

  describe('ALL_ETHNICITIES and ALL_GENDERS', () => {
    it('should have 4 ethnicities', () => {
      expect(ALL_ETHNICITIES).toHaveLength(4);
    });

    it('should have 2 genders', () => {
      expect(ALL_GENDERS).toHaveLength(2);
    });

    it('should produce 8 unique combinations', () => {
      const combos = new Set<string>();
      for (const e of ALL_ETHNICITIES) {
        for (const g of ALL_GENDERS) {
          combos.add(`${e}_${g}`);
        }
      }
      expect(combos.size).toBe(8);
    });
  });
});
