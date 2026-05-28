// tests/utils/deviceDetection.test.ts
// Covers isSmartTV() UA heuristic added in v3.0.25 for setup-screen
// auto-mode selection (Part A of the setup-connection ship).

import { describe, it, expect, afterEach, vi } from 'vitest';
import { isSmartTV } from '../../src/utils/deviceDetection';

// Helper: stub navigator.userAgent for a single assertion.
function withUserAgent(ua: string, fn: () => void): void {
  const spy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

describe('isSmartTV', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detects real smart-TV / console browsers', () => {
    const tvAgents: Array<[string, string]> = [
      ['Samsung Tizen', 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36'],
      ['LG webOS', 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36'],
      ['Android TV', 'Mozilla/5.0 (Linux; Android 9; BRAVIA 4K GB Android TV) AppleWebKit/537.36'],
      ['Amazon Fire TV', 'Mozilla/5.0 (Linux; Android 7.1.2; AFTMM Build/NS6271) AppleWebKit/537.36'],
      ['Chromecast', 'Mozilla/5.0 (CrKey armv7l 1.5.16041) AppleWebKit/537.36'],
      ['Roku', 'Roku/DVP-9.10 (519.10E04111A)'],
      ['Hisense VIDAA', 'Mozilla/5.0 (Linux; VIDAA 4.0) AppleWebKit/537.36'],
    ];

    tvAgents.forEach(([name, ua]) => {
      it(`returns true for ${name}`, () => {
        withUserAgent(ua, () => expect(isSmartTV()).toBe(true));
      });
    });
  });

  describe('returns false for ordinary PC / phone browsers', () => {
    const nonTvAgents: Array<[string, string]> = [
      ['Windows Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'],
      ['macOS Safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'],
      ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'],
      ['Android phone Chrome', 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'],
    ];

    nonTvAgents.forEach(([name, ua]) => {
      it(`returns false for ${name} (laptop-into-TV falls here — manual toggle is the fallback)`, () => {
        withUserAgent(ua, () => expect(isSmartTV()).toBe(false));
      });
    });
  });
});
