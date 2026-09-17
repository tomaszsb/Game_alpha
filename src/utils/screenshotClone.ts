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
