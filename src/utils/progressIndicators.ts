// src/utils/progressIndicators.ts
//
// fb:f8491e74 — "I noticed one of the bars change from green to orange. I was
// not sure what that meant — there was no way to find out. I expected to hover
// and get a tooltip explaining what this item represents."
//
// Two of the per-player ProjectProgress bars are color-coded by threshold and
// previously had no explanation: the Design Fee bar and the Timeline bar. These
// pure helpers own the color thresholds AND the hover tooltip text, so the color
// and its explanation can never drift apart, and the thresholds are unit-tested.

export interface ProgressIndicator {
  /** Bar / label color for this value. */
  color: string;
  /** Plain-language hover tooltip explaining the value and what the color means. */
  tooltip: string;
}

// Shared palette (kept identical to the previous inline values so the visual
// treatment is unchanged — this refactor only adds tooltips + tests).
const GREEN = '#4caf50';
const YELLOW = '#ff9800';
const ORANGE = '#ff5722';
const RED = '#f44336';

/**
 * Design fees as a percentage of project scope. The game caps design fees at
 * 20%: hitting 20% in the DESIGN phase ends the project; later phases take a
 * time penalty instead. 4-tier scale: green <10, yellow 10–15, orange 15–20,
 * red ≥20.
 */
export function designFeeIndicator(ratioPct: number): ProgressIndicator {
  const pct = `${ratioPct.toFixed(1)}%`;
  if (ratioPct >= 20) {
    return { color: RED, tooltip: `Design fees: ${pct} of project scope — at or over the 20% cap. Reaching 20% in the Design phase ends the project; in later phases it adds a time penalty.` };
  }
  if (ratioPct >= 15) {
    return { color: ORANGE, tooltip: `Design fees: ${pct} of project scope — close to the 20% cap. Watch further design spending.` };
  }
  if (ratioPct >= 10) {
    return { color: YELLOW, tooltip: `Design fees: ${pct} of project scope — climbing toward the 20% cap.` };
  }
  return { color: GREEN, tooltip: `Design fees: ${pct} of project scope — comfortably under the 20% cap.` };
}

/**
 * Timeline: days used vs. estimated (base + work types + 10% contingency).
 * Green on track, orange ≥75% (eating into the contingency buffer), red ≥100%
 * (over the estimate).
 */
export function timelineIndicator(percentUsed: number): ProgressIndicator {
  const pct = `${Math.round(percentUsed)}%`;
  if (percentUsed >= 100) {
    return { color: RED, tooltip: `Timeline: ${pct} of the estimated days used — over the estimate (base + work types + 10% contingency).` };
  }
  if (percentUsed >= 75) {
    return { color: YELLOW, tooltip: `Timeline: ${pct} of the estimated days used — running long, into the 10% contingency buffer.` };
  }
  return { color: GREEN, tooltip: `Timeline: ${pct} of the estimated days used — on track (estimate = base + work types + 10% contingency).` };
}
