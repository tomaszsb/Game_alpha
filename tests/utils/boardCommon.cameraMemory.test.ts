/**
 * boardCommon.cameraMemory.test.ts
 *
 * Pure logic behind BoardCanvas's PC-mode camera behavior (maintainer-
 * forwarded review, 2026-07-14): a fingerprint of the board's own layout
 * (node count + bounding box) gates whether a localStorage-saved viewport is
 * safe to reuse, so a saved zoom/pan is never blindly applied to a
 * differently-shaped board.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  boardFingerprint,
  readSavedViewport,
  writeSavedViewport,
  BOARD_VIEWPORT_STORAGE_KEY,
  TARGET_MIN_TILE_PX,
  TARGET_MAX_TILE_PX,
} from '../../src/utils/boardCommon';

const bounds1 = { x: 0, y: 0, width: 1000, height: 800 };
const bounds2 = { x: 0, y: 0, width: 2000, height: 800 };

describe('boardFingerprint', () => {
  it('is stable for the same node count + bounds', () => {
    expect(boardFingerprint(20, bounds1)).toBe(boardFingerprint(20, bounds1));
  });

  it('changes when node count differs (a space was added/removed)', () => {
    expect(boardFingerprint(20, bounds1)).not.toBe(boardFingerprint(21, bounds1));
  });

  it('changes when the bounding box differs (a different board layout)', () => {
    expect(boardFingerprint(20, bounds1)).not.toBe(boardFingerprint(20, bounds2));
  });

  it('rounds sub-pixel bounds so tiny render jitter does not break the match', () => {
    const a = boardFingerprint(20, { x: 0.2, y: 0, width: 1000.4, height: 800 });
    const b = boardFingerprint(20, { x: 0, y: 0, width: 1000, height: 800 });
    expect(a).toBe(b);
  });
});

describe('readSavedViewport / writeSavedViewport', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('round-trips a saved viewport for a matching fingerprint', () => {
    const fp = boardFingerprint(20, bounds1);
    const viewport = { x: 12, y: -34, zoom: 0.8 };
    writeSavedViewport(fp, viewport);
    expect(readSavedViewport(fp)).toEqual(viewport);
  });

  it('returns null when nothing has been saved yet', () => {
    expect(readSavedViewport(boardFingerprint(20, bounds1))).toBeNull();
  });

  it('returns null when the saved fingerprint is for a different board', () => {
    writeSavedViewport(boardFingerprint(20, bounds1), { x: 0, y: 0, zoom: 1 });
    // A board with a different node count / bounding box must NOT reuse a
    // viewport tuned for a differently-shaped board.
    expect(readSavedViewport(boardFingerprint(20, bounds2))).toBeNull();
  });

  it('returns null (not a thrown error) when the stored value is corrupt JSON', () => {
    localStorage.setItem(BOARD_VIEWPORT_STORAGE_KEY, '{not valid json');
    expect(() => readSavedViewport(boardFingerprint(20, bounds1))).not.toThrow();
    expect(readSavedViewport(boardFingerprint(20, bounds1))).toBeNull();
  });

  it('does not throw when localStorage.setItem fails (e.g. quota/privacy mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeSavedViewport(boardFingerprint(20, bounds1), { x: 0, y: 0, zoom: 1 })).not.toThrow();
    spy.mockRestore();
  });

  it('does not throw when localStorage.getItem fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });
    expect(() => readSavedViewport(boardFingerprint(20, bounds1))).not.toThrow();
    expect(readSavedViewport(boardFingerprint(20, bounds1))).toBeNull();
    spy.mockRestore();
  });
});

describe('tile-size zoom targets', () => {
  it('80-200px range maps to a sane zoom range against the compact tile width (150px)', () => {
    const minZoom = TARGET_MIN_TILE_PX / 150;
    const maxZoom = TARGET_MAX_TILE_PX / 150;
    expect(minZoom).toBeCloseTo(0.533, 2);
    expect(maxZoom).toBeCloseTo(1.333, 2);
    expect(minZoom).toBeLessThan(1);
    expect(maxZoom).toBeGreaterThan(1);
  });
});

// fb:2b5b9f2a — TV auto-focus is pan-only after the first fit; the pan
// target comes from computeFocusCenter (BoardCanvas passes it to setCenter
// at the current zoom, so the zoom can no longer swing turn to turn).
import { computeFocusCenter, BOARD_TILE_COMPACT } from '../../src/utils/boardCommon';

describe('computeFocusCenter (TV pan-only follow)', () => {
  const nodes = [
    { id: 'A', position: { x: 0, y: 0 } },
    { id: 'B', position: { x: 300, y: 400 } },
    { id: 'C', position: { x: -200, y: 100 } },
  ];
  const halfW = BOARD_TILE_COMPACT.w / 2;
  const halfH = BOARD_TILE_COMPACT.h / 2;

  it('centers a single focus tile on its middle, not its top-left corner', () => {
    expect(computeFocusCenter(nodes, ['A'])).toEqual({ x: halfW, y: halfH });
  });

  it('centers the bounding box of the whole focus set', () => {
    // A (0,0) and B (300,400): bbox of tile centers spans halfW..300+halfW,
    // halfH..400+halfH → center is the midpoint of each axis.
    expect(computeFocusCenter(nodes, ['A', 'B'])).toEqual({
      x: (halfW + 300 + halfW) / 2,
      y: (halfH + 400 + halfH) / 2,
    });
  });

  it('ignores focus ids that do not resolve to a node', () => {
    expect(computeFocusCenter(nodes, ['A', 'GHOST'])).toEqual({ x: halfW, y: halfH });
  });

  it('returns null when nothing resolves (camera stays put)', () => {
    expect(computeFocusCenter(nodes, ['GHOST'])).toBeNull();
    expect(computeFocusCenter([], ['A'])).toBeNull();
  });

  it('respects explicit tile dimensions', () => {
    expect(computeFocusCenter(nodes, ['A'], 100, 40)).toEqual({ x: 50, y: 20 });
  });
});
