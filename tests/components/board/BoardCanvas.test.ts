/**
 * BoardCanvas.test.ts — tile size state machine
 *
 * Tests the computeTileVisualState pure function from boardCommon.ts.
 * This is the five-step priority hierarchy that decides how large each board
 * tile renders: editMode > expanded > currentBig > hover > validMove > compact.
 *
 * Testing the pure function is faster and more reliable than rendering the full
 * React Flow component, and covers exactly the logic the TODO spec describes.
 */

import { describe, it, expect } from 'vitest';
import { computeTileVisualState, resolveTileOverlap, resolveTileVisitType } from '../../../src/utils/boardCommon';

describe('computeTileVisualState — tile size state machine', () => {

  it('compact at mount (no flags set)', () => {
    const s = computeTileVisualState({});
    expect(s.size).toBe('compact');
    expect(s.width).toBe(150);
    expect(s.minHeight).toBe(60);
    expect(s.showsStory).toBe(false);
    expect(s.showsAction).toBe(false);
    expect(s.showsFullText).toBe(false);
  });

  it('validMove → hover-sized by default', () => {
    const s = computeTileVisualState({ isValidMove: true });
    expect(s.size).toBe('validMove');
    expect(s.width).toBe(180);
    expect(s.minHeight).toBe(90);
    expect(s.showsStory).toBe(true);
    expect(s.showsFullText).toBe(false);
  });

  it('hover → mid-size (triggered after 150 ms timer in component)', () => {
    const s = computeTileVisualState({ isHovered: true });
    expect(s.size).toBe('hover');
    expect(s.width).toBe(200);
    expect(s.minHeight).toBe(100);
    expect(s.zIndex).toBe(20);
    expect(s.showsStory).toBe(true);
    expect(s.showsFullText).toBe(false);
  });

  it('isCurrent → currentBig (fully expanded by default)', () => {
    const s = computeTileVisualState({ isCurrent: true });
    expect(s.size).toBe('currentBig');
    expect(s.width).toBe(240);
    expect(s.minHeight).toBe(130);
    expect(s.zIndex).toBe(25);
    expect(s.showsFullText).toBe(true);
    expect(s.showsAction).toBe(true);
  });

  it('click → expanded (same footprint as currentBig, highest z)', () => {
    const s = computeTileVisualState({ isExpanded: true });
    expect(s.size).toBe('expanded');
    expect(s.width).toBe(240);
    expect(s.minHeight).toBe(130);
    expect(s.zIndex).toBe(30);
    expect(s.showsFullText).toBe(true);
  });

  it('admin edit mode forces compact regardless of other flags', () => {
    // All flags set — editMode still wins
    const s = computeTileVisualState({
      isEditMode: true,
      isExpanded: true,
      isCurrent: true,
      isHovered: true,
      isValidMove: true,
    });
    expect(s.size).toBe('compact');
    expect(s.width).toBe(150);
  });

  it('expanded beats currentBig (click-lock wins over "you are here")', () => {
    const s = computeTileVisualState({ isExpanded: true, isCurrent: true });
    expect(s.size).toBe('expanded');
    expect(s.zIndex).toBe(30);
  });

  it('currentBig beats hover (current tile stays fully open while moused-over)', () => {
    const s = computeTileVisualState({ isCurrent: true, isHovered: true });
    expect(s.size).toBe('currentBig');
  });

  it('hover beats validMove', () => {
    const s = computeTileVisualState({ isHovered: true, isValidMove: true });
    expect(s.size).toBe('hover');
  });

});

describe('resolveTileOverlap — drag collision (fb:feedback-1782842971898-c73c35ca)', () => {
  const box = (x: number, y: number, w = 150, h = 60) => ({ x, y, w, h });

  it('no overlap → null (boxes fully apart)', () => {
    expect(resolveTileOverlap(box(0, 0), box(300, 300))).toBeNull();
  });

  it('boxes exactly touching (0 overlap) → null, not treated as a collision', () => {
    // Dragged right edge (150) exactly meets other's left edge (150).
    expect(resolveTileOverlap(box(0, 0), box(150, 0))).toBeNull();
  });

  it('resolves along X when the X-penetration is smaller — pushes away from the other box\'s center', () => {
    // Dragged at x=100 overlaps other at x=0 (w=150) by 50px on X; full 60px overlap on Y.
    const push = resolveTileOverlap(box(100, 0), box(0, 0));
    expect(push).not.toBeNull();
    expect(push!.dy).toBe(0);
    // Dragged center (175) is right of other's center (75) — push right (positive).
    expect(push!.dx).toBe(50);
  });

  it('resolves along Y when the Y-penetration is smaller — pushes away from the other box\'s center', () => {
    // Dragged at y=40 overlaps other at y=0 (h=60) by 20px on Y; full 150px overlap on X.
    const push = resolveTileOverlap(box(0, 40), box(0, 0));
    expect(push).not.toBeNull();
    expect(push!.dx).toBe(0);
    // Dragged center (70) is below other's center (30) — push down (positive).
    expect(push!.dy).toBe(20);
  });

  it('pushes toward negative when the dragged box is left/above the other box\'s center', () => {
    // Tall dragged box so Y-overlap (60) exceeds X-overlap (50) — resolves on X.
    // Dragged spans x:[-100,50] vs other x:[0,150] → 50px X-overlap.
    // Dragged center (-25) is left of other's center (75) — push further left.
    const push = resolveTileOverlap(box(-100, 0, 150, 200), box(0, 0));
    expect(push!.dx).toBe(-50);
    expect(push!.dy).toBe(0);
  });

  it('different tile sizes (measured, not a fixed constant) resolve correctly', () => {
    // A big 240x130 "current" tile dragged near a compact 150x60 sibling.
    const push = resolveTileOverlap(box(100, 0, 240, 130), box(0, 0, 150, 60));
    expect(push).not.toBeNull();
  });
});

describe('resolveTileVisitType — hover/expand narrative refresh on re-entry (Playwright playtest, LOW)', () => {
  it('space not yet visited by the active player → First', () => {
    const activePlayer = { visitedSpaces: ['OWNER-SCOPE-INITIATION'] };
    expect(resolveTileVisitType(activePlayer, 'ARCH-INITIATION')).toBe('First');
  });

  it('space already visited by the active player → Subsequent', () => {
    const activePlayer = { visitedSpaces: ['OWNER-SCOPE-INITIATION', 'ARCH-INITIATION'] };
    expect(resolveTileVisitType(activePlayer, 'ARCH-INITIATION')).toBe('Subsequent');
  });

  it('no active player (spectator/TV mode, currentPlayerId unset) → First, does not throw', () => {
    expect(resolveTileVisitType(undefined, 'ARCH-INITIATION')).toBe('First');
  });

  it('active player with no visitedSpaces field → First, does not throw', () => {
    expect(resolveTileVisitType({}, 'ARCH-INITIATION')).toBe('First');
  });

  it('is per-space: visiting one space does not mark a different space as visited', () => {
    const activePlayer = { visitedSpaces: ['ARCH-INITIATION'] };
    expect(resolveTileVisitType(activePlayer, 'ARCH-INITIATION')).toBe('Subsequent');
    expect(resolveTileVisitType(activePlayer, 'ENG-INITIATION')).toBe('First');
  });
});
