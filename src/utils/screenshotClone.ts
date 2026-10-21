// src/utils/screenshotClone.ts
// Prepares html2canvas's cloned document so an open modal is actually in the
// bug-report screenshot.
//
// fb:feedback-1788494446686-f33ae50b — "modal does not get captured in the
// screenshot". Reproduced 2026-09-16 with the player panel's "Your Expeditors"
// list: the screenshot showed the panel dimmed and no modal. Mechanism: a
// ModalBase opened from INSIDE the player panel renders its `position: fixed`
// overlay as a DOM descendant of the panel card, which has `overflow: hidden`.
// A real browser does not clip a fixed element to a non-containing ancestor's
// overflow; html2canvas does. So the overlay was painted only inside the
// panel's rectangle (the grey panel) and the centred dialog, lying outside
// that rectangle, was clipped away entirely. Modals rendered outside the panel
// (dice results, the replace picker) were never affected, which is why only
// some reports lost their modal.
//
// The fix lives on the CLONE only: move each open modal's outermost fixed
// layer to the clone's <body>, where no ancestor can clip it. The live page is
// never touched, so this cannot change what a player sees.

/** Moves every open modal's outermost `position: fixed` wrapper to the end of
 *  `doc.body`. Returns how many were moved. */
export function liftModalsForCapture(doc: Document): number {
  const view = doc.defaultView;
  if (!view || !doc.body) return 0;

  const layers = new Set<HTMLElement>();
  doc.querySelectorAll<HTMLElement>('[aria-modal="true"]').forEach((dialog) => {
    let outermostFixed: HTMLElement | null = null;
    for (let n: HTMLElement | null = dialog; n && n !== doc.body; n = n.parentElement) {
      if (view.getComputedStyle(n).position === 'fixed') outermostFixed = n;
    }
    if (outermostFixed && outermostFixed.parentElement !== doc.body) layers.add(outermostFixed);
  });

  layers.forEach((layer) => doc.body.appendChild(layer));
  return layers.size;
}

// fb:feedback-1792542634551-92e01028 / b5689dfa (and 8 more since 2026-10-19) - "Screenshot capture
// failed: Attempting to parse an unsupported color function "color"". Mechanism: the player-coloured
// panel frame is `color-mix(in srgb, ...)` (src/utils/panelFrame.ts). Chrome reports a colour made by
// color-mix as `color(srgb r g b)` in getComputedStyle, and html2canvas 1.4.1 cannot parse that, so
// the whole capture threw and the report was saved with no picture (10 of the last 14 reports).
// The fix is again on the CLONE only: write every such value back as plain rgb() before html2canvas reads it.

const COLOR_FN = /color\((?:[^()]|\([^()]*\))*\)/g;
const COLOR_PROPS = [
  'color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'text-decoration-color', 'caret-color', 'column-rule-color', 'box-shadow', 'text-shadow', 'background-image',
];

/** Turns any CSS colour into rgb()/rgba() by painting one pixel; null when the browser cannot read it. */
export function colorToRgb(doc: Document, value: string): string | null {
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = value; // an unreadable value leaves the black we just set
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
}

/** Rewrites every `color(...)` in `value` through `toRgb`. Pure so it can be tested without a browser. */
export function replaceColorFunctions(value: string, toRgb: (c: string) => string | null): string {
  return value.replace(COLOR_FN, (m) => toRgb(m) ?? 'rgb(0, 0, 0)');
}

/** On the clone, writes plain rgb() over every computed colour html2canvas cannot parse. Returns how many properties changed. */
export function flattenModernColorsForCapture(doc: Document, toRgb: (c: string) => string | null = (c) => colorToRgb(doc, c)): number {
  const view = doc.defaultView;
  if (!view) return 0;
  let changed = 0;
  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const cs = view.getComputedStyle(el);
    for (const prop of COLOR_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (v && v.includes('color(')) {
        el.style.setProperty(prop, replaceColorFunctions(v, toRgb), 'important');
        changed++;
      }
    }
  });
  return changed;
}
