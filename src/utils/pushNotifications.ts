// src/utils/pushNotifications.ts
//
// Web Push Notifications for turn alerts
// Uses the browser's Notification API to alert players when it's their turn
// Works even when the browser tab is in the background
// Created: February 4, 2026

import { debugLog } from './debugLog';

/**
 * Check if browser supports the Notification API
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Request notification permission from the user
 * Returns the permission status after request
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) {
    debugLog('🔔 Push notifications not supported in this browser');
    return 'unsupported';
  }

  // Already granted
  if (Notification.permission === 'granted') {
    debugLog('🔔 Notification permission already granted');
    return 'granted';
  }

  // Already denied (can't re-request)
  if (Notification.permission === 'denied') {
    debugLog('🔔 Notification permission was denied');
    return 'denied';
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    debugLog(`🔔 Notification permission: ${permission}`);
    return permission;
  } catch (error) {
    console.error('🔔 Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Send a "Your Turn" notification
 * Will only show if permission is granted and tab is not focused
 */
export function sendTurnNotification(playerName: string, spaceName?: string): void {
  // Don't notify if notifications aren't supported or permitted
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  // Don't notify if the page is visible and focused
  if (document.visibilityState === 'visible' && document.hasFocus()) {
    debugLog('🔔 Skipping notification - tab is focused');
    return;
  }

  const title = "It's Your Turn!";
  const body = spaceName
    ? `${playerName}, you're at ${spaceName}. Make your move!`
    : `${playerName}, it's time to play!`;

  try {
    // Note: renotify and silent are not in TypeScript's NotificationOptions but work in browsers
    const options: NotificationOptions & { renotify?: boolean; silent?: boolean } = {
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'turn-notification', // Replaces existing turn notifications
      renotify: true, // Vibrate even if replacing
      requireInteraction: false, // Auto-dismiss after a while
      silent: false // Play default sound
    };
    const notification = new Notification(title, options);

    // Focus the game tab when notification is clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);

    debugLog('🔔 Turn notification sent');
  } catch (error) {
    console.error('🔔 Error sending notification:', error);
  }
}

/**
 * Send a generic game notification
 */
export function sendGameNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }

  // Don't notify if the page is visible and focused
  if (document.visibilityState === 'visible' && document.hasFocus()) {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/logo.png',
      tag: 'game-notification',
      requireInteraction: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => {
      notification.close();
    }, 8000);
  } catch (error) {
    console.error('🔔 Error sending notification:', error);
  }
}

/**
 * PushNotifications object for easy import
 */
export const pushNotifications = {
  isSupported: isNotificationSupported,
  getPermission: getNotificationPermission,
  requestPermission: requestNotificationPermission,
  sendTurnNotification,
  sendGameNotification
};
