// src/utils/townCamera.ts
//
// "Can the camera see the town at all?" (fb:a6474bad, 2026-10-14: a TV showed the
// board's sky with no buildings, mid-game, after the player had been looking at their
// phone). The exact way the camera got lost was never reproduced (no TV browser here;
// no later report carried the camera diagnostics), so the town board heals itself:
// when this says the view holds no building, the following screen re-frames.

export interface Viewport { x: number; y: number; zoom: number }
export interface Box { x: number; y: number; width: number; height: number }

/** True when the camera is broken (not a number, zero zoom) or no building box overlaps the screen. */
export function cameraSeesNothing(viewport: Viewport, buildings: Box[], screen: { width: number; height: number }): boolean {
  const { x, y, zoom } = viewport;
  if (![x, y, zoom].every(Number.isFinite) || zoom <= 0) return true;
  if (!(screen.width > 0 && screen.height > 0) || buildings.length === 0) return false; // nothing to judge yet
  // The screen in town coordinates.
  const left = -x / zoom, top = -y / zoom;
  const right = left + screen.width / zoom, bottom = top + screen.height / zoom;
  return !buildings.some(b => Number.isFinite(b.x) && Number.isFinite(b.y)
    && b.x < right && b.x + (b.width || 0) > left && b.y < bottom && b.y + (b.height || 0) > top);
}
