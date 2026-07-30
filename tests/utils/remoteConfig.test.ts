import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression cover for the fallback path in `fetchRemoteConfig`.
 *
 * The bug: the two fallback `return`s used `(configCache as any)[mode]`. The
 * cast silenced the declared `Record<string, ServiceVisibility> | null`, and
 * the cache genuinely can become null — the success branch stored whatever
 * the endpoint returned, including a literal `null` JSON body. After that,
 * the next failed fetch evaluated `(null as any)[mode]` and threw a
 * TypeError. One of those returns sits INSIDE the catch, so the throw escaped
 * `fetchRemoteConfig` entirely rather than degrading to the bundled default.
 *
 * `configCache` is module-level, so each case re-imports via resetModules to
 * get a fresh cache instead of leaking state between tests.
 */
describe('fetchRemoteConfig fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps serving the bundled default after a null body, then a failed fetch', async () => {
    const fetchMock = vi.fn()
      // 1. Endpoint answers 200 with a literal `null` body — this is what
      //    used to poison the cache.
      .mockResolvedValueOnce({ ok: true, json: async () => null })
      // 2. Next call fails outright, so the code must fall back to cache.
      .mockRejectedValueOnce(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchRemoteConfig } = await import('../../src/utils/remoteConfig');

    // A null body must not evict the bundled default.
    await expect(fetchRemoteConfig('game')).resolves.toMatchObject({ show_term: true });

    // The previously-crashing call: must resolve to the default, not throw.
    await expect(fetchRemoteConfig('game')).resolves.toMatchObject({ show_term: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back rather than throwing when the response is not ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchRemoteConfig } = await import('../../src/utils/remoteConfig');

    await expect(fetchRemoteConfig('game')).resolves.toMatchObject({ show_term: true });
  });

  it('returns null for a mode the config does not define, without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchRemoteConfig } = await import('../../src/utils/remoteConfig');

    await expect(fetchRemoteConfig('no-such-mode')).resolves.toBeNull();
  });

  it('serves a good response and caches it', async () => {
    const remote = { game: { show_term: false, show_category: false } };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => remote });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchRemoteConfig } = await import('../../src/utils/remoteConfig');

    await expect(fetchRemoteConfig('game')).resolves.toMatchObject({ show_term: false });
    // Second call inside the cache window must not re-fetch.
    await expect(fetchRemoteConfig('game')).resolves.toMatchObject({ show_term: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
