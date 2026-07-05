// src/playtest/browserPush.ts
//
// Real (not tab-only) browser push reminders via the Web Push API + VAPID.
// Unlike a plain setTimeout, this survives a closed tab and even a closed
// browser — the OS/browser's push service wakes the service worker
// (public/sw.js) at the scheduled time. Requires the SW to be registered
// (production only, see main.tsx) and the backend's VAPID keys to be
// configured (server/reminderScheduler.js).

import { getBackendURL } from '../utils/networkDetection';
import { getStoredCampaignSource } from './playtestStorage';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function schedulePushReminder(sendAt: Date): Promise<{ ok: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { ok: false, error: 'Not supported in this browser' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, error: 'Notification permission was not granted' };
    }

    const keyRes = await fetch(`${getBackendURL()}/api/playtest/push-public-key`);
    const keyData = await keyRes.json().catch(() => ({}));
    if (!keyRes.ok) {
      return { ok: false, error: keyData.error || 'Not set up yet' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
      });
    }

    const res = await fetch(`${getBackendURL()}/api/playtest/schedule-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        sendAt: sendAt.toISOString(),
        campaignSource: getStoredCampaignSource(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Something went wrong' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' };
  }
}
