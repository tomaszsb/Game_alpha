// tests/server/homeIP.test.ts
// Unit tests for the foreign-game-alert home-IP logic (server.js can't be
// imported directly in tests — it auto-listens on import — so these pure
// helpers live in their own module; see homeIP.js).
//
// The IPv6 branch specifically guards a real live bug (2026-07-15): the
// maintainer's own PC, starting a game from home, got flagged as foreign
// because residential IPv6 has no NAT — every device on the LAN gets its
// own distinct address within a shared ISP-delegated prefix, so exact-
// matching a client's IPv6 address against the server's own IPv6 address
// can never work, even from the same house.

import { describe, it, expect } from 'vitest';
import { normalizeIP, isPrivateOrLoopbackIP, expandIPv6, ipv6Prefix64, isHomeIP } from '../../server/homeIP.js';

describe('normalizeIP', () => {
  it('strips the ::ffff: IPv4-mapped prefix', () => {
    expect(normalizeIP('::ffff:127.0.0.1')).toBe('127.0.0.1');
  });

  it('leaves plain addresses untouched', () => {
    expect(normalizeIP('127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIP('2600:4041:5d56:9a00::1')).toBe('2600:4041:5d56:9a00::1');
  });
});

describe('isPrivateOrLoopbackIP', () => {
  it('recognizes loopback and RFC1918 ranges', () => {
    expect(isPrivateOrLoopbackIP('::1')).toBe(true);
    expect(isPrivateOrLoopbackIP('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIP('10.0.0.5')).toBe(true);
    expect(isPrivateOrLoopbackIP('192.168.1.42')).toBe(true);
    expect(isPrivateOrLoopbackIP('172.16.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIP('172.31.255.255')).toBe(true);
  });

  it('rejects public addresses and out-of-range 172.x', () => {
    expect(isPrivateOrLoopbackIP('73.44.12.9')).toBe(false);
    expect(isPrivateOrLoopbackIP('172.32.0.1')).toBe(false);
    expect(isPrivateOrLoopbackIP('172.15.0.1')).toBe(false);
    expect(isPrivateOrLoopbackIP('2600:4041:5d56:9a00:4149:7f0a:c4a7:7907')).toBe(false);
  });
});

describe('expandIPv6', () => {
  it('returns a fully-expanded address unchanged in shape', () => {
    expect(expandIPv6('2600:4041:5d56:9a00:4149:7f0a:c4a7:7907')).toEqual(
      ['2600', '4041', '5d56', '9a00', '4149', '7f0a', 'c4a7', '7907']
    );
  });

  it('expands a "::" zero-run in the middle', () => {
    expect(expandIPv6('2600:4041::1')).toEqual(
      ['2600', '4041', '0000', '0000', '0000', '0000', '0000', '0001']
    );
  });

  it('expands loopback "::1"', () => {
    expect(expandIPv6('::1')).toEqual(
      ['0000', '0000', '0000', '0000', '0000', '0000', '0000', '0001']
    );
  });

  it('expands a trailing "::"', () => {
    expect(expandIPv6('2600:4041:5d56:9a00::')).toEqual(
      ['2600', '4041', '5d56', '9a00', '0000', '0000', '0000', '0000']
    );
  });

  it('pads short hextets with leading zeros', () => {
    expect(expandIPv6('2600:41::1')).toEqual(
      ['2600', '0041', '0000', '0000', '0000', '0000', '0000', '0001']
    );
  });

  it('returns null for IPv4 and IPv4-mapped addresses', () => {
    expect(expandIPv6('127.0.0.1')).toBeNull();
    expect(expandIPv6('::ffff:127.0.0.1')).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(expandIPv6('not-an-ip')).toBeNull();
    expect(expandIPv6('')).toBeNull();
    expect(expandIPv6(null as unknown as string)).toBeNull();
  });
});

describe('ipv6Prefix64', () => {
  it('extracts the first 4 hextets as the /64 prefix', () => {
    expect(ipv6Prefix64('2600:4041:5d56:9a00:4149:7f0a:c4a7:7907')).toBe('2600:4041:5d56:9a00');
  });

  it('two devices on the same home network share a prefix despite different suffixes', () => {
    const serverAddr = '2600:4041:5d56:9a00:aaaa:bbbb:cccc:dddd';
    const playerPCAddr = '2600:4041:5d56:9a00:4149:7f0a:c4a7:7907';
    expect(ipv6Prefix64(serverAddr)).toBe(ipv6Prefix64(playerPCAddr));
  });

  it('returns null for non-IPv6 input', () => {
    expect(ipv6Prefix64('73.44.12.9')).toBeNull();
  });
});

describe('isHomeIP', () => {
  const settledNoHome = {
    homeIPDetectionSettled: true,
    homeIPv6DetectionSettled: true,
  };

  it('always treats private/loopback addresses as home, regardless of detection state', () => {
    expect(isHomeIP('192.168.1.5', settledNoHome)).toBe(true);
    expect(isHomeIP('::1', settledNoHome)).toBe(true);
  });

  describe('IPv4', () => {
    it('matches the detected home IPv4 exactly', () => {
      const state = { detectedHomeIPv4: '73.44.12.9', ...settledNoHome };
      expect(isHomeIP('73.44.12.9', state)).toBe(true);
      expect(isHomeIP('73.44.12.10', state)).toBe(false);
    });

    it('CONFIG.HOME_IP override wins over the auto-detected value', () => {
      const state = { homeIPOverride: '1.2.3.4', detectedHomeIPv4: '73.44.12.9', ...settledNoHome };
      expect(isHomeIP('1.2.3.4', state)).toBe(true);
      expect(isHomeIP('73.44.12.9', state)).toBe(false);
    });

    it('assumes home while detection is still in flight (not yet settled)', () => {
      const state = { homeIPDetectionSettled: false, homeIPv6DetectionSettled: true };
      expect(isHomeIP('1.2.3.4', state)).toBe(true);
    });

    it('treats every public IP as foreign once settled with no home IP known', () => {
      const state = { ...settledNoHome };
      expect(isHomeIP('1.2.3.4', state)).toBe(false);
    });
  });

  describe('IPv6 — the 2026-07-15 real-hardware bug', () => {
    it('treats a different device on the same /64 prefix as home (the actual bug)', () => {
      // Server auto-detected its own IPv6 address; a different device in
      // the same house (the maintainer's PC) connects with a different
      // suffix but the same ISP-delegated /64 prefix.
      const state = {
        detectedHomeIPv6: '2600:4041:5d56:9a00:aaaa:bbbb:cccc:dddd',
        ...settledNoHome,
      };
      expect(isHomeIP('2600:4041:5d56:9a00:4149:7f0a:c4a7:7907', state)).toBe(true);
    });

    it('still flags a genuinely different network as foreign', () => {
      const state = {
        detectedHomeIPv6: '2600:4041:5d56:9a00:aaaa:bbbb:cccc:dddd',
        ...settledNoHome,
      };
      expect(isHomeIP('2001:db8:ffff:ffff:1:2:3:4', state)).toBe(false);
    });

    it('CONFIG.HOME_IP override works for an IPv6 manual override too', () => {
      const state = {
        homeIPOverride: '2600:4041:5d56:9a00::1',
        detectedHomeIPv6: '2001:db8::1', // deliberately wrong, should be ignored
        ...settledNoHome,
      };
      expect(isHomeIP('2600:4041:5d56:9a00:4149:7f0a:c4a7:7907', state)).toBe(true);
    });

    it('assumes home while IPv6 detection is still in flight', () => {
      const state = { homeIPDetectionSettled: true, homeIPv6DetectionSettled: false };
      expect(isHomeIP('2001:db8::1', state)).toBe(true);
    });

    it('treats an IPv6 client as foreign once settled with no home IPv6 known (e.g. server has no IPv6 route)', () => {
      const state = { ...settledNoHome };
      expect(isHomeIP('2001:db8::1', state)).toBe(false);
    });

    it('does not fall back to matching an IPv6 client against an unrelated IPv4 home address', () => {
      const state = {
        detectedHomeIPv4: '73.44.12.9',
        ...settledNoHome,
      };
      expect(isHomeIP('2001:db8::1', state)).toBe(false);
    });
  });
});
