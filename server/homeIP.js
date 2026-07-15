// server/homeIP.js
// Pure helpers for deciding whether an IP counts as "home" for the
// foreign-game text alert. Kept side-effect-free and importable on its own
// (server.js can't be imported directly in tests — it auto-listens on
// import) so this logic is unit-testable for real, not just pattern-matched
// as source text.

export const normalizeIP = (s) => (typeof s === 'string' ? s.replace(/^::ffff:/i, '') : s);

/**
 * True for loopback and RFC1918 private-range addresses. Covers the case
 * where a device on the same LAN as the server visits it through the
 * public domain and the home router's NAT hairpin/loopback rewrites the
 * source IP to something private (e.g. its own LAN gateway address)
 * instead of preserving a real public IP — that traffic should still
 * count as "home" even though it won't match the detected public IP.
 */
export function isPrivateOrLoopbackIP(ip) {
  const normalized = normalizeIP(ip);
  if (!normalized) return false;
  if (normalized === '::1' || normalized === 'localhost') return true;
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(normalized);
}

/**
 * Expands a possibly-compressed IPv6 address ("::" zero-run) to its full 8
 * hextet form, e.g. "2600:4041::1" -> ['2600','4041','0000',...,'0001'].
 * Returns null for anything that isn't a plain IPv6 address (IPv4, IPv4-
 * mapped "::ffff:1.2.3.4", zone-index suffixes stripped first, garbage).
 */
export function expandIPv6(ip) {
  if (typeof ip !== 'string') return null;
  const addr = ip.replace(/^\[|\]$/g, '').split('%')[0];
  if (!addr.includes(':') || addr.includes('.')) return null;
  const [head, tail] = addr.includes('::') ? addr.split('::') : [addr, undefined];
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0 || (tail === undefined && headParts.length !== 8)) return null;
  const full = [...headParts, ...Array(Math.max(missing, 0)).fill('0'), ...tailParts];
  return full.length === 8 ? full.map(g => g.padStart(4, '0').toLowerCase()) : null;
}

/**
 * The /64 network-prefix portion (first 4 hextets) of an IPv6 address, for
 * "same household" comparisons. Unlike IPv4, residential IPv6 has no NAT —
 * the ISP delegates a whole prefix (usually /64 or wider) to the home
 * router, and every device on the LAN gets its OWN distinct address within
 * that prefix (via SLAAC, often with a randomized privacy-extension suffix
 * that also changes over time). So a player's phone/PC will never exactly
 * match the server's own detected IPv6 address, even from the same house —
 * but they'll always share the same /64 prefix. Returns null if `ip` isn't
 * a plain IPv6 address.
 */
export function ipv6Prefix64(ip) {
  const full = expandIPv6(ip);
  return full ? full.slice(0, 4).join(':') : null;
}

/**
 * True if `ip` should be treated as "home" for the foreign-game alert: a
 * private/loopback address, or a match against the known home IP(s).
 *
 * Pure by design — takes the currently-known home-IP state as plain
 * arguments instead of closing over module-level mutable variables, so
 * it's trivially testable without needing to fake async detection timing.
 *
 * IPv6 clients are compared by /64 network prefix, not exact address —
 * residential IPv6 has no NAT, so every device in the house gets its own
 * distinct address within a shared ISP-delegated prefix (see
 * ipv6Prefix64()'s comment). Exact-matching an IPv6 client against the
 * server's own IPv6 address would treat every device in the house except
 * the server itself as "foreign" — confirmed live 2026-07-15: the
 * maintainer's own PC, starting a game from home, got flagged foreign with
 * a real Verizon-range IPv6 address (confirmed via ARIN RDAP lookup) that
 * simply wasn't the server's own.
 *
 * If neither a home IP nor an IPv6 prefix is known yet AND detection has
 * had a chance to complete at least once, every public IP counts as
 * foreign — fails toward alerting rather than silently missing games. But
 * while the very first detection is still in flight (a real window every
 * server restart, since detection is fire-and-forget rather than awaited
 * at startup), assume home instead — otherwise every restart guarantees a
 * false alarm.
 *
 * @param {string} ip - the client IP to classify
 * @param {object} state
 * @param {string} [state.homeIPOverride] - CONFIG.HOME_IP manual override (either family)
 * @param {string} [state.detectedHomeIPv4] - auto-detected home IPv4 address
 * @param {string} [state.detectedHomeIPv6] - auto-detected home IPv6 address
 * @param {boolean} state.homeIPDetectionSettled - IPv4 detection has resolved at least once
 * @param {boolean} state.homeIPv6DetectionSettled - IPv6 detection has resolved at least once
 */
export function isHomeIP(ip, state) {
  const {
    homeIPOverride = '',
    detectedHomeIPv4 = '',
    detectedHomeIPv6 = '',
    homeIPDetectionSettled,
    homeIPv6DetectionSettled,
  } = state;

  const normalized = normalizeIP(ip);
  if (isPrivateOrLoopbackIP(normalized)) return true;

  if (normalized.includes(':')) {
    const homeV6 = homeIPOverride.includes(':') ? homeIPOverride : detectedHomeIPv6;
    const clientPrefix = ipv6Prefix64(normalized);
    const homePrefix = ipv6Prefix64(homeV6);
    if (clientPrefix && homePrefix) return clientPrefix === homePrefix;
    return !homeIPv6DetectionSettled;
  }

  const homeV4 = (homeIPOverride && !homeIPOverride.includes(':')) ? homeIPOverride : detectedHomeIPv4;
  if (!homeV4) return !homeIPDetectionSettled;
  return normalized === normalizeIP(homeV4);
}
