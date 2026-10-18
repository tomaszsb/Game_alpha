// public/error-handler.js is the one script that must run on browsers too old for
// the game itself (TV browsers). 2026-10-18: Tom on a Samsung TV sat on "Loading..."
// forever with no tip, because the 10-second check looked for text the loading
// screen no longer shows ("Loading Unravel Codes...").
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';

const ROOT = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(ROOT, 'public/error-handler.js'), 'utf-8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const rootMarkup = html.slice(html.indexOf('<div id="root">'), html.indexOf('<!-- Load the React application -->'));

afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('error-handler.js (loading-screen tip)', () => {
  it('is plain ES5, so an old TV browser can run it', () => {
    expect(() => acorn.parse(script, { ecmaVersion: 5 })).not.toThrow();
  });

  it('shows the tip after 10 s while the real loading screen is still up', () => {
    vi.useFakeTimers();
    document.body.innerHTML = rootMarkup;
    const tip = document.getElementById('loading-tip')!;
    expect(tip).toBeTruthy();
    new Function(script)();
    vi.advanceTimersByTime(9_999);
    expect(tip.style.display).not.toBe('block');
    vi.advanceTimersByTime(2);
    expect(tip.style.display).toBe('block');
  });

  it('stays hidden once the game has replaced the loading screen', () => {
    vi.useFakeTimers();
    document.body.innerHTML = rootMarkup + '<div id="loading-tip"></div>';
    document.getElementById('root')!.innerHTML = '<div class="app">game</div>';
    new Function(script)();
    vi.advanceTimersByTime(10_001);
    expect(document.getElementById('loading-tip')!.style.display).not.toBe('block');
  });

  it('the tip tells Samsung and LG TV owners what actually works', () => {
    expect(rootMarkup).toMatch(/Samsung or LG TV/);
    expect(rootMarkup).toMatch(/screen mirroring or an HDMI cable/);
  });
});
