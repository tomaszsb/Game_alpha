// ===================================================================
// TV layout scale — how much room the TV screen gets to lay things out in.
//
// WHY THIS EXISTS (fb:93449bf2, 2026-08-30)
//
// The reporter's 75" 4K television hands the app a layout viewport of
// 960x540 and a devicePixelRatio of ~4. Those two numbers together mean the
// panel really is 3840x2160 — every glyph is drawn at 4 device pixels per
// layout pixel, so the picture is not blurry in the slightest. What IS small
// is the amount of ROOM: the app is arranging a whole board game on a
// phone-sized sheet and the TV then blows that sheet up to 75 inches. His
// words: "the resolution on the screen is very low as if on the phone but
// this TV is capable of doing 4K so if we readjust the entire screen for 4K
// resolution you could fit a lot more things on it."
//
// He is right about the cause. The obvious fix backfires, though, and that
// is the whole reason this file is a CHOICE and not a constant. Widening the
// layout viewport genuinely buys room, but it shrinks everything on screen
// by exactly the same factor, and this app's other TV thread (v3.0.138-142)
// was the opposite complaint — text too small to read from a couch. Running
// the geometry for a 75" 4K panel at 10 feet, with 16px body text:
//
//   layout 960  -> 0.52 deg of visual angle   generous (today)
//   layout 1280 -> 0.39 deg                   comfortable, +78% room
//   layout 1920 -> 0.26 deg                   marginal,    +300% room
//   layout 3840 -> 0.13 deg                   unreadable  ("true 4K")
//
// So "just set it to 4K" would fit sixteen times as much and make all of it
// illegible. 1280 is the sweet spot for a 75" set at 10 feet.
//
// WHY WE ASK INSTEAD OF DECIDING
//
// The one input that actually settles this is the one no browser API will
// ever report: how physically big the screen is and how far away the viewer
// is sitting. A 32" 4K monitor at arm's length and a 75" 4K TV across a
// classroom report IDENTICAL numbers — same layout width, same pixel ratio,
// same everything. The table above is therefore a good default and a bad
// certainty. So the viewer picks, once, from real text samples rendered at
// the real resulting sizes (see previewFontPx), and we remember it per
// device. Maintainer's own idea, 2026-09-01.
//
// Pure/localStorage-only logic lives here rather than in the component so it
// is unit-testable without rendering anything — same reasoning as
// boardCommon.ts's camera-memory helpers.
// ===================================================================

export const TV_SCALE_STORAGE_KEY = 'ucTvLayoutWidth';

/** The layout width the app has always used: whatever the device reports. */
export const TV_SCALE_NATIVE = 0;

export interface TvScaleOption {
  id: string;
  /** Layout width in CSS px, or TV_SCALE_NATIVE to leave the device alone. */
  layoutWidth: number;
  label: string;
  blurb: string;
}

/** Offered largest-text-first, because a viewer who cannot read the smaller
 *  samples must not have to scroll past them to find the one they can. */
export const TV_SCALE_OPTIONS: TvScaleOption[] = [
  { id: 'xl', layoutWidth: TV_SCALE_NATIVE, label: 'Biggest text', blurb: 'Least fits on screen' },
  { id: 'lg', layoutWidth: 1152, label: 'Big text', blurb: 'A little more fits' },
  { id: 'md', layoutWidth: 1280, label: 'Medium text', blurb: 'Recommended for most rooms' },
  { id: 'sm', layoutWidth: 1600, label: 'Small text', blurb: 'Most fits on screen' },
];

/** The layout width the device reports on its own, before any override.
 *  `screen.width` rather than `innerWidth` for the same reason
 *  deviceDetection.ts uses it: it doesn't move when a viewport override,
 *  split-screen or browser zoom is in play, so re-reading it after we've
 *  applied an override still returns the device's real answer. */
export function getNativeLayoutWidth(): number {
  if (typeof window === 'undefined') return 0;
  return window.screen?.width || window.innerWidth || 0;
}

export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0
    ? window.devicePixelRatio
    : 1;
}

/** Real pixels across the physical panel — the number the TV never says out
 *  loud. 960 layout px at ratio 4 is a 3840px (4K) panel. */
export function getPanelPixelWidth(): number {
  return Math.round(getNativeLayoutWidth() * getDevicePixelRatio());
}

/** Is there anything to gain here? Only when the panel has pixels the layout
 *  isn't spending: a high ratio AND a cramped native width. A 1080p laptop
 *  (ratio 1, native 1920) has no headroom and must never be touched, and
 *  neither must a phone — widening a 390px phone to 1280 would be unusable.
 *  The 600px floor is what separates "a TV that under-reports" from "a small
 *  screen that is genuinely small". */
export function tvScaleIsAvailable(): boolean {
  const native = getNativeLayoutWidth();
  return getDevicePixelRatio() >= 1.5 && native >= 600 && native < 1280;
}

/** Reads this device's stored choice, or null if never set / unavailable.
 *  Returns the raw stored width including TV_SCALE_NATIVE (0), which is a
 *  real choice ("I picked biggest") and not the same as "never asked". */
export function readTvLayoutWidth(): number | null {
  try {
    const raw = localStorage.getItem(TV_SCALE_STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null; // storage unavailable — behave as if never asked
  }
}

export function writeTvLayoutWidth(width: number): void {
  try {
    localStorage.setItem(TV_SCALE_STORAGE_KEY, String(width));
  } catch {
    /* storage unavailable — the choice just won't survive this session */
  }
}

/** Rewrites the document's viewport meta tag. This is the entire mechanism:
 *  one number, one tag. Note it is a no-op on desktop browsers, which ignore
 *  the viewport meta altogether — which is exactly the safety property we
 *  want, since a desktop has no headroom to reclaim anyway. */
export function applyTvLayoutWidth(width: number): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  meta.setAttribute(
    'content',
    width === TV_SCALE_NATIVE
      ? 'width=device-width, initial-scale=1.0, viewport-fit=cover'
      : `width=${width}, viewport-fit=cover`,
  );
}

/** Font size to render a preview sample at, so that it appears on screen at
 *  the same PHYSICAL size the real UI would once `layoutWidth` is applied.
 *
 *  Physical height is cssPx * (panelPixels / layoutWidth), so to preview
 *  layout width W while still at native width N, show N/W of the real size.
 *  Previewing 16px body text at layout 1280 on a 960 device means drawing it
 *  at 12px. Without this the samples would all look identical and the
 *  question would be unanswerable. */
export function previewFontPx(baseCssPx: number, layoutWidth: number, nativeWidth: number): number {
  if (layoutWidth === TV_SCALE_NATIVE || layoutWidth <= 0 || nativeWidth <= 0) return baseCssPx;
  return Math.round(baseCssPx * (nativeWidth / layoutWidth) * 10) / 10;
}

/** Applies the stored choice, if this device has one and has headroom.
 *  Returns the width applied, or null if nothing was changed. Safe to call
 *  on every TV mount — writing the same content back is inert. */
export function applyStoredTvLayoutWidth(): number | null {
  if (!tvScaleIsAvailable()) return null;
  const stored = readTvLayoutWidth();
  if (stored === null) return null;
  applyTvLayoutWidth(stored);
  return stored;
}
