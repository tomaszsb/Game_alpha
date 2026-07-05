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

// Browser-notification reminders (Reminder Hub's "Browser Notification"
// option). The server (server/reminderScheduler.js) fires these via the Web
// Push API at the scheduled time, which works even if no tab is open —
// the browser wakes this service worker to handle it.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Unravel Codes';
  const options = {
    body: data.body || 'Ready to play?',
    icon: '/images/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
