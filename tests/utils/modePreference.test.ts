// tests/utils/modePreference.test.ts
// Covers the localStorage-backed "last explicit PC/TV choice" helper added
// for the Fire TV Silk-UA-spoof report — a "Request Desktop Site" reload
// used to lose the TV choice because nothing remembered it across reloads.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { getStoredPreferredMode, setStoredPreferredMode, resolveInitialMode } from '../../src/utils/modePreference';

const KEY = 'unravelcodes:preferred-mode';

describe('modePreference', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when nothing has been stored yet', () => {
    expect(getStoredPreferredMode()).toBeNull();
  });

  it('round-trips a stored "tv" choice', () => {
    setStoredPreferredMode('tv');
    expect(localStorage.getItem(KEY)).toBe('tv');
    expect(getStoredPreferredMode()).toBe('tv');
  });

  it('round-trips a stored "pc" choice', () => {
    setStoredPreferredMode('pc');
    expect(getStoredPreferredMode()).toBe('pc');
  });

  it('round-trips a stored "remote" choice', () => {
    setStoredPreferredMode('remote');
    expect(localStorage.getItem(KEY)).toBe('remote');
    expect(getStoredPreferredMode()).toBe('remote');
  });

  it('ignores garbage values already in storage', () => {
    localStorage.setItem(KEY, 'phone');
    expect(getStoredPreferredMode()).toBeNull();
  });

  it('read falls through to null when localStorage throws (private mode / disabled storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => getStoredPreferredMode()).not.toThrow();
    expect(getStoredPreferredMode()).toBeNull();
  });

  it('write silently no-ops when localStorage throws (private mode / disabled storage)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => setStoredPreferredMode('tv')).not.toThrow();
  });
});

describe('resolveInitialMode (setup-screen precedence)', () => {
  const smartTV = () => true;
  const notSmartTV = () => false;

  it('?mode= URL param wins over a stored preference', () => {
    expect(resolveInitialMode('pc', 'tv', smartTV)).toBe('pc');
    expect(resolveInitialMode('tv', 'pc', notSmartTV)).toBe('tv');
    expect(resolveInitialMode('remote', 'pc', notSmartTV)).toBe('remote');
  });

  it('a stored preference wins over isSmartTV() when there is no URL param', () => {
    expect(resolveInitialMode(null, 'pc', smartTV)).toBe('pc');
    expect(resolveInitialMode(null, 'tv', notSmartTV)).toBe('tv');
    expect(resolveInitialMode(null, 'remote', smartTV)).toBe('remote');
  });

  it('falls back to isSmartTV() when there is neither a URL param nor a stored preference', () => {
    expect(resolveInitialMode(null, null, smartTV)).toBe('tv');
    expect(resolveInitialMode(null, null, notSmartTV)).toBe('pc');
  });

  it('never auto-detects "remote" — isSmartTV() only ever falls back to tv or pc', () => {
    expect(resolveInitialMode(null, null, smartTV)).not.toBe('remote');
    expect(resolveInitialMode(null, null, notSmartTV)).not.toBe('remote');
  });

  it('ignores an unrecognized URL param and falls through to the next tier', () => {
    expect(resolveInitialMode('desktop', 'tv', notSmartTV)).toBe('tv');
    expect(resolveInitialMode('desktop', null, smartTV)).toBe('tv');
  });
});
