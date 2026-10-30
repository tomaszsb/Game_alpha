// tvCamera - a TV's camera moves only by itself (Tom's TV test, 2026-10-30). Nobody steers a TV board, and its screen has
// no fit button to come back with, so a stray wheel, pinch or double-click must not move it. The game's own framing
// (fitView, setCenter) is not touched by these: they only turn off what a pointer can do.

export const TV_CAMERA_LOCK = {
  panOnDrag: false,
  panOnScroll: false,
  zoomOnScroll: false,
  zoomOnPinch: false,
  zoomOnDoubleClick: false,
  panActivationKeyCode: null,
  zoomActivationKeyCode: null,
} as const;

/** The React Flow settings for a screen: the lock on a TV, nothing otherwise. */
export function cameraLockFor(screen: string | undefined): Partial<typeof TV_CAMERA_LOCK> {
  return screen === 'tv' ? TV_CAMERA_LOCK : {};
}
