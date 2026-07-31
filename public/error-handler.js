// public/error-handler.js
//
// Extracted from an inline <script> in index.html so it loads as an
// ordinary same-origin script file — that lets the CSP's script-src stay
// 'self' with no 'unsafe-inline' and no hash to keep in sync by hand.
// The reload button below used to be an inline onclick="..." attribute,
// which CSP treats the same as inline script; it's now wired with
// addEventListener for the same reason.

// Error handler for module loading failures.
// Only triggers on actual resource load errors (e.target is an HTMLElement like a failed <script>).
// Runtime errors and benign browser warnings (e.g. "ResizeObserver loop completed with undelivered notifications")
// are logged but must NOT hide the app — they were previously knocking the user into the fallback UI.
window.addEventListener('error', function(e) {
    var target = e.target;
    var isResourceLoadError = target && target !== window && target.tagName;
    if (!isResourceLoadError) {
        console.error('Runtime error (not blocking app):', e.message || e);
        return;
    }
    // ONLY a failure of the app's own entry/chunk scripts (same-origin) is
    // fatal. Third-party scripts must never take the game down — most
    // notably Cloudflare's auto-injected analytics beacon
    // (static.cloudflareinsights.com/beacon.min.js), which a VPN, ad
    // blocker, or content filter can block or alter, producing a CORS /
    // SRI-integrity failure. That fired the fallback and made a perfectly
    // healthy game read as "Failed to Load Application" for any privacy-
    // tool user (fb: Filip / Firefox+VPN report, 2026-07-13). Failures of
    // other same-origin assets (images, CSS) are logged, not fatal either.
    var src = target.src || '';
    var isOwnScript = target.tagName === 'SCRIPT'
        && src.indexOf(window.location.origin + '/') === 0;
    if (!isOwnScript) {
        console.error('Non-critical resource failed to load (not blocking app):', src || target.tagName);
        return;
    }
    console.error('Application loading error:', e);
    document.getElementById('root').style.display = 'none';
    // The fallback markup is injected here, on genuine failure only —
    // not present in the DOM at all otherwise. It used to sit in the
    // initial HTML as display:none (plus aria-hidden as a later,
    // insufficient patch): some automated accessibility-tree
    // snapshots don't fully resolve computed style/ARIA state and
    // were picking up "Failed to Load Application" as a heading even
    // while the app loaded perfectly fine (TODO.md). An element that
    // was never in the DOM can't be picked up by anything.
    document.body.insertAdjacentHTML('beforeend',
        '<div id="error-fallback" class="error">' +
        '<h1>Failed to Load Application</h1>' +
        '<p>There was an error loading Unravel Codes.</p>' +
        '<p>Please check the console for more details.</p>' +
        '<button id="error-fallback-reload">Reload Page</button>' +
        '</div>');
    var reloadBtn = document.getElementById('error-fallback-reload');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', function() {
            window.location.reload();
        });
    }
}, true);

// Check if React loaded properly after a timeout. Some TV browsers
// hang indefinitely trying to load the JS bundle rather than firing
// a script error the handler above could catch — the visible tip
// (see #loading-tip in the loading screen markup) is the only way
// those users find out anything's wrong, since there's no console
// to check on a TV.
setTimeout(() => {
    const root = document.getElementById('root');
    const tip = document.getElementById('loading-tip');
    if (root && root.innerHTML.includes('Loading Unravel Codes...')) {
        console.warn('React application may have failed to load');
        if (tip) tip.style.display = 'block';
    }
}, 10000);
