// tests/utils/deviceDetection.test.ts
// Covers isSmartTV() UA heuristic added in v3.0.25 for setup-screen
// auto-mode selection (Part A of the setup-connection ship), plus
// detectDeviceType()/isPhoneScreen()'s TV carve-outs added 2026-07-15 after
// a real Hisense (Android-based, VIDAA-class) TV — UA "Android 11; SmartTV
// 4K FFM...", reported screen 960x540 — got misclassified as a phone by
// both functions: detectDeviceType() matched bare "Android" before ever
// checking isSmartTV(), and isPhoneScreen()'s short-side-under-600 bar
// (540 < 600) fired because this particular TV self-reports an unusually
// small logical screen.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { isSmartTV, detectDeviceType, isPhoneScreen } from '../../src/utils/deviceDetection';

// Helper: stub navigator.userAgent for a single assertion.
function withUserAgent(ua: string, fn: () => void): void {
  const spy = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
}

// Helper: stub window.screen's width/height for a single assertion.
function withScreenSize(width: number, height: number, fn: () => void): void {
  const widthSpy = vi.spyOn(window.screen, 'width', 'get').mockReturnValue(width);
  const heightSpy = vi.spyOn(window.screen, 'height', 'get').mockReturnValue(height);
  try {
    fn();
  } finally {
    widthSpy.mockRestore();
    heightSpy.mockRestore();
  }
}

const HISENSE_VIDAA_UA =
  'Mozilla/5.0 (Linux; Android 11; SmartTV 4K FFM Build/RTT2.220118.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/149.0.7827.163 Mobile Safari/537.36';

const TCL_SMART_TV_SPACE_UA =
  'Mozilla/5.0 (Linux; Android 14; Smart TV Pro Build/UTT2.250416.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.0.0 Mobile Safari/537.36';

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
      ['TCL Android TV ("Smart TV" with a space)', TCL_SMART_TV_SPACE_UA],
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

describe('detectDeviceType', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "desktop" for an Android-based Smart TV, not "mobile" (2026-07-15 real-hardware bug)', () => {
    withUserAgent(HISENSE_VIDAA_UA, () => expect(detectDeviceType()).toBe('desktop'));
  });

  it('returns "desktop" for a TCL Android TV with "Smart TV" (space) in its UA, not "mobile" (2026-07-22 real-hardware bug)', () => {
    withUserAgent(TCL_SMART_TV_SPACE_UA, () => expect(detectDeviceType()).toBe('desktop'));
  });

  it('still returns "mobile" for a real Android phone', () => {
    withUserAgent(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      () => expect(detectDeviceType()).toBe('mobile')
    );
  });

  it('still returns "mobile" for an iPhone', () => {
    withUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      () => expect(detectDeviceType()).toBe('mobile')
    );
  });
});

describe('isPhoneScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false for a Smart TV even when it self-reports an unusually small screen (2026-07-15 real-hardware bug)', () => {
    withUserAgent(HISENSE_VIDAA_UA, () => {
      withScreenSize(960, 540, () => expect(isPhoneScreen()).toBe(false));
    });
  });

  it('returns false for a TCL Android TV ("Smart TV" with a space) at a small self-reported screen (2026-07-22 real-hardware bug)', () => {
    withUserAgent(TCL_SMART_TV_SPACE_UA, () => {
      withScreenSize(960, 540, () => expect(isPhoneScreen()).toBe(false));
    });
  });

  it('returns true for a real phone-sized screen on an ordinary UA', () => {
    withUserAgent(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      () => {
        withScreenSize(390, 844, () => expect(isPhoneScreen()).toBe(true));
      }
    );
  });

  it('returns false for a tablet/desktop-sized screen', () => {
    withUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      () => {
        withScreenSize(1920, 1080, () => expect(isPhoneScreen()).toBe(false));
      }
    );
  });
});
