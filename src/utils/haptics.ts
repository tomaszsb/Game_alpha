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

// ── Web Audio fallback ─────────────────────────────────────────────────────
// Some browsers (e.g. Perplexity Comet) block the Vibration API entirely even
// after a user gesture. Web Audio has wider support: once the AudioContext is
// resumed during a tap it stays unlocked for the session.
// fb:6e1e8ac4.

let _audioCtx: AudioContext | null = null;

/**
 * Prime the AudioContext during a user-gesture handler (tap-to-enter gate).
 * Must be called in a click/tap handler to unlock audio for later playback.
 */
export function primeAudio(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!_audioCtx) _audioCtx = new Ctx();
    if (_audioCtx.state === 'suspended') void _audioCtx.resume();
  } catch { /* audio is best-effort */ }
}

/**
 * Play a short double-beep chime via Web Audio.
 * No-ops silently if AudioContext was never primed or is suspended.
 */
function playTurnChime(): void {
  if (!_audioCtx || _audioCtx.state !== 'running') return;
  try {
    const ctx = _audioCtx;
    const now = ctx.currentTime;
    // First note — 520 Hz, 80 ms
    const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
    o1.connect(g1); g1.connect(ctx.destination);
    o1.frequency.value = 520;
    g1.gain.setValueAtTime(0.15, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o1.start(now); o1.stop(now + 0.08);
    // Second note — 660 Hz, 80 ms, 130 ms later
    const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
    o2.connect(g2); g2.connect(ctx.destination);
    o2.frequency.value = 660;
    g2.gain.setValueAtTime(0.15, now + 0.13);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    o2.start(now + 0.13); o2.stop(now + 0.21);
  } catch { /* audio is best-effort */ }
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
   * Vibrates on browsers that support it; plays a chime on those that don't
   * (e.g. Perplexity Comet). Requires primeAudio() to have been called during
   * a prior user gesture. fb:6e1e8ac4.
   * Pattern: vibrate 100ms, pause 50ms, vibrate 100ms
   */
  turnNotification: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([100, 50, 100]);
    }
    playTurnChime();
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
   * Dice roll feedback - strong vibration pattern.
   * Pattern: escalating pulses simulating dice rolling
   */
  diceRoll: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([30, 20, 40, 20, 50, 20, 60, 30, 100]);
    }
  },

  /**
   * Card draw feedback - quick swipe feel.
   * Pattern: medium pulse
   */
  cardDraw: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([20, 10, 30]);
    }
  },

  /**
   * Movement feedback - player moved to new space.
   * Pattern: gentle pulse
   */
  movement: (): void => {
    if (isHapticsSupported()) {
      navigator.vibrate([15, 30, 15]);
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
