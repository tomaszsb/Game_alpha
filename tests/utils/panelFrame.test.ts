import { describe, it, expect } from 'vitest';
import { panelFrameName, panelFrameStyles } from '../../src/utils/panelFrame';
import { panelPalettes } from '../../src/components/player/panelTheme';
import type { TownCsvRow } from '../../src/types/DataTypes';

const setting = (value: string): TownCsvRow => ({
  kind: 'setting', id: 'panel_frame', name: '', building: '', col: '', row: '',
  width: '', depth: '', height: '', color: '', icon: '', value,
});

describe('panelFrame', () => {
  it('is the clipboard when the data says so, or says nothing', () => {
    expect(panelFrameName([setting('clipboard')])).toBe('clipboard');
    expect(panelFrameName([])).toBe('clipboard');
    expect(panelFrameName(undefined)).toBe('clipboard');
    expect(panelFrameName([setting('mystery')])).toBe('clipboard');
  });

  it('plain or none turns it off', () => {
    expect(panelFrameName([setting('plain')])).toBe('plain');
    expect(panelFrameName([setting(' None ')])).toBe('plain');
  });

  it('never changes size: no padding, margin, gap or border-width keys, clip is out of the layout', () => {
    for (const name of ['clipboard', 'plain'] as const) {
      for (const mode of ['light', 'dark'] as const) {
        const f = panelFrameStyles(name, panelPalettes[mode], mode);
        for (const part of [f.frame, f.sheet, f.tile]) {
          const keys = Object.keys(part);
          expect(keys.filter(k => /^(padding|margin|gap|borderWidth|width|height|minHeight)/.test(k))).toEqual([]);
        }
        if (f.clip) expect(f.clip.position).toBe('absolute');
        // Every border shorthand stays 1px wide.
        for (const part of [f.frame, f.tile]) {
          if (typeof part.border === 'string') expect(part.border.startsWith('1px ')).toBe(true);
        }
      }
    }
  });
});
