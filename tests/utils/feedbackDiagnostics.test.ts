/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerDiagnostic,
  collectDiagnostics,
  installResizeObserverTrace,
  resetDiagnosticsForTests,
} from '../../src/utils/feedbackDiagnostics';

describe('feedbackDiagnostics (what a bug report carries beyond the screenshot)', () => {
  beforeEach(() => resetDiagnosticsForTests());

  it('always reports the display and the board, and a registered panel snapshot rides along', () => {
    const off = registerDiagnostic('panel:p1', () => ({ moneyCue: { color: '#d97706', word: '$3M to raise' }, painted: { valueColor: 'rgb(217, 119, 6)' } }));
    const d: any = collectDiagnostics();
    expect(d.display.inner).toMatch(/^\d+x\d+$/);
    expect(d.board).toBeNull(); // no board on this page
    expect(d['panel:p1'].painted.valueColor).toBe('rgb(217, 119, 6)');
    off();
    expect((collectDiagnostics() as any)['panel:p1']).toBeUndefined();
  });

  it('a snapshot that throws is reported as an error and does not stop the rest', () => {
    registerDiagnostic('bad', () => { throw new Error('boom'); });
    registerDiagnostic('good', () => ({ ok: 1 }));
    const d: any = collectDiagnostics();
    expect(d.bad).toEqual({ error: 'boom' });
    expect(d.good).toEqual({ ok: 1 });
  });

  it('an oversized report is cut down to a note rather than bloating the bug report', () => {
    registerDiagnostic('huge', () => 'x'.repeat(50000));
    const d: any = collectDiagnostics();
    expect(d.error).toMatch(/too large/);
    expect(d.huge).toBeUndefined();
  });

  it('reads the React Flow camera and counts buildings inside the board box', () => {
    document.body.innerHTML = '<div class="react-flow"><div class="react-flow__viewport" style="transform: translate(10px, 20px) scale(0.5)"><div class="react-flow__node" data-id="b1"></div></div></div>';
    const d: any = collectDiagnostics();
    expect(d.board.transform).toContain('scale(0.5)');
    expect(d.board.nodes).toBe(1);
    expect(d.board.firstNodeIds).toEqual(['b1']);
    document.body.innerHTML = '';
  });

  it('counts nodes React Flow still hides because it never measured them (fb:5618257f blank town)', () => {
    document.body.innerHTML = '<div class="react-flow"><div class="react-flow__viewport"><div class="react-flow__node" data-id="town-ground" style="visibility: hidden"></div><div class="react-flow__node" data-id="owner" style="visibility: visible"></div></div></div>';
    const d: any = collectDiagnostics();
    expect(d.board.nodesHidden).toBe(1);
    expect(d.board.hiddenNodeIds).toEqual(['town-ground']);
    document.body.innerHTML = '';
  });

  it('traces ResizeObserver: remembers where observers were created and which ran before the loop error', () => {
    class Fake { cb: ResizeObserverCallback; constructor(cb: ResizeObserverCallback) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} }
    (window as any).ResizeObserver = Fake;
    installResizeObserverTrace();
    const seen = vi.fn();
    const ro: any = new (window as any).ResizeObserver(seen);
    const watched = document.createElement('div'); watched.setAttribute('data-testid', 'town-wrapper'); watched.className = 'react-flow extra';
    ro.observe(watched);
    ro.cb([], ro); // the browser delivering a notification
    expect(seen).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
    const r: any = (collectDiagnostics() as any).resizeObserver;
    expect(r.traced).toBe(true);
    expect(r.errors).toBe(1);
    expect(r.lastError.suspect).toEqual(expect.any(String));
    expect(r.lastError.suspectTargets).toEqual(['div[town-wrapper].react-flow.extra']);
    expect(r.callbacksByCreationSite[0].count).toBe(1);
  });
});
