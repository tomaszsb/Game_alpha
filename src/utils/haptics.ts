// src/utils/haptics.ts
//
// Haptic feedback utility using the Web Vibration API.
// Provides tactile feedback for mobile interactions.
// Created: January 25, 2026

/**
 * Check if haptic feedback is supported
 */
export function isHapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Haptic feedback patterns for different interactions.
 *
 * Uses the Web Vibration API (navigator.vibrate).
 * Gracefully degrades on unsupported platforms.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
 */
export const haptics = {
  /**
   * Short tick for button presses.
   * Duration: 10ms
   */
  buttonPress: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate(10);
    }
  },

  /**
   * Double-pulse for turn notifications.
   * Pattern: vibrate 100ms, pause 50ms, vibrate 100ms
   */
  turnNotification: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([100, 50, 100]);
    }
  },

  /**
   * Success feedback pattern.
   * Pattern: short-short-long (50-30-50-30-100ms)
   */
  success: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([50, 30, 50, 30, 100]);
    }
  },

  /**
   * Error feedback pattern.
   * Pattern: two short pulses (50-100-50ms)
   */
  error: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([50, 100, 50]);
    }
  },

  /**
   * Light tap for selections.
   * Duration: 5ms
   */
  lightTap: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate(5);
    }
  },

  /**
   * Medium tap for confirmations.
   * Duration: 25ms
   */
  mediumTap: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate(25);
    }
  },

  /**
   * Heavy tap for important actions.
   * Duration: 50ms
   */
  heavyTap: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate(50);
    }
  },

  /**
   * Custom vibration pattern.
   * @param pattern - Single duration in ms, or array of [vibrate, pause, vibrate, ...]
   */
  custom: (pattern: number | number[]): void => {
    if (isHapticsSupported()) {
      navigator.vibrate(pattern);
    }
  },

  /**
   * Cancel any ongoing vibration.
   */
  cancel: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate(0);
    }
  }
};

export default haptics;
