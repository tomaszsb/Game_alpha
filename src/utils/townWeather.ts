// The town's weather and light (TIME_ON_BOARD_DESIGN.md 2.8 and 2.9): which weather a player's band has now, and the
// still or falling bits that show it. Pure and seeded: the same game, player and day give the same sky on every screen
// (no random numbers). Weather changes every 3 of the player's own days. A look only, no rule.

export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'snow';
export type SceneLevel = 'full' | 'calm' | 'off';
export interface WeatherOdds { sun: number; cloud: number; rain: number; snow: number }

export const WEATHER_BLOCK_DAYS = 3;
/** Most falling bits drawn at once in the one moving band: PC detail, and a TV or remote strip. */
export const MAX_BITS_FULL = 40;
export const MAX_BITS_LIGHT = 14;
/** Falling bits a band that is not moving still shows as a still hint. */
export const STILL_BITS = 6;
/** Clouds in the moving band and in every other band (still). */
export const CLOUDS_ACTIVE = 4;
export const CLOUDS_STILL = 2;

/** A small, fixed hash of text to a number from 0 up to (not including) 1. */
export function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The weather for a player's band on their day number, picked once per 3-day block against the month's odds. */
export function weatherFor(seed: string, seat: number, days: number, odds: WeatherOdds): WeatherKind {
  const block = Math.floor(Math.max(0, days) / WEATHER_BLOCK_DAYS);
  const total = odds.sun + odds.cloud + odds.rain + odds.snow;
  if (total <= 0) return 'sun';
  let x = hash01(`${seed}|${seat}|${block}`) * total;
  for (const k of ['sun', 'cloud', 'rain', 'snow'] as const) {
    if (x < odds[k]) return k;
    x -= odds[k];
  }
  return 'sun';
}

export interface WeatherBit { x: number; y: number; r: number; phase: number }

/** `n` bit positions across a unit square (0 to 1), fixed by the seed, for falling rain or snow. */
export function weatherBits(seed: string, n: number): WeatherBit[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => ({
    x: hash01(`${seed}|x${i}`), y: hash01(`${seed}|y${i}`), r: hash01(`${seed}|r${i}`), phase: hash01(`${seed}|p${i}`),
  }));
}

export interface WeatherPlan {
  kind: WeatherKind;
  /** Falling bits (rain or snow). */
  bits: number;
  /** Clouds shown. */
  clouds: number;
  /** Whether bits and clouds move. */
  moving: boolean;
  /** Whether the sun glow shows. */
  glow: boolean;
}

/**
 * What to draw in one band. Only the band of the player whose turn it is moves (`active`); every other band shows still
 * hints. `level`: full = moving, calm = the same sky standing still, off = no weather. `light` = a TV or the remote strip
 * (fewer bits, clouds stay still).
 */
export function weatherPlan(kind: WeatherKind, opts: { active: boolean; level: SceneLevel; light: boolean; reducedMotion: boolean }): WeatherPlan {
  if (opts.level === 'off') return { kind, bits: 0, clouds: 0, moving: false, glow: false };
  const moving = opts.active && opts.level === 'full' && !opts.reducedMotion;
  const cap = opts.light ? MAX_BITS_LIGHT : MAX_BITS_FULL;
  const wet = kind === 'rain' || kind === 'snow';
  const bits = wet ? (opts.active ? cap : Math.min(cap, STILL_BITS)) : 0;
  const clouds = kind === 'cloud' || wet ? (opts.active ? CLOUDS_ACTIVE : CLOUDS_STILL) : kind === 'sun' ? 1 : 0;
  return { kind, bits, clouds, moving, glow: kind === 'sun' };
}

/** The scene switch goes Full, Calm, Off, Full. */
export const NEXT_SCENE: Record<SceneLevel, SceneLevel> = { full: 'calm', calm: 'off', off: 'full' };
