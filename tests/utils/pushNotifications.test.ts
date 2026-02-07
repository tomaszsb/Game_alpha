// tests/utils/pushNotifications.test.ts
//
// Tests for Web Push Notification utility
// Created: February 4, 2026

import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendTurnNotification,
  sendGameNotification,
  pushNotifications
} from '../../src/utils/pushNotifications';

describe('Push Notifications', () => {
  // Store original Notification
  const OriginalNotification = global.Notification;

  // Mock Notification constructor
  let mockNotificationInstance: {
    onclick: (() => void) | null;
    close: Mock;
  };

  beforeEach(() => {
    // Reset mock instance
    mockNotificationInstance = {
      onclick: null,
      close: vi.fn()
    };

    // Mock Notification API
    (global as any).Notification = vi.fn().mockImplementation(() => mockNotificationInstance);
    (global as any).Notification.permission = 'default';
    (global as any).Notification.requestPermission = vi.fn().mockResolvedValue('granted');

    // Mock document properties
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    });
    Object.defineProperty(document, 'hasFocus', {
      value: () => false,
      writable: true,
      configurable: true
    });

    // Mock window.focus
    window.focus = vi.fn();

    // Clear timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore original Notification
    (global as any).Notification = OriginalNotification;
    vi.useRealTimers();
  });

  describe('isNotificationSupported', () => {
    it('returns true when Notification API exists', () => {
      expect(isNotificationSupported()).toBe(true);
    });

    it('returns false when Notification API does not exist', () => {
      delete (global as any).Notification;
      expect(isNotificationSupported()).toBe(false);
    });
  });

  describe('getNotificationPermission', () => {
    it('returns current permission when supported', () => {
      (global as any).Notification.permission = 'granted';
      expect(getNotificationPermission()).toBe('granted');
    });

    it('returns "unsupported" when not supported', () => {
      delete (global as any).Notification;
      expect(getNotificationPermission()).toBe('unsupported');
    });
  });

  describe('requestNotificationPermission', () => {
    it('returns "granted" when permission is already granted', async () => {
      (global as any).Notification.permission = 'granted';
      const result = await requestNotificationPermission();
      expect(result).toBe('granted');
      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('returns "denied" when permission was previously denied', async () => {
      (global as any).Notification.permission = 'denied';
      const result = await requestNotificationPermission();
      expect(result).toBe('denied');
      expect(Notification.requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission when status is default', async () => {
      (global as any).Notification.permission = 'default';
      (global as any).Notification.requestPermission = vi.fn().mockResolvedValue('granted');

      const result = await requestNotificationPermission();

      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('returns "unsupported" when Notification API does not exist', async () => {
      delete (global as any).Notification;
      const result = await requestNotificationPermission();
      expect(result).toBe('unsupported');
    });
  });

  describe('sendTurnNotification', () => {
    it('sends notification when permission is granted and tab is hidden', () => {
      (global as any).Notification.permission = 'granted';

      sendTurnNotification('Alice', 'OWNER-FUND-INITIATION');

      expect(Notification).toHaveBeenCalledWith(
        "It's Your Turn!",
        expect.objectContaining({
          body: 'Alice, you\'re at OWNER-FUND-INITIATION. Make your move!',
          tag: 'turn-notification'
        })
      );
    });

    it('sends notification without space name', () => {
      (global as any).Notification.permission = 'granted';

      sendTurnNotification('Bob');

      expect(Notification).toHaveBeenCalledWith(
        "It's Your Turn!",
        expect.objectContaining({
          body: 'Bob, it\'s time to play!'
        })
      );
    });

    it('does not send notification when permission is not granted', () => {
      (global as any).Notification.permission = 'default';

      sendTurnNotification('Alice', 'START');

      expect(Notification).not.toHaveBeenCalled();
    });

    it('does not send notification when tab is visible and focused', () => {
      (global as any).Notification.permission = 'granted';
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true });

      sendTurnNotification('Alice', 'START');

      expect(Notification).not.toHaveBeenCalled();
    });

    it('creates notification with correct tag for deduplication', () => {
      (global as any).Notification.permission = 'granted';

      sendTurnNotification('Alice', 'START');

      expect(Notification).toHaveBeenCalledWith(
        "It's Your Turn!",
        expect.objectContaining({
          tag: 'turn-notification'
        })
      );
    });

    it('includes icon in notification options', () => {
      (global as any).Notification.permission = 'granted';

      sendTurnNotification('Alice', 'START');

      expect(Notification).toHaveBeenCalledWith(
        "It's Your Turn!",
        expect.objectContaining({
          icon: '/logo.png'
        })
      );
    });
  });

  describe('sendGameNotification', () => {
    it('sends generic game notification', () => {
      (global as any).Notification.permission = 'granted';

      sendGameNotification('Game Over', 'Alice wins!');

      expect(Notification).toHaveBeenCalledWith(
        'Game Over',
        expect.objectContaining({
          body: 'Alice wins!',
          tag: 'game-notification'
        })
      );
    });

    it('does not send when tab is focused', () => {
      (global as any).Notification.permission = 'granted';
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      Object.defineProperty(document, 'hasFocus', { value: () => true, configurable: true });

      sendGameNotification('Update', 'Something happened');

      expect(Notification).not.toHaveBeenCalled();
    });
  });

  describe('pushNotifications object', () => {
    it('exports all functions', () => {
      expect(pushNotifications.isSupported).toBe(isNotificationSupported);
      expect(pushNotifications.getPermission).toBe(getNotificationPermission);
      expect(pushNotifications.requestPermission).toBe(requestNotificationPermission);
      expect(pushNotifications.sendTurnNotification).toBe(sendTurnNotification);
      expect(pushNotifications.sendGameNotification).toBe(sendGameNotification);
    });
  });
});
