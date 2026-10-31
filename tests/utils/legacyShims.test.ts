// @vitest-environment node
// public/legacy-shims.js stands in for browser features an older screen lacks (the classroom touch board, Chrome 95).
// The clone is judged against the real structuredClone on the same values, since it holds the whole game's state.
import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameStateSnapshotForTest } from './legacyShimsFixture';

const source = readFileSync(path.resolve(process.cwd(), 'public/legacy-shims.js'), 'utf8');
const native = globalThis.structuredClone;
const nativeTimeout = AbortSignal.timeout;
const install = () => new Function(source)();

describe('structuredClone stand-in', () => {
  let shim: typeof structuredClone;

  beforeEach(() => {
    // @ts-expect-error removing it is the point: this is what Chrome 95 looks like
    delete globalThis.structuredClone;
    install();
    shim = globalThis.structuredClone;
    expect(shim).not.toBe(native);
  });
  afterEach(() => {
    globalThis.structuredClone = native;
  });

  class Pawn {
    name = 'p';
    get label() {
      return 'x';
    }
  }
  const holey = [1, , 3]; // eslint-disable-line no-sparse-arrays

  const samples: Array<[string, () => unknown]> = [
    ['numbers, strings, null, undefined', () => ({ a: 1, b: 'two', c: null, d: undefined, e: NaN, f: -0, g: Infinity, h: true })],
    ['a bigint', () => ({ big: 10n })],
    ['nested arrays and objects', () => ({ a: [1, [2, { b: [3] }]], c: { d: { e: {} } } })],
    ['an array with holes', () => holey],
    ['a date', () => ({ when: new Date(1700000000000) })],
    ['a regular expression', () => /ab+c/gi],
    ['a Map and a Set', () => ({ m: new Map<unknown, unknown>([['k', { v: 1 }], [{ o: 1 }, 2]]), s: new Set([1, 'a', { z: 1 }]) })],
    ['boxed values', () => [new Number(1), new String('s'), new Boolean(false)]],
    ['a typed array and a buffer', () => ({ t: new Uint8Array([1, 2, 3]), b: new Uint16Array([9]).buffer })],
    ['a class instance (comes back plain)', () => new Pawn()],
    ['a getter (comes back as its value)', () => ({ get x() { return 5; } })],
    ['the top level being a plain value', () => 'just text'],
    ['a saved game', () => GameStateSnapshotForTest],
  ];

  it.each(samples)('copies %s exactly as the browser does', (_name, make) => {
    const value = make();
    const ours = shim(value);
    const theirs = native(value);
    expect(ours).toStrictEqual(theirs);
    expect(Object.prototype.toString.call(ours)).toBe(Object.prototype.toString.call(theirs));
  });

  it('keeps an array the same length and its holes as holes', () => {
    const copy = shim(holey) as unknown[];
    expect(copy.length).toBe(3);
    expect(1 in copy).toBe(false);
  });

  it('keeps a key whose value is undefined', () => {
    expect(Object.keys(shim({ a: undefined }) as object)).toEqual(['a']);
  });

  it('is a true copy: changing the copy never touches the original', () => {
    const state = structuredCloneInput();
    const copy = shim(state);
    copy.players[0].money = 999;
    copy.players[0].hand.push('W999');
    copy.when.setFullYear(1999);
    copy.seen.add('x');
    expect(state.players[0].money).toBe(100);
    expect(state.players[0].hand).toEqual(['W1']);
    expect(state.when.getFullYear()).toBe(2026);
    expect(state.seen.size).toBe(0);
  });

  it('keeps a loop and two names for one object', () => {
    const shared = { n: 1 };
    const loop: Record<string, unknown> = { a: shared, b: shared };
    loop.self = loop;
    const copy = shim(loop) as typeof loop;
    expect(copy.self).toBe(copy);
    expect(copy.a).toBe(copy.b);
    expect(copy.a).not.toBe(shared);
  });

  it('refuses what the browser refuses, with the same error name', () => {
    const refused: unknown[] = [() => 1, { f() {} }, Symbol('s'), [Symbol('s')], new WeakMap(), Promise.resolve()];
    for (const value of refused) {
      let ours: Error | undefined;
      let theirs: Error | undefined;
      try { shim(value); } catch (e) { ours = e as Error; }
      try { native(value); } catch (e) { theirs = e as Error; }
      expect(theirs?.name).toBe('DataCloneError');
      expect(ours?.name).toBe('DataCloneError');
    }
  });

  it('copies an error, keeping its kind and message', () => {
    const copy = shim(new RangeError('too far')) as Error;
    expect(copy).toBeInstanceOf(RangeError);
    expect(copy.message).toBe('too far');
  });

  it('asks for one argument, like the browser', () => {
    expect(() => (shim as unknown as () => unknown)()).toThrow(TypeError);
  });

  it('copies a game-sized state quickly enough for a slow board', () => {
    const big = { log: Array.from({ length: 5000 }, (_, i) => ({ id: i, text: `entry ${i}`, details: { a: [1, 2, 3] } })) };
    const start = performance.now();
    shim(big);
    expect(performance.now() - start).toBeLessThan(500);
  });

  function structuredCloneInput() {
    return { players: [{ money: 100, hand: ['W1'] }], when: new Date(2026, 5, 1), seen: new Set<string>() };
  }
});

describe('the stand-ins leave a modern browser alone', () => {
  it('does not replace a structuredClone or AbortSignal.timeout that already exist', () => {
    install();
    expect(globalThis.structuredClone).toBe(native);
    expect(AbortSignal.timeout).toBe(nativeTimeout);
  });
});

describe('AbortSignal.timeout stand-in', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // @ts-expect-error removing it is the point
    delete AbortSignal.timeout;
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true, writable: true });
    install();
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(AbortSignal, 'timeout', { value: nativeTimeout, configurable: true, writable: true });
  });

  it('aborts after the time and not before', () => {
    const signal = AbortSignal.timeout(5000);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(4999);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
  });
});

describe('index.html', () => {
  it('loads the stand-ins before the game', () => {
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const shims = html.indexOf('src="/legacy-shims.js"');
    expect(shims).toBeGreaterThan(-1);
    expect(shims).toBeLessThan(html.indexOf('src="src/main.tsx"'));
    // A plain script, so it runs before every module chunk. `defer` or `type=module` would break that.
    expect(html).toMatch(/<script src="\/legacy-shims\.js"><\/script>/);
  });
});
