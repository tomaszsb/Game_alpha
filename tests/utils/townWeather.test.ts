import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { MAX_BITS_FULL, MAX_BITS_LIGHT, hash01, weatherBits, weatherFor, weatherPlan, NEXT_SCENE } from '../../src/utils/townWeather';
import { DEFAULT_SEASON_ROWS, configureSeasons, parseSeasonsCsv, seasonLook } from '../../src/utils/townSeasons';
import { getScene, setScene, useSceneMenu } from '../../src/utils/sceneSetting';
import { setTownAvailable } from '../../src/utils/boardStyle';
import { buildHeaderMenuItems } from '../../src/utils/headerMenuItems';
import { buildWeatherBands } from '../../src/components/board/TownWeather';

describe('weather picks', () => {
  const odds = { sun: 40, cloud: 30, rain: 20, snow: 10 };

  it('is the same every time for the same game, player and day, and changes only every 3 days', () => {
    expect(weatherFor('2026-10-25', 1, 40, odds)).toBe(weatherFor('2026-10-25', 1, 40, odds));
    expect(weatherFor('s', 0, 3, odds)).toBe(weatherFor('s', 0, 4, odds));
    expect(weatherFor('s', 0, 3, odds)).toBe(weatherFor('s', 0, 5, odds));
    expect(hash01('x')).toBe(hash01('x'));
    expect(hash01('x')).not.toBe(hash01('y'));
  });

  it('follows the odds over many blocks, and a month with no snow never snows', () => {
    const counts = { sun: 0, cloud: 0, rain: 0, snow: 0 };
    for (let d = 0; d < 3 * 2000; d += 3) counts[weatherFor('seed', 2, d, odds)]++;
    expect(counts.sun / 2000).toBeGreaterThan(0.33);
    expect(counts.sun / 2000).toBeLessThan(0.47);
    expect(counts.snow / 2000).toBeGreaterThan(0.06);
    for (let d = 0; d < 3000; d += 3) expect(weatherFor('seed', 0, d, { sun: 50, cloud: 30, rain: 20, snow: 0 })).not.toBe('snow');
    expect(weatherFor('s', 0, 5, { sun: 0, cloud: 0, rain: 0, snow: 0 })).toBe('sun');
  });
});

describe('the weather table', () => {
  const file = fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES/TOWN_SEASONS.csv'), 'utf-8');
  it('every month adds to 100, and snow only falls in the cold months', () => {
    configureSeasons([]);
    for (const r of parseSeasonsCsv(file)) {
      const sum = ['sun_pct', 'cloud_pct', 'rain_pct', 'snow_pct'].reduce((a, k) => a + Number(r[k]), 0);
      expect(sum, `month ${r.month}`).toBe(100);
    }
    for (let m = 1; m <= 12; m++) {
      const w = seasonLook(m, 'light').weather;
      if ([4, 5, 6, 7, 8, 9, 10].includes(m)) expect(w.snow, `month ${m}`).toBe(0);
    }
    expect(seasonLook(1, 'light').weather.snow).toBeGreaterThan(0);
    expect(DEFAULT_SEASON_ROWS.length).toBe(12);
  });
});

describe('what each band shows', () => {
  const on = { level: 'full' as const, light: false, reducedMotion: false };
  it('only the band whose turn it is moves; the others show still hints', () => {
    const a = weatherPlan('rain', { ...on, active: true });
    const b = weatherPlan('rain', { ...on, active: false });
    expect(a.moving).toBe(true);
    expect(b.moving).toBe(false);
    expect(b.bits).toBeGreaterThan(0);
    expect(b.bits).toBeLessThan(a.bits);
  });
  it('the bit counts stay under the caps, and fewer on a TV', () => {
    expect(weatherPlan('snow', { ...on, active: true }).bits).toBeLessThanOrEqual(MAX_BITS_FULL);
    expect(weatherPlan('snow', { ...on, active: true, light: true }).bits).toBeLessThanOrEqual(MAX_BITS_LIGHT);
    expect(weatherBits('x', 5)).toEqual(weatherBits('x', 5));
  });
  it('calm and reduced motion stand still, off draws nothing', () => {
    expect(weatherPlan('rain', { ...on, active: true, level: 'calm' }).moving).toBe(false);
    expect(weatherPlan('rain', { ...on, active: true, reducedMotion: true }).moving).toBe(false);
    expect(weatherPlan('rain', { ...on, active: true, reducedMotion: true }).bits).toBeGreaterThan(0);
    const off = weatherPlan('snow', { ...on, active: true, level: 'off' });
    expect([off.bits, off.clouds, off.moving, off.glow]).toEqual([0, 0, false, false]);
  });
  it('clear days have no falling bits; sun has a glow', () => {
    const sun = weatherPlan('sun', { ...on, active: true });
    expect(sun.bits).toBe(0);
    expect(sun.glow).toBe(true);
  });
});

describe('weather bands on a town', () => {
  it('one sky per band, only the active seat moves, all of it deterministic', () => {
    configureSeasons([]);
    const looks = [1, 7, 4].map(m => seasonLook(m, 'light'));
    const args = {
      layout: { bounds: { minCol: 0, maxCol: 24, minRow: 0, maxRow: 44 } },
      segments: [{ seat: 0, from: -1000, to: 16 }, { seat: 1, from: 16, to: 30 }, { seat: 2, from: 30, to: 1000 }],
      looks, days: [10, 100, 200], seed: '2026-10-25', activeSeat: 1, level: 'full' as const, light: false, reducedMotion: false, tile: 50, originX: -1000, originY: -100,
    };
    const a = buildWeatherBands(args);
    expect(a.length).toBe(3);
    expect(a.map(b => b.plan.moving)).toEqual([false, true, false]);
    expect(buildWeatherBands(args)).toEqual(a);
    expect(buildWeatherBands({ ...args, level: 'off' }).every(b => b.plan.bits === 0 && b.plan.clouds === 0)).toBe(true);
  });
});

describe('the Scene switch', () => {
  beforeEach(() => { localStorage.clear(); setTownAvailable(false); });
  it('starts Full, goes Full, Calm, Off and round, and is remembered on this device', () => {
    expect(getScene()).toBe('full');
    expect(NEXT_SCENE.full).toBe('calm');
    expect(NEXT_SCENE.calm).toBe('off');
    expect(NEXT_SCENE.off).toBe('full');
    setScene('calm');
    expect(getScene()).toBe('calm');
    localStorage.setItem('uc-scene', 'nonsense');
    expect(getScene()).toBe('full');
  });
  it('the menu offers it only when the board has a town, in words', () => {
    const { result } = renderHook(() => useSceneMenu());
    expect(result.current).toBeUndefined();
    act(() => setTownAvailable(true));
    expect(result.current).toMatchObject({ level: 'full' });
    act(() => result.current!.toggle());
    expect(result.current).toMatchObject({ level: 'calm' });
    const items = buildHeaderMenuItems({ speed: { fast: false, toggle: () => {} }, scene: { level: 'calm', toggle: () => {} } });
    const item = items.find(i => i.id === 'scene');
    expect(item?.label).toBe('Scene: Calm');
    expect(item?.testId).toBe('scene-toggle');
  });
});
