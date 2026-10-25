// The town's twelve monthly looks (TOWN_SEASONS.csv). Each band of the town shows the look of the month its player's
// own days have reached: the blue of the water, the green of the grass, the light over the ground. A look only, no rule.
// The file is read by DataService and handed to configureSeasons; DEFAULT_SEASON_ROWS below is the same table, used when
// the file is missing (a test pins that they match). A different board swaps the file and gets a different year.

import type { PanelMode } from '../components/player/panelTheme';

export type SeasonRow = Record<string, string>;

export interface SeasonLook {
  month: number;
  water: string;
  grass: string;
  edge: string;
  /** A see-through colour laid over the ground for the month's light. */
  tint: string;
  tintOpacity: number;
  /** 1 = full light. Under 1 darkens the ground a little (never so far that names are hard to read). */
  daylight: number;
  /** Which picture the town's trees show this month: blossom, summer, autumn, bare or snowy. */
  tree: string;
  /** Weather odds for the month, in percent (add to 100): sun, cloud, rain, snow. */
  weather: { sun: number; cloud: number; rain: number; snow: number };
  /** Scenery for the month: flowers (most at once), fresh-grass share, snow drifts (most at once), fallen-leaf share. */
  props: { flowers: number; grassFresh: number; snowCover: number; leaves: number };
}

/** The tint is capped so any two neighbouring months still look good side by side. */
export const MAX_TINT_OPACITY = 0.18;
/** The ground is never darkened below this share of full light. */
export const MIN_DAYLIGHT = 0.85;
/** The pictures a tree can show (public/images/trees/<kind>_<look>.png). */
export const TREE_LOOKS = ['blossom', 'summer', 'autumn', 'bare', 'snowy'];

export const DEFAULT_SEASON_ROWS: SeasonRow[] = [
  { month: '1', water_light: '#b9d6e8', water_dark: '#16263a', grass_light: '#b8c7b0', grass_dark: '#34463a', edge_light: '#7d8c75', edge_dark: '#26352b', tint: '#dbe8f5', tint_opacity: '0.14', daylight: '0.9', tree_look: 'snowy', sun_pct: '30', cloud_pct: '30', rain_pct: '0', snow_pct: '40', flowers: '0', grass_fresh_pct: '0', snow_cover: '8', leaves_pct: '0' },
  { month: '2', water_light: '#b4d2e6', water_dark: '#162539', grass_light: '#bccab4', grass_dark: '#35473b', edge_light: '#7d8c75', edge_dark: '#26352b', tint: '#dbe8f5', tint_opacity: '0.12', daylight: '0.92', tree_look: 'snowy', sun_pct: '30', cloud_pct: '30', rain_pct: '0', snow_pct: '40', flowers: '0', grass_fresh_pct: '0', snow_cover: '8', leaves_pct: '0' },
  { month: '3', water_light: '#9fbfd4', water_dark: '#14243a', grass_light: '#9fb78a', grass_dark: '#324a36', edge_light: '#6c8a5c', edge_dark: '#233626', tint: '#cfd8e0', tint_opacity: '0.1', daylight: '0.94', tree_look: 'bare', sun_pct: '30', cloud_pct: '30', rain_pct: '25', snow_pct: '15', flowers: '0', grass_fresh_pct: '30', snow_cover: '0', leaves_pct: '15' },
  { month: '4', water_light: '#86cdf2', water_dark: '#122a42', grass_light: '#8fcf78', grass_dark: '#2f5434', edge_light: '#4f9a44', edge_dark: '#224027', tint: '#fff0f5', tint_opacity: '0.06', daylight: '1.0', tree_look: 'blossom', sun_pct: '40', cloud_pct: '30', rain_pct: '30', snow_pct: '0', flowers: '4', grass_fresh_pct: '70', snow_cover: '0', leaves_pct: '0' },
  { month: '5', water_light: '#7cc8f0', water_dark: '#112c46', grass_light: '#7fcb68', grass_dark: '#2e5a33', edge_light: '#468f3a', edge_dark: '#21452a', tint: '#fffbe0', tint_opacity: '0.05', daylight: '1.0', tree_look: 'summer', sun_pct: '50', cloud_pct: '30', rain_pct: '20', snow_pct: '0', flowers: '10', grass_fresh_pct: '100', snow_cover: '0', leaves_pct: '0' },
  { month: '6', water_light: '#5fb4e6', water_dark: '#102e4c', grass_light: '#78c25c', grass_dark: '#2d5e30', edge_light: '#3f8a35', edge_dark: '#204528', tint: '#ffe9a8', tint_opacity: '0.08', daylight: '1.0', tree_look: 'summer', sun_pct: '60', cloud_pct: '25', rain_pct: '15', snow_pct: '0', flowers: '12', grass_fresh_pct: '100', snow_cover: '0', leaves_pct: '0' },
  { month: '7', water_light: '#55abe0', water_dark: '#102f50', grass_light: '#6fb853', grass_dark: '#2c5c2e', edge_light: '#397d30', edge_dark: '#1f4326', tint: '#ffe08a', tint_opacity: '0.1', daylight: '1.0', tree_look: 'summer', sun_pct: '65', cloud_pct: '20', rain_pct: '15', snow_pct: '0', flowers: '12', grass_fresh_pct: '100', snow_cover: '0', leaves_pct: '0' },
  { month: '8', water_light: '#58aee2', water_dark: '#102f4e', grass_light: '#72b955', grass_dark: '#2c5c2f', edge_light: '#3a7f31', edge_dark: '#1f4426', tint: '#ffe39a', tint_opacity: '0.09', daylight: '1.0', tree_look: 'summer', sun_pct: '60', cloud_pct: '25', rain_pct: '15', snow_pct: '0', flowers: '10', grass_fresh_pct: '90', snow_cover: '0', leaves_pct: '0' },
  { month: '9', water_light: '#78b6d8', water_dark: '#132a40', grass_light: '#94b460', grass_dark: '#34532f', edge_light: '#5e8040', edge_dark: '#244025', tint: '#ffd9a0', tint_opacity: '0.08', daylight: '0.98', tree_look: 'summer', sun_pct: '50', cloud_pct: '30', rain_pct: '20', snow_pct: '0', flowers: '6', grass_fresh_pct: '70', snow_cover: '0', leaves_pct: '10' },
  { month: '10', water_light: '#7fa9c4', water_dark: '#142839', grass_light: '#b0a352', grass_dark: '#4a4a2c', edge_light: '#7a7035', edge_dark: '#383621', tint: '#ffc27a', tint_opacity: '0.1', daylight: '0.96', tree_look: 'autumn', sun_pct: '40', cloud_pct: '35', rain_pct: '25', snow_pct: '0', flowers: '2', grass_fresh_pct: '40', snow_cover: '0', leaves_pct: '70' },
  { month: '11', water_light: '#93a8b8', water_dark: '#16232f', grass_light: '#a39d78', grass_dark: '#40452f', edge_light: '#6f6a4a', edge_dark: '#32352a', tint: '#cfd2d8', tint_opacity: '0.12', daylight: '0.92', tree_look: 'bare', sun_pct: '30', cloud_pct: '35', rain_pct: '25', snow_pct: '10', flowers: '0', grass_fresh_pct: '20', snow_cover: '0', leaves_pct: '100' },
  { month: '12', water_light: '#a9c6dc', water_dark: '#16273a', grass_light: '#b9c4b6', grass_dark: '#34463a', edge_light: '#7b8a77', edge_dark: '#26352b', tint: '#dfe9f5', tint_opacity: '0.13', daylight: '0.9', tree_look: 'snowy', sun_pct: '25', cloud_pct: '30', rain_pct: '5', snow_pct: '40', flowers: '0', grass_fresh_pct: '0', snow_cover: '4', leaves_pct: '0' },
];

