// public/sw.js
//
// Minimal service worker — exists only to satisfy PWA installability
// criteria (browsers require a registered SW with a fetch handler before
// offering an install prompt). Deliberately does NOT cache anything: this
// app's data (CSV configs, admin edits) changes and must never be served
// stale from a service-worker cache.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op passthrough — every request still goes straight to the network.
});
