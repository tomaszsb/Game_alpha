import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DEFAULT_SEASON_ROWS, MAX_TINT_OPACITY, MIN_DAYLIGHT, configureSeasons, mixHex, parseSeasonsCsv, seasonLook } from '../../src/utils/townSeasons';

const file = fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES/TOWN_SEASONS.csv'), 'utf-8');

describe('TOWN_SEASONS.csv', () => {
  it('has twelve months and matches the built-in table (so a missing file looks the same)', () => {
    const rows = parseSeasonsCsv(file);
    expect(rows.length).toBe(12);
    expect(rows.map(r => Number(r.month))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    rows.forEach((r, i) => {
      const d = DEFAULT_SEASON_ROWS[i];
      for (const k of Object.keys(d)) {
        const a = r[k], b = d[k];
        if (/^[0-9.]+$/.test(a)) expect(Number(a), `${r.month} ${k}`).toBeCloseTo(Number(b), 5);
        else expect(a, `${r.month} ${k}`).toBe(b);
      }
    });
  });

  it('every colour is a #rrggbb colour, the tint is capped and the light never falls below the floor', () => {
    for (const r of parseSeasonsCsv(file)) {
      for (const k of ['water_light', 'water_dark', 'grass_light', 'grass_dark', 'edge_light', 'edge_dark', 'tint']) expect(r[k], `${r.month} ${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Number(r.tint_opacity)).toBeLessThanOrEqual(MAX_TINT_OPACITY);
      expect(Number(r.daylight)).toBeGreaterThanOrEqual(MIN_DAYLIGHT);
    }
  });

  it('gives a look for every month in both modes, and wraps round the year', () => {
    configureSeasons([]);
    for (let m = 1; m <= 12; m++) {
      expect(seasonLook(m, 'light').month).toBe(m);
      expect(seasonLook(m, 'dark').water).not.toBe(seasonLook(m, 'light').water);
    }
    expect(seasonLook(13, 'light').month).toBe(1);
    expect(seasonLook(0, 'light').month).toBe(12);
  });

  it('January is colder than July, and a board can swap the table', () => {
    configureSeasons([]);
    expect(seasonLook(1, 'light').water).not.toBe(seasonLook(7, 'light').water);
    const swapped = DEFAULT_SEASON_ROWS.map(r => ({ ...r, water_light: '#112233', tint_opacity: '0.9', daylight: '0.1' }));
    configureSeasons(swapped);
    const k = seasonLook(5, 'light');
    expect(k.water).toBe('#112233');
    expect(k.tintOpacity).toBe(MAX_TINT_OPACITY);
    expect(k.daylight).toBe(MIN_DAYLIGHT);
    configureSeasons([]);
  });

  it('a short or broken file keeps the built-in table', () => {
    configureSeasons([{ month: '1' }]);
    expect(seasonLook(3, 'light').water).toBe(DEFAULT_SEASON_ROWS[2].water_light);
    configureSeasons([]);
  });

  it('mixHex blends two colours', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('rgb(0,0,0)');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('rgb(255,255,255)');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
    expect(mixHex('red', '#ffffff', 0.5)).toBe('red');
  });
});
