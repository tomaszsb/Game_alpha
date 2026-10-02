// src/utils/deviceRole.ts
//
// What THIS SCREEN is — a PC, a TV, or a phone — as opposed to how a given GAME is being
// played (together in a room, or in different places). Tom, 2026-10-02: "if I am playing on
// my own hardware I will want the hardware settings to stay the same" while "Remote" is a
// one-game answer that must not stick to a device.
//
// A player who opens a personal link (?p=P1) on a screen the game can't be sure about is
// asked ONCE what the screen is; the answer is remembered on the device (the "Remember what
// this screen is" setting turns that off) and rewrites the link so the right layout loads:
//
//   pc    board + this player's controls on one screen  →  ?p=P1&mode=remote
//   tv    the board only (controls are on a phone)      →  no p, ?mode=tv
//   phone this player's controls only                   →  ?p=P1
//
// `role=` in the link means "already decided" — it ends the ask/redirect cycle, so a device
// that is told not to remember is asked once per link, never in a loop.

import { getRememberMode } from './modePreference';

export type DeviceRole = 'pc' | 'tv' | 'phone';

const DEVICE_ROLE_KEY = 'unravelcodes:device-role';

export function isDeviceRole(value: unknown): value is DeviceRole {
  return value === 'pc' || value === 'tv' || value === 'phone';
}

/** The remembered role, or null (never set, remembering switched off, or storage unavailable). */
export function getStoredDeviceRole(): DeviceRole | null {
  if (!getRememberMode()) return null;
  try {
    const value = localStorage.getItem(DEVICE_ROLE_KEY);
    return isDeviceRole(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredDeviceRole(role: DeviceRole): void {
  if (!getRememberMode()) return;
  try {
    localStorage.setItem(DEVICE_ROLE_KEY, role);
  } catch {
    /* private mode / storage disabled — the choice still applies to this visit */
  }
}

export function clearStoredDeviceRole(): void {
  try {
    localStorage.removeItem(DEVICE_ROLE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The link rewritten for a role (pure). Idempotent: applying it twice changes nothing more. */
export function roleUrl(role: DeviceRole, href: string): string {
  const url = new URL(href);
  const p = url.searchParams;
  if (role === 'tv') {
    p.delete('p');
    p.delete('playerId');
    p.set('mode', 'tv');
  } else if (role === 'pc') {
    // With a personal link: this player's board + controls (the Remote layout). Without one
    // (the host's own screen) there is nobody to lock to, so it is the plain full view.
    if (p.get('p') || p.get('playerId')) p.set('mode', 'remote');
    else p.delete('mode');
  } else {
    p.delete('mode');
  }
  p.set('role', role);
  return url.toString();
}

export type DeviceRoleDecision =
  | { kind: 'ok' }
  | { kind: 'redirect'; url: string }
  | { kind: 'prompt'; suggested: DeviceRole };

export interface DeviceRoleContext {
  /** Is this a phone-sized screen? (deviceDetection.isPhoneScreen) */
  isPhone: boolean;
  /** Does the browser identify as a smart TV? (networkDetection.isSmartTV) */
  isSmartTv: boolean;
}

/**
 * What to do on load. Only a PERSONAL link (?p= / ?playerId=) is affected, and never a
 * spectator link or one already decided (`role=`). A phone-sized screen opening an ordinary
 * link is a phone — no question asked (the common case: scanning a QR code). A phone opening
 * a REMOTE-game link may be the player's only screen, so it is asked like everything else.
 * Anything else asks, unless this device already remembers its role.
 */
export function decideDeviceRole(href: string, ctx: DeviceRoleContext): DeviceRoleDecision {
  const params = new URL(href).searchParams;
  if (!params.get('p') && !params.get('playerId')) return { kind: 'ok' };
  if (params.get('spectate') === '1') return { kind: 'ok' };
  if (isDeviceRole(params.get('role'))) return { kind: 'ok' };
  if (ctx.isPhone && params.get('mode') !== 'remote') return { kind: 'redirect', url: roleUrl('phone', href) };
  const stored = getStoredDeviceRole();
  if (stored) return { kind: 'redirect', url: roleUrl(stored, href) };
  return { kind: 'prompt', suggested: ctx.isSmartTv ? 'tv' : 'pc' };
}
