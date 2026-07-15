// src/utils/deviceDetection.ts
// Device detection utility for smart layout adaptation

export type DeviceType = 'mobile' | 'desktop';

/**
 * Detects the device type based on user agent and screen characteristics
 * @returns 'mobile' or 'desktop'
 */
export function detectDeviceType(): DeviceType {
  // Smart TVs must never come back 'mobile' — confirmed live 2026-07-15 on
  // a Hisense (Android-based, VIDAA-class) TV whose UA is "Android 11;
  // SmartTV 4K FFM...": the mobile regex below matches bare "Android" and
  // has no way to tell an Android TV from an Android phone. Check the more
  // specific TV heuristic first so those UAs don't fall through to it.
  if (isSmartTV()) return 'desktop';

  // Check user agent string for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  if (mobileRegex.test(userAgent)) {
    return 'mobile';
  }

  // Additional checks for touch-enabled small screens
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth < 768;

  return (hasTouch && isSmallScreen) ? 'mobile' : 'desktop';
}

/**
 * True when the physical screen is phone-sized — too small to comfortably
 * play Unravel Codes, so the landing page should steer the visitor to set a
 * reminder and come back on a bigger screen rather than "Play now".
 *
 * Deliberately measures the SHORT side of `window.screen` (physical pixels),
 * not `innerWidth`, so the answer doesn't flip on split-screen, browser zoom,
 * or a narrow desktop window — and so the two tablet gotchas resolve
 * correctly: a modern iPad reports a Mac/desktop user-agent (would look like a
 * PC to a UA check) and an Android tablet reports the same UA as an Android
 * phone (would look like a phone). Both clear a ~600px short-side bar; real
 * phones (~360–430px short side) don't. Result: phone → reminder view;
 * tablet / laptop / desktop / TV → play view.
 *
 * Smart TVs are excluded up front rather than relying on the 600px bar to
 * clear them — confirmed live 2026-07-15 on a Hisense (Android-based,
 * VIDAA-class) TV that reported an unusually small logical screen
 * (960x540, short side 540px), well under the bar. That TV showed this
 * exact "works best on a bigger screen" warning to someone already playing
 * on their actual living-room TV, in TV mode. A device isSmartTV() can
 * positively identify is never a phone, however small its self-reported
 * viewport is, so it should short-circuit before the size check.
 */
export function isPhoneScreen(): boolean {
  if (typeof window === 'undefined' || !window.screen) return false;
  if (isSmartTV()) return false;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide > 0 && shortSide < 600;
}

/**
 * Best-effort detection of a real smart-TV / set-top browser via user-agent.
 *
 * Used to auto-preselect "TV mode" on the setup screen (v3.0.25). Covers the
 * major TV/console platforms whose browsers carry a distinctive UA token:
 * Samsung Tizen, LG webOS (Web0S/NetCast), Android TV / Google TV, Amazon
 * Fire TV (AFT*), Chromecast (CrKey), Sony BRAVIA, Apple tvOS, Roku, Hisense
 * VIDAA, HbbTV set-tops.
 *
 * IMPORTANT — this is a heuristic, not a guarantee. A laptop or desktop PC
 * driving a TV over HDMI reports a normal desktop UA and is indistinguishable
 * from a regular PC, so it will NOT be detected here (defaults to PC). The
 * prominent PC/TV toggle is the manual fallback for that case.
 *
 * @returns true if the current browser looks like a TV/console platform.
 */
export function isSmartTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || (navigator as { vendor?: string }).vendor || '';
  return /SmartTV|Smart-TV|SMART-TV|Tizen|Web0S|NetCast|HbbTV|GoogleTV|Google TV|Android\s?TV|AFT[A-Z]|CrKey|BRAVIA|AppleTV|tvOS|Roku|VIDAA|PhilipsTV|DTV/i.test(ua);
}

/**
 * Get the backend URL using actual network address
 * This ensures heartbeat works from any device on the network
 * @returns The backend API URL
 */
export function getBackendURL(): string {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  // Backend always runs on port 3001
  return `${protocol}//${hostname}:3001`;
}