let rows: SeasonRow[] = DEFAULT_SEASON_ROWS;

/** Hand over the rows read from TOWN_SEASONS.csv (an empty list keeps the built-in table). */
export function configureSeasons(fileRows: SeasonRow[]): void {
  rows = fileRows.length >= 12 ? fileRows : DEFAULT_SEASON_ROWS;
}

const num = (s: string | undefined, fallback: number): number => {
  const n = parseFloat(s ?? '');
  return Number.isFinite(n) ? n : fallback;
};

/** The look for a month (1 to 12; anything else wraps round the year) in light or dark mode. */
export function seasonLook(month: number, mode: PanelMode): SeasonLook {
  const m = ((Math.floor(month) - 1) % 12 + 12) % 12 + 1;
  const r = rows.find(x => num(x.month, 0) === m) ?? DEFAULT_SEASON_ROWS[m - 1];
  const d = mode === 'dark';
  const base = DEFAULT_SEASON_ROWS[m - 1];
  return {
    month: m,
    water: (d ? r.water_dark : r.water_light) || (d ? base.water_dark : base.water_light),
    grass: (d ? r.grass_dark : r.grass_light) || (d ? base.grass_dark : base.grass_light),
    edge: (d ? r.edge_dark : r.edge_light) || (d ? base.edge_dark : base.edge_light),
    tint: r.tint || base.tint,
    tintOpacity: Math.min(MAX_TINT_OPACITY, Math.max(0, num(r.tint_opacity, 0))),
    daylight: Math.max(MIN_DAYLIGHT, Math.min(1, num(r.daylight, 1))),
    weather: {
      sun: num(r.sun_pct || base.sun_pct, 0), cloud: num(r.cloud_pct || base.cloud_pct, 0),
      rain: num(r.rain_pct || base.rain_pct, 0), snow: num(r.snow_pct || base.snow_pct, 0),
    },
    props: {
      flowers: num(r.flowers || base.flowers, 0), grassFresh: Math.min(100, Math.max(0, num(r.grass_fresh_pct || base.grass_fresh_pct, 0))),
      snowCover: num(r.snow_cover || base.snow_cover, 0), leaves: Math.min(100, Math.max(0, num(r.leaves_pct || base.leaves_pct, 0))),
    },
    tree: TREE_LOOKS.includes(r.tree_look) ? r.tree_look : base.tree_look,
  };
}

/** Blend two #rrggbb colours: t = 0 gives a, t = 1 gives b. Anything that is not #rrggbb comes back as a. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-f]{6})$/i.exec(a);
  const pb = /^#([0-9a-f]{6})$/i.exec(b);
  if (!pa || !pb) return a;
  const x = parseInt(pa[1], 16), y = parseInt(pb[1], 16);
  const ch = (shift: number) => Math.round(((x >> shift) & 255) * (1 - t) + ((y >> shift) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Read TOWN_SEASONS.csv text (a header row, then one row per month; no quoted commas). */
export function parseSeasonsCsv(text: string): SeasonRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const cols = lines[0].split(',').map(c => c.trim());
  return lines.slice(1).map(l => {
    const v = l.split(',');
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? '').trim()]));
  });
}
