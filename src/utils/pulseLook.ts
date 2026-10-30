// pulseLook - one "look here" pulse for the whole game: the panel's first-visit button hint (uc-hint-glow,
// fb:e84e4d11) and the round town's move choices (Tom, 2026-10-29: "the buildings to highlight pulsate until chosen and
// then the chosen one is steady highlight and the unchosen are slow pulses and much less bright"). Same shape and
// rhythm everywhere: dim, bright at the middle, dim again, eased in and out. Only brightness and size move, never the
// colour. A town's own speeds and brightness come from TOWN.csv (`pulse_ms`, `pulse_rest_ms`, `pulse_glow`,
// `pulse_rest_glow`); these are the defaults.

export const PULSE_MS = 1800;
export const PULSE_EASING = 'ease-in-out';

/** The CSS `animation` value for a breathing pulse. */
export function pulseAnimation(keyframes: string, ms: number = PULSE_MS): string {
  return `${keyframes} ${Math.max(200, Math.round(ms))}ms ${PULSE_EASING} infinite`;
}

/** How a town's move choices pulse: a choice still open, and the ones left once a destination is picked. */
export interface PulseLook {
  ms: number;
  restMs: number;
  /** Brightness at the top of a pulse, 0..1. */
  glow: number;
  restGlow: number;
}

export function pulseLookOf(settings: Record<string, string>): PulseLook {
  const n = (key: string, fallback: number, lo: number, hi: number) => {
    const v = parseFloat(settings[key] ?? '');
    return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  };
  return {
    ms: n('pulse_ms', PULSE_MS, 200, 20000),
    restMs: n('pulse_rest_ms', PULSE_MS * 2, 200, 20000),
    glow: n('pulse_glow', 0.9, 0, 1),
    restGlow: n('pulse_rest_glow', 0.3, 0, 1),
  };
}
