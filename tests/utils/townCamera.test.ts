import { describe, it, expect } from 'vitest';
import { cameraSeesNothing } from '../../src/utils/townCamera';

// fb:a6474bad (TV, 2026-10-14): the board showed only sky, no buildings. The town
// board now re-frames when this says the camera sees no building.
const town = [{ x: 0, y: 0, width: 200, height: 150 }, { x: 600, y: 300, width: 200, height: 150 }];
const screen = { width: 1000, height: 500 };

describe('cameraSeesNothing', () => {
  it('a camera on the town sees it', () => {
    expect(cameraSeesNothing({ x: 0, y: 0, zoom: 1 }, town, screen)).toBe(false);
    expect(cameraSeesNothing({ x: -500, y: -250, zoom: 1 }, town, screen)).toBe(false); // the second building
  });
  it('a camera pointed far away sees nothing', () => {
    expect(cameraSeesNothing({ x: 50_000, y: 50_000, zoom: 1 }, town, screen)).toBe(true);
    expect(cameraSeesNothing({ x: -5_000, y: 0, zoom: 1 }, town, screen)).toBe(true);
  });
  it('a broken camera (not a number, zero zoom) counts as seeing nothing', () => {
    expect(cameraSeesNothing({ x: NaN, y: 0, zoom: 1 }, town, screen)).toBe(true);
    expect(cameraSeesNothing({ x: 0, y: 0, zoom: 0 }, town, screen)).toBe(true);
    expect(cameraSeesNothing({ x: 0, y: Infinity, zoom: 1 }, town, screen)).toBe(true);
  });
  it('nothing to judge (no size yet, no buildings yet) is not an alarm', () => {
    expect(cameraSeesNothing({ x: 50_000, y: 0, zoom: 1 }, town, { width: 0, height: 0 })).toBe(false);
    expect(cameraSeesNothing({ x: 50_000, y: 0, zoom: 1 }, [], screen)).toBe(false);
  });
});
