// tests/utils/lastGameMemory.test.ts
// Covers the localStorage-backed "last game visited" helper behind the
// bare-URL "Resume your last game?" prompt (App.tsx) — a stripped link or
// a bookmark to the root domain used to silently start a brand-new game.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { getStoredLastGame, setStoredLastGame, clearStoredLastGame, stashResumeHint, consumeResumeHint } from '../../src/utils/lastGameMemory';

const KEY = 'unravelcodes:last-game';
const HINT_KEY = 'unravelcodes:resume-hint';

describe('lastGameMemory', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when nothing has been stored yet', () => {
    expect(getStoredLastGame()).toBeNull();
  });

  it('round-trips a gameId with a token', () => {
    setStoredLastGame('G-ABCD-1234', 'tok123');
    expect(getStoredLastGame()).toEqual({ gameId: 'G-ABCD-1234', token: 'tok123' });
  });

  it('round-trips a gameId with no token', () => {
    setStoredLastGame('G-ABCD-1234');
    expect(getStoredLastGame()).toEqual({ gameId: 'G-ABCD-1234', token: undefined });
  });

  it('clearStoredLastGame removes the record', () => {
    setStoredLastGame('G-ABCD-1234', 'tok123');
    clearStoredLastGame();
    expect(getStoredLastGame()).toBeNull();
  });

  it('ignores malformed JSON already in storage', () => {
    localStorage.setItem(KEY, 'not json');
    expect(getStoredLastGame()).toBeNull();
  });

  it('ignores a stored record missing a gameId', () => {
    localStorage.setItem(KEY, JSON.stringify({ token: 'tok123' }));
    expect(getStoredLastGame()).toBeNull();
  });

  it('read falls through to null when localStorage throws (private mode / disabled storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => getStoredLastGame()).not.toThrow();
    expect(getStoredLastGame()).toBeNull();
  });

  it('write silently no-ops when localStorage throws (private mode / disabled storage)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => setStoredLastGame('G-ABCD-1234')).not.toThrow();
  });

  it('clear silently no-ops when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => clearStoredLastGame()).not.toThrow();
  });
});

describe('resume hint (sessionStorage one-shot handoff)', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when nothing has been stashed', () => {
    expect(consumeResumeHint()).toBeNull();
  });

  it('round-trips a gameId with a token, then clears it (one-shot)', () => {
    stashResumeHint('G-ABCD-1234', 'tok123');
    expect(sessionStorage.getItem(HINT_KEY)).not.toBeNull();
    expect(consumeResumeHint()).toEqual({ gameId: 'G-ABCD-1234', token: 'tok123' });
    expect(sessionStorage.getItem(HINT_KEY)).toBeNull();
    expect(consumeResumeHint()).toBeNull();
  });

  it('round-trips a gameId with no token', () => {
    stashResumeHint('G-ABCD-1234');
    expect(consumeResumeHint()).toEqual({ gameId: 'G-ABCD-1234', token: undefined });
  });

  it('ignores malformed JSON already in storage', () => {
    sessionStorage.setItem(HINT_KEY, 'not json');
    expect(consumeResumeHint()).toBeNull();
  });

  it('ignores a stashed record missing a gameId', () => {
    sessionStorage.setItem(HINT_KEY, JSON.stringify({ token: 'tok123' }));
    expect(consumeResumeHint()).toBeNull();
  });

  it('stash silently no-ops when sessionStorage throws (private mode / disabled storage)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => stashResumeHint('G-ABCD-1234')).not.toThrow();
  });

  it('consume falls through to null when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => consumeResumeHint()).not.toThrow();
    expect(consumeResumeHint()).toBeNull();
  });
});
