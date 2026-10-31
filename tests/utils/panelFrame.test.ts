import { afterEach, describe, it, expect } from 'vitest';
import { mixHex, panelFrameName, panelFrameStyles } from '../../src/utils/panelFrame';
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

  // 10-13 (fb:4e8a8550): the clipboard carries the player's colour so the players are easy to tell apart.
  it("tints the board with the player's colour, and only paints", () => {
    const f = panelFrameStyles("clipboard", panelPalettes.light, "light", "#2563eb");
    expect(String(f.frame.background)).toContain("#2563eb");
    expect(String(panelFrameStyles("clipboard", panelPalettes.light, "light").frame.background)).not.toContain("color-mix");
    expect(Object.keys(f.frame).filter(k => /^(padding|margin|gap|borderWidth|width|height)/.test(k))).toEqual([]);
  });

  // 2026-10-31: Chrome 95 (the classroom touch board) has no color-mix and would drop the board's colour altogether.
  describe("on a browser with no color-mix", () => {
    const original = globalThis.CSS;
    afterEach(() => { globalThis.CSS = original; });

    it("works the colour out by hand", () => {
      globalThis.CSS = { supports: () => false } as unknown as typeof CSS;
      const f = panelFrameStyles("clipboard", panelPalettes.light, "light", "#2563eb");
      expect(String(f.frame.background)).not.toContain("color-mix");
      expect(f.frame.background).toBe(mixHex("#2563eb", "#c9a46a", 0.55));
    });

    it("mixes as color-mix does: 55% of the first and 45% of the second, in plain sRGB", () => {
      expect(mixHex("#000000", "#ffffff", 0.55)).toBe("rgb(115, 115, 115)");
      expect(mixHex("#ff0000", "#0000ff", 1)).toBe("rgb(255, 0, 0)");
      expect(mixHex("#f00", "#00f", 0)).toBe("rgb(0, 0, 255)");
    });

    it("falls back to the wood for a colour it cannot read", () => {
      expect(mixHex("rebeccapurple", "#c9a46a", 0.55)).toBe("#c9a46a");
    });
  });
});
