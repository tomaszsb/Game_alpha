// src/playtest/pwaInstall.ts
//
// Captures the browser's `beforeinstallprompt` event so the Reminder Hub can
// trigger a real "Install as an app" prompt later. Must be wired up before
// the event fires, so capturePwaInstallPrompt() is called once at app
// startup (main.tsx), before React ever renders.
//
// Safari on iOS never fires beforeinstallprompt — there is no programmatic
// install there, only the user's manual Share -> Add to Home Screen. Use
// isIOSSafari() to show instructions instead of a button in that case.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

export function capturePwaInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
  });
}

export function isPwaInstallable(): boolean {
  return deferredPrompt !== null && !installed;
}

export function isPwaInstalled(): boolean {
  return installed;
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome;
}

export function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
  return isIOS && isSafari;
}
