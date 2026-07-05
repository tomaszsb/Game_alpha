// src/main.tsx

import React from 'react';
import { createRoot } from 'react-dom/client';
import { installConsoleCapture } from './utils/consoleCapture';
import { App } from './App';
import { PlaytesterLandingPage } from './playtest/PlaytesterLandingPage';
import { capturePwaInstallPrompt } from './playtest/pwaInstall';

// Install console capture early so we catch errors during init
installConsoleCapture();

// PWA installability + push-reminder delivery both need the service worker
// registered (a no-op passthrough for fetch — see public/sw.js — so this is
// safe in dev too; localhost counts as a secure context for SW/Push). Must
// run before React renders so the beforeinstallprompt listener is attached
// in time.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* non-critical */ });
}
capturePwaInstallPrompt();

/**
 * Main entry point for the React application.
 * Uses ReactDOM.createRoot() to mount the App component into the DOM.
 */
function main(): void {
  const container = document.getElementById('root');

  if (!container) {
    throw new Error('Root element not found. Make sure there is a div with id="root" in your HTML.');
  }

  const root = createRoot(container);

  // /challenge is the playtester-acquisition landing page (QR code target).
  // Checked here, before <App/> ever mounts, because App auto-creates a new
  // backend game on every load lacking a ?g= param — a landing-page visit
  // must not trigger that. See src/playtest/PlaytesterLandingPage.tsx.
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '/challenge') {
    root.render(<PlaytesterLandingPage />);
  } else {
    root.render(<App />);
  }
}

// Initialize the application
main();