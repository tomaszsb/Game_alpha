// src/utils/feedbackDiagnostics.ts
// What a bug report knows about the screen it came from, beyond the screenshot. A screenshot of a PHONE or TV is
// re-drawn by the capture tool and its colours cannot be trusted (fb:c65560a3: money "orange" with no word, and the
// same panel white in another report), and a blank board (fb:a6474bad) says nothing about WHY it is blank. So when the
// reporter presses the bug button, this collects numbers read straight from the live page and the live game:
//   - `display`: window / visual viewport / pixel ratio / TV layout width / theme / the viewport meta tag
//   - `board`: the React Flow camera (transform, zoom), the board's box, and how many buildings sit inside it
//   - `panel:<playerId>`: what the player panel computed (money cue colour + word, finances, scope two ways) next to the
//     colour the browser actually painted
//   - `resizeObserver`: how often the "ResizeObserver loop" error fired and the creation site of the observer that
//     was running when it did (the source nobody has found yet)
// It rides along with the report as `diagnostics` (read it from the per-id endpoint); it never blocks the report.

type Provider = () => unknown;

const providers = new Map<string, Provider>();

/** A component registers a snapshot function; returns the unregister function (call it in the effect cleanup). */
export function registerDiagnostic(name: string, provider: Provider): () => void {
  providers.set(name, provider);
  return () => {
    if (providers.get(name) === provider) providers.delete(name);
  };
}

const MAX_JSON_CHARS = 40000;

function safe<T>(fn: () => T): T | { error: string } {
  try {
    return fn();
  } catch (err) {
    return { error: String((err as Error)?.message ?? err).slice(0, 200) };
  }
}

function displaySnapshot(): Record<string, unknown> {
  const vv = window.visualViewport;
  const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null;
  let tvLayoutWidth: string | null = null;
  try { tvLayoutWidth = window.localStorage.getItem('ucTvLayoutWidth'); } catch { /* storage blocked */ }
  let panelMode: string | null = null;
  try { panelMode = window.localStorage.getItem('ucPanelMode'); } catch { /* storage blocked */ }
  return {
    inner: `${window.innerWidth}x${window.innerHeight}`,
    outer: `${window.outerWidth}x${window.outerHeight}`,
    visualViewport: vv ? { w: Math.round(vv.width), h: Math.round(vv.height), scale: vv.scale } : null,
    devicePixelRatio: window.devicePixelRatio,
    viewportMeta: meta,
    tvLayoutWidth,
    panelModeStored: panelMode,
    systemPrefersDark: typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : null,
    dataUcDark: document.documentElement.getAttribute('data-uc-dark'),
    visibility: document.visibilityState,
  };
}

/** The town / classic board camera, read from the page: why a canvas could be blank while its controls still show. */
function boardSnapshot(): Record<string, unknown> | null {
  const flow = document.querySelector('.react-flow');
  if (!flow) return null;
  const box = flow.getBoundingClientRect();
  const nodes = Array.from(document.querySelectorAll('.react-flow__node'));
  const visible = nodes.filter((n) => {
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;
  });
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  // React Flow keeps a node invisible until it has measured it (fb:5618257f: a blank town whose 14 nodes all sat
  // inside the box). Counting the hidden ones tells "never measured" apart from "drawn somewhere off-camera".
  const hidden = nodes.filter((n) => window.getComputedStyle(n).visibility === 'hidden');
  return {
    box: `${Math.round(box.width)}x${Math.round(box.height)}`,
    transform: viewport?.style.transform ?? null,
    nodes: nodes.length,
    nodesInsideBox: visible.length,
    nodesHidden: hidden.length,
    hiddenNodeIds: hidden.slice(0, 6).map((n) => n.getAttribute('data-id')),
    firstNodeIds: nodes.slice(0, 6).map((n) => n.getAttribute('data-id')),
    edges: document.querySelectorAll('.react-flow__edge').length,
  };
}

