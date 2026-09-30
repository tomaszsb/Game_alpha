// tests/utils/wakeLock.test.ts
//
// fb:e766b9c2 (real TV, 2026-09-27): "I was working actively on my phone but the TV went
// to sleep." The TV only displays, so to it nobody is ever active. These pin the
// keeper: it asks for the screen lock, asks AGAIN when the page comes back (the browser
// drops the lock whenever the page is hidden), lets go on stop, and never breaks the
// screen when the browser refuses or has no such API.

import { describe, it, expect, vi } from 'vitest';
import { createWakeLockKeeper, isWakeLockSupported } from '../../src/utils/wakeLock';

function fakeSentinel() {
  const listeners: Array<() => void> = [];
  return {
    release: vi.fn(async () => undefined),
    addEventListener: (_t: 'release', l: () => void) => { listeners.push(l); },
    fireRelease: () => listeners.forEach((l) => l()),
  };
}

function fakeDoc(state = 'visible') {
  const handlers = new Set<() => void>();
  return {
    visibilityState: state,
    addEventListener: (_t: 'visibilitychange', l: () => void) => { handlers.add(l); },
    removeEventListener: (_t: 'visibilitychange', l: () => void) => { handlers.delete(l); },
    setVisibility(v: string) { this.visibilityState = v; handlers.forEach((h) => h()); },
    handlerCount: () => handlers.size,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('isWakeLockSupported', () => {
  it('is false when the browser has no wakeLock, true when it does', () => {
    expect(isWakeLockSupported({})).toBe(false);
    expect(isWakeLockSupported(undefined)).toBe(false);
    expect(isWakeLockSupported({ wakeLock: { request: async () => fakeSentinel() } })).toBe(true);
  });
});

describe('createWakeLockKeeper', () => {
  it('asks for the screen lock on start and releases it on stop', async () => {
    const s = fakeSentinel();
    const request = vi.fn(async () => s);
    const doc = fakeDoc();
    const keeper = createWakeLockKeeper({ wakeLock: { request } }, doc);
    keeper.start();
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
    keeper.stop();
    await flush();
    expect(s.release).toHaveBeenCalledTimes(1);
    expect(doc.handlerCount()).toBe(0);
  });

  it('asks again when the page becomes visible after the browser dropped the lock', async () => {
    const first = fakeSentinel();
    const second = fakeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const doc = fakeDoc();
    const keeper = createWakeLockKeeper({ wakeLock: { request } }, doc);
    keeper.start();
    await flush();
    // Screen goes off / tab hidden: the browser releases the lock on its own.
    first.fireRelease();
    doc.setVisibility('hidden');
    await flush();
    expect(request).toHaveBeenCalledTimes(1); // a hidden page is not asked (the API would refuse)
    doc.setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not ask twice while it already holds the lock', async () => {
    const request = vi.fn(async () => fakeSentinel());
    const doc = fakeDoc();
    const keeper = createWakeLockKeeper({ wakeLock: { request } }, doc);
    keeper.start();
    await flush();
    doc.setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('a refused request never throws and the keeper can still try again later', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('battery saver')).mockResolvedValueOnce(fakeSentinel());
    const doc = fakeDoc();
    const keeper = createWakeLockKeeper({ wakeLock: { request } }, doc);
    expect(() => keeper.start()).not.toThrow();
    await flush();
    doc.setVisibility('visible');
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('a browser with no wake lock is a quiet no-op', () => {
    const keeper = createWakeLockKeeper({}, fakeDoc());
    expect(() => { keeper.start(); keeper.stop(); }).not.toThrow();
  });

  it('stop() while a request is still in flight lets that lock go instead of keeping it', async () => {
    const s = fakeSentinel();
    let resolve!: (v: typeof s) => void;
    const request = vi.fn(() => new Promise<typeof s>((r) => { resolve = r; }));
    const keeper = createWakeLockKeeper({ wakeLock: { request } }, fakeDoc());
    keeper.start();
    keeper.stop();
    resolve(s);
    await flush();
    expect(s.release).toHaveBeenCalledTimes(1);
  });

  it('start() twice and stop() twice are harmless', async () => {
    const request = vi.fn(async () => fakeSentinel());
    const keeper = createWakeLockKeeper({ wakeLock: { request } }, fakeDoc());
    keeper.start();
    keeper.start();
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    keeper.stop();
    keeper.stop();
  });
});
