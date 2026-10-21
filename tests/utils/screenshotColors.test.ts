// Bug-report screenshots failed with 'unsupported color function "color"' (10 of 14 reports,
// 2026-10-19 to 10-21): Chrome reports color-mix() colours as color(srgb ...) and html2canvas
// cannot parse them. flattenModernColorsForCapture writes plain rgb() over them on the clone.
// Checked in a real Chrome with html2canvas: fails without it, captures with it.
import { describe, it, expect, vi } from 'vitest';
import { replaceColorFunctions, flattenModernColorsForCapture } from '../../src/utils/screenshotClone';

describe('replaceColorFunctions', () => {
  it('rewrites each color(...) and leaves the rest alone', () => {
    const out = replaceColorFunctions('0px 0px 4px color(srgb 0.1 0.2 0.3 / 0.5), 1px 1px rgb(0, 0, 0)', () => 'rgb(1, 2, 3)');
    expect(out).toBe('0px 0px 4px rgb(1, 2, 3), 1px 1px rgb(0, 0, 0)');
  });
  it('a colour the browser cannot read becomes black instead of breaking the capture', () => {
    expect(replaceColorFunctions('color(display-p3 1 0 0)', () => null)).toBe('rgb(0, 0, 0)');
  });
});

describe('flattenModernColorsForCapture', () => {
  it('sets an inline rgb() for every computed colour that is a color() function', () => {
    const doc = document;
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    const spy = vi.spyOn(window, 'getComputedStyle').mockImplementation((e: Element) => ({
      getPropertyValue: (prop: string) => (e === el && prop === 'border-top-color' ? 'color(srgb 0.35 0.38 0.62)' : ''),
    } as unknown as CSSStyleDeclaration));
    const n = flattenModernColorsForCapture(doc, () => 'rgb(90, 97, 160)');
    spy.mockRestore();
    el.remove();
    expect(n).toBe(1);
    expect(el.style.getPropertyValue('border-top-color')).toBe('rgb(90, 97, 160)');
  });
});
