// The "Something went wrong" screen leaves a trace on the server: what broke, version, browser, game code.
// Never a name, never a token from the link, and a crash that repeats cannot fill the log.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crashScreenLogFields } from '../../server/engagementStats.js';

const track = vi.fn();
vi.mock('../../src/playtest/playtestAnalytics', () => ({ trackPlaytestEvent: (...a: unknown[]) => track(...a) }));

async function fresh() {
  vi.resetModules();
  return import('../../src/utils/crashReport');
}

describe('reportCrash', () => {
  beforeEach(() => {
    track.mockClear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/?g=G-87VP-2J47&token=abc123secret&p=P2&role=phone');
  });

  it('sends the message, stack, version, browser and game code', async () => {
    const { reportCrash } = await fresh();
    const error = new ReferenceError('structuredClone is not defined');
    reportCrash(error);
    expect(track).toHaveBeenCalledTimes(1);
    const [event, details] = track.mock.calls[0];
    expect(event).toBe('crash_screen');
    expect(details.gameId).toBe('G-87VP-2J47');
    expect(details.message).toBe('structuredClone is not defined');
    expect(details.stack).toContain('ReferenceError');
    expect(details.browser).toBeTruthy();
    expect(details.version).toBeTruthy();
  });

  it('never carries the link token, even when the error text holds the link', async () => {
    const { reportCrash } = await fresh();
    const error = new Error('fetch failed for /api/games/G1/state?token=abc123secret&x=1');
    error.stack = 'Error: at https://game.unravelcodes.com/?g=G1&token=abc123secret:1:2';
    reportCrash(error);
    expect(JSON.stringify(track.mock.calls[0][1])).not.toContain('abc123secret');
  });

  it('sends no name and nothing else from the link', async () => {
    const { reportCrash } = await fresh();
    reportCrash(new Error('boom'));
    expect(Object.keys(track.mock.calls[0][1]).sort()).toEqual(['browser', 'gameId', 'message', 'stack', 'version']);
  });

  it('sends the same crash once per page', async () => {
    const { reportCrash } = await fresh();
    reportCrash(new Error('boom'));
    reportCrash(new Error('boom'));
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('stops after a few, even across reloads with different errors', async () => {
    for (let i = 0; i < 6; i++) {
      const { reportCrash } = await fresh(); // a reload
      reportCrash(new Error(`boom ${i}`));
    }
    expect(track).toHaveBeenCalledTimes(3);
  });

  it('still reports when the browser blocks storage, and never throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const { reportCrash } = await fresh();
    expect(() => reportCrash(new Error('boom'))).not.toThrow();
    expect(() => reportCrash(null)).not.toThrow();
    expect(track).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cuts a long message and stack down', async () => {
    const { reportCrash } = await fresh();
    const error = new Error('m'.repeat(5000));
    error.stack = 's'.repeat(9000);
    reportCrash(error);
    const details = track.mock.calls[0][1];
    expect(details.message.length).toBe(300);
    expect(details.stack.length).toBe(1500);
  });
});

describe('crashScreenLogFields (the server cleans it again)', () => {
  it('takes out a token and cuts to size', () => {
    const f = crashScreenLogFields({ message: 'x?token=abc&y=1', stack: 's'.repeat(9000), version: '3.9.13', browser: 'Chrome/95' });
    expect(f.message).toBe('x?token=[removed]&y=1');
    expect(f.stack?.length).toBe(1500);
    expect(f.version).toBe('3.9.13');
    expect(f.browser).toBe('Chrome/95');
  });

  it('keeps only its own fields and survives junk', () => {
    expect(crashScreenLogFields({ message: 5, name: 'Inka', token: 'abc' })).toEqual({ message: null, stack: null, version: null, browser: null });
    expect(crashScreenLogFields(undefined)).toEqual({ message: null, stack: null, version: null, browser: null });
  });
});
