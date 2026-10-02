// tests/utils/deviceRole.test.ts
//
// What THIS SCREEN is (PC / TV / phone) vs how a GAME is played (together / in different
// places). A personal player link on a screen the game can't be sure about asks once;
// the answer rewrites the link and is remembered per device. (Tom, 2026-10-02.)

import { describe, it, expect, afterEach } from 'vitest';
import {
  decideDeviceRole, roleUrl, getStoredDeviceRole, setStoredDeviceRole, clearStoredDeviceRole,
} from '../../src/utils/deviceRole';
import { setRememberMode } from '../../src/utils/modePreference';

const BASE = 'https://game.unravelcodes.com/';
const link = (q: string) => `${BASE}?${q}`;
const laptop = { isPhone: false, isSmartTv: false };
const phone = { isPhone: true, isSmartTv: false };
const tv = { isPhone: false, isSmartTv: true };
const params = (url: string) => new URL(url).searchParams;

describe('roleUrl', () => {
  it('pc: board + this player\'s controls (the Remote layout), still this player', () => {
    const p = params(roleUrl('pc', link('g=G1&token=t&p=P1')));
    expect(p.get('p')).toBe('P1');
    expect(p.get('mode')).toBe('remote');
    expect(p.get('role')).toBe('pc');
  });
  it('tv: the board only - the personal link is dropped and mode=tv set', () => {
    const p = params(roleUrl('tv', link('g=G1&token=t&p=P1&mode=remote')));
    expect(p.get('p')).toBeNull();
    expect(p.get('playerId')).toBeNull();
    expect(p.get('mode')).toBe('tv');
    expect(p.get('g')).toBe('G1');
    expect(p.get('token')).toBe('t');
  });
  it('phone: controls only - any mode is dropped, the player stays', () => {
    const p = params(roleUrl('phone', link('g=G1&p=P2&mode=remote')));
    expect(p.get('p')).toBe('P2');
    expect(p.get('mode')).toBeNull();
    expect(p.get('role')).toBe('phone');
  });
  it('is idempotent', () => {
    for (const role of ['pc', 'tv', 'phone'] as const) {
      const once = roleUrl(role, link('g=G1&p=P1'));
      expect(roleUrl(role, once)).toBe(once);
    }
  });
});

describe('decideDeviceRole', () => {
  afterEach(() => localStorage.clear());

  it('leaves the host / a plain link alone (no personal link)', () => {
    expect(decideDeviceRole(link('g=G1&token=t'), laptop)).toEqual({ kind: 'ok' });
  });
  it('leaves spectators alone', () => {
    expect(decideDeviceRole(link('g=G1&p=P1&spectate=1'), laptop)).toEqual({ kind: 'ok' });
  });
  it('a link that already says role= is decided - never asks, never loops', () => {
    expect(decideDeviceRole(link('g=G1&p=P1&role=pc&mode=remote'), laptop)).toEqual({ kind: 'ok' });
  });
  it('a phone scanning an ordinary QR code is just a phone - no question', () => {
    const d = decideDeviceRole(link('g=G1&p=P1'), phone);
    expect(d.kind).toBe('redirect');
    expect(d.kind === 'redirect' && params(d.url).get('role')).toBe('phone');
  });
  it('a phone on a REMOTE-game link may be the only screen - it is asked', () => {
    expect(decideDeviceRole(link('g=G1&p=P1&mode=remote'), phone).kind).toBe('prompt');
  });
  it('a laptop on a personal link is asked, suggesting PC', () => {
    expect(decideDeviceRole(link('g=G1&p=P1'), laptop)).toEqual({ kind: 'prompt', suggested: 'pc' });
  });
  it('a smart TV on a personal link is asked, suggesting TV', () => {
    expect(decideDeviceRole(link('g=G1&p=P1'), tv)).toEqual({ kind: 'prompt', suggested: 'tv' });
  });
  it('a remembered role is applied without asking', () => {
    setStoredDeviceRole('tv');
    const d = decideDeviceRole(link('g=G1&p=P1'), laptop);
    expect(d.kind).toBe('redirect');
    expect(d.kind === 'redirect' && params(d.url).get('mode')).toBe('tv');
  });
  it('with remembering OFF the answer is never kept, so it asks each time', () => {
    setRememberMode(false);
    setStoredDeviceRole('tv');
    expect(getStoredDeviceRole()).toBeNull();
    expect(decideDeviceRole(link('g=G1&p=P1'), laptop).kind).toBe('prompt');
  });
  it('forgetting a remembered role makes it ask again', () => {
    setStoredDeviceRole('phone');
    clearStoredDeviceRole();
    expect(decideDeviceRole(link('g=G1&p=P1'), laptop).kind).toBe('prompt');
  });
});
