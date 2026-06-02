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
import { computeTileVisualState } from '../../../src/utils/boardCommon';

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
