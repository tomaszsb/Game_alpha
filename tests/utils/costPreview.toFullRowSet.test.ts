/**
 * toFullRowSet — expands a populated-only CostPreviewRow[] into all 5
 * categories in fixed order, filling missing ones with a placeholder.
 * Used by TurnCommitControl (dark-mode A/B variant) per a 2026-07-14
 * playtest follow-up: rows must never appear/disappear between spaces.
 */

import { describe, it, expect } from 'vitest';
import { toFullRowSet, CostPreviewRow } from '../../src/utils/costPreview';

describe('toFullRowSet', () => {
  it('returns all 5 categories in fixed order, keeping existing rows as-is', () => {
    const rows: CostPreviewRow[] = [
      { key: 'money', icon: '💰', label: 'Money', value: '$500' },
    ];
    const full = toFullRowSet(rows);
    expect(full.map((r) => r.key)).toEqual(['labor', 'work', 'expediting', 'money', 'time']);
    expect(full.find((r) => r.key === 'money')).toEqual(rows[0]);
  });

  it('fills missing categories with the default placeholder', () => {
    const full = toFullRowSet([]);
    expect(full).toHaveLength(5);
    for (const row of full) {
      expect(row.value).toBe('—');
    }
  });

  it('accepts a custom placeholder', () => {
    const full = toFullRowSet([], 'n/a');
    expect(full.every((r) => r.value === 'n/a')).toBe(true);
  });

  it('is idempotent — passing an already-full set back through changes nothing', () => {
    const full = toFullRowSet([]);
    expect(toFullRowSet(full)).toEqual(full);
  });
});
