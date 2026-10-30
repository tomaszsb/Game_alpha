// tvMeter - real numbers from real TVs (Tom's TV test, 2026-10-30), on the TV screen only: for each turn of the table,
// the frames seen, how long it took and the longest gap between two frames; and which remote buttons exist, by key NAME
// only (a letter or digit is sent as "char", never itself). Both go to the server log through the usual tracking call
// (PLAYTEST_TV_TURN, PLAYTEST_TV_KEYS), and the browser's name comes along. Counting frames asks the browser for a page
// frame each time, so the numbers can only understate the smoothness. It never touches the game.

import { trackPlaytestEvent } from '../playtest/playtestAnalytics';

const gameId = (): string | undefined => new URLSearchParams(window.location.search).get('g') ?? undefined;
const browserName = (): string => (navigator.userAgent || '').replace(/[^A-Za-z0-9 ;:/._()-]/g, '').slice(-58);

/** Counts one turn of `ms` and reports it when it ends; returns the way to stop it early. */
export function meterTvTurn(ms: number, players: number): () => void {
  if (typeof requestAnimationFrame !== 'function') return () => {};
  const asked = performance.now();
  let first = 0, last = 0, frames = 0, worst = 0, raf = 0;
  const tick = (t: number) => {
    if (!first) first = t;
    else worst = Math.max(worst, t - last);
    last = t;
    frames += 1;
    if (t - first < ms) raf = requestAnimationFrame(tick);
    else trackPlaytestEvent('tv_turn', { gameId: gameId(), frames, turnMs: Math.round(t - first), worstGapMs: Math.round(worst), startDelayMs: Math.round(first - asked), players, browser: browserName() });
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** A key's name, safe to send: named keys as they are, anything typed as just "char". */
export function keyNameOf(e: Pick<KeyboardEvent, 'key' | 'keyCode'>): string {
  const name = !e.key || e.key === 'Unidentified' ? `code${e.keyCode}` : e.key.length === 1 ? 'char' : e.key;
  return name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
}

const KEY_SEND_MS = 15000;

/** Listens for remote buttons on this screen and sends their names in small batches; returns the way to stop. */
export function logTvKeys(): () => void {
  let names: string[] = [];
  let timer: number | undefined;
  const send = () => {
    timer = undefined;
    if (names.length) trackPlaytestEvent('tv_keys', { gameId: gameId(), keys: names.join(' '), browser: browserName() });
    names = [];
  };
  const onKey = (e: KeyboardEvent) => {
    if (names.length < 30) names.push(keyNameOf(e));
    if (timer === undefined) timer = window.setTimeout(send, KEY_SEND_MS);
  };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(timer); send(); };
}
