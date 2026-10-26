// Which text colour (white or near-black) reads better on a player's colour: the one with the higher contrast.

const WHITE = '#ffffff';
const DARK = '#05070d';

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return 0.02; // unknown colour: treat as dark, so white wins
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio of two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or near-black, whichever has the better contrast on `bg`. */
export function inkOn(bg: string): { ink: string; shadow: string } {
  const useDark = contrastRatio(DARK, bg) > contrastRatio(WHITE, bg);
  return useDark
    ? { ink: DARK, shadow: '0 1px 1px rgba(255,255,255,0.35)' }
    : { ink: WHITE, shadow: '0 1px 1px rgba(0,0,0,0.5)' };
}