// ---- ResizeObserver trace -------------------------------------------------------------------------------------
// "ResizeObserver loop completed with undelivered notifications" is raised by the browser, with no stack that names
// the observer. Wrapping the constructor lets each observer remember WHERE it was created, and the one whose callback
// ran last before the error is the prime suspect. Behaviour is otherwise untouched.
const roTrace = {
  installed: false,
  created: new Map<string, number>(),
  fired: new Map<string, number>(),
  lastFired: null as string | null,
  /** What each creation site's observers watch (tag, test id, class): a minified production stack names no file, this does. */
  targets: new Map<string, Set<string>>(),
  errors: 0,
  lastError: null as { at: string; suspect: string | null; suspectTargets: string[]; message: string } | null,
};

function describeTarget(el: Element): string {
  const id = el.getAttribute?.('data-testid');
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return `${el.tagName?.toLowerCase() ?? '?'}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}`.slice(0, 80);
}

function creationSite(): string {
  const lines = (new Error().stack ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const frames = lines.filter((l) => (l.startsWith('at ') || l.includes('@')) && !l.includes('react-dom')).slice(2, 5);
  return frames.map((l) => l.replace(/https?:\/\/[^/]+/, '').slice(0, 110)).join(' < ') || 'unknown';
}

export function installResizeObserverTrace(): void {
  if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function' || roTrace.installed) return;
  roTrace.installed = true;
  const Native = window.ResizeObserver;
  class TracedResizeObserver extends Native {
    private readonly traceSite: string;
    constructor(callback: ResizeObserverCallback) {
      const site = creationSite();
      roTrace.created.set(site, (roTrace.created.get(site) ?? 0) + 1);
      super((entries, observer) => {
        roTrace.lastFired = site;
        roTrace.fired.set(site, (roTrace.fired.get(site) ?? 0) + 1);
        callback(entries, observer);
      });
      this.traceSite = site;
    }
    observe(target: Element, options?: ResizeObserverOptions): void {
      const seen = roTrace.targets.get(this.traceSite) ?? new Set<string>();
      if (seen.size < 4) seen.add(describeTarget(target));
      roTrace.targets.set(this.traceSite, seen);
      super.observe(target, options);
    }
  }
  window.ResizeObserver = TracedResizeObserver;
  window.addEventListener('error', (event) => {
    if (!/ResizeObserver loop/i.test(event.message || '')) return;
    roTrace.errors += 1;
    roTrace.lastError = {
      at: new Date().toISOString(),
      suspect: roTrace.lastFired,
      suspectTargets: roTrace.lastFired ? [...(roTrace.targets.get(roTrace.lastFired) ?? [])] : [],
      message: event.message.slice(0, 120),
    };
  });
}

function top(map: Map<string, number>, n: number): Array<{ site: string; count: number; watches: string[] }> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([site, count]) => ({ site, count, watches: [...(roTrace.targets.get(site) ?? [])] }));
}

function resizeObserverSnapshot(): Record<string, unknown> {
  return {
    traced: roTrace.installed,
    errors: roTrace.errors,
    lastError: roTrace.lastError,
    lastFiredBeforeNow: roTrace.lastFired,
    observersByCreationSite: top(roTrace.created, 8),
    callbacksByCreationSite: top(roTrace.fired, 8),
  };
}

/** Everything above, as plain JSON, capped so a report stays small. Never throws. */
export function collectDiagnostics(): Record<string, unknown> {
  const out: Record<string, unknown> = {
    collectedAt: new Date().toISOString(),
    display: safe(displaySnapshot),
    board: safe(boardSnapshot),
    resizeObserver: safe(resizeObserverSnapshot),
  };
  for (const [name, provider] of providers) out[name] = safe(provider);
  let text = '';
  try { text = JSON.stringify(out); } catch { return { collectedAt: out.collectedAt, error: 'not serialisable' }; }
  if (text.length > MAX_JSON_CHARS) return { collectedAt: out.collectedAt, error: `too large (${text.length} chars)`, display: out.display };
  return out;
}

/** Test hook: forget every registered provider and the trace. */
export function resetDiagnosticsForTests(): void {
  providers.clear();
  roTrace.created.clear();
  roTrace.fired.clear();
  roTrace.targets.clear();
  roTrace.lastFired = null;
  roTrace.errors = 0;
  roTrace.lastError = null;
}
