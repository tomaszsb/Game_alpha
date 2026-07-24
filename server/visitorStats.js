// server/visitorStats.js
// Pure aggregation logic for the admin stats dashboard (GET
// /api/admin/stats/summary). Kept side-effect-free and importable on its own
// (server.js can't be imported directly in tests — it auto-listens on
// import), same pattern as authGuards.js / homeIP.js.
//
// Takes already-parsed log entries (see parseLogLine) plus a window/filter
// options bag and returns one aggregated JSON blob covering everything the
// dashboard renders: KPIs, time-bucketed traffic, source/device/browser
// breakdowns, a recent-activity feed, and bot-detection metadata.
//
// Known data gaps (visitors.log doesn't currently capture these fields —
// see server.js logVisitor()): no referrer header, no country/geo, no
// client screen size. The aggregates below work only with what's actually
// logged: timestamp, ip, device, userAgent, action, gameId, campaignSource,
// playerCount, and the admin/teacher auth success/fail actions.

// LIST_GAMES is emitted only by the admin-only GET /api/games endpoint (the
// maintainer's own AdminGameManager panel polling), never by a visitor
// action. It dominates the raw log (>90% of lines) and would drown every
// other aggregate if treated as visitor traffic, so it's excluded
// unconditionally -- this isn't a "bot", it's the site owner's own tooling.
const ADMIN_NOISE_ACTIONS = new Set(['LIST_GAMES']);

// Broad, deliberately over-inclusive UA match: this dashboard doesn't need to
// tell a "friendly" crawler (Googlebot) from a hostile scanner (sqlmap) --
// both are non-human traffic that would otherwise inflate visit counts, so
// one pattern list covers both.
const SCANNER_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /scan(?:ner)?/i, /curl\//i, /wget/i,
  /python-requests/i, /python-urllib/i, /go-http-client/i, /okhttp/i,
  /nmap/i, /sqlmap/i, /nikto/i, /masscan/i, /libwww/i, /httpclient/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i, /petalbot/i, /censys/i, /zgrab/i,
  /headlesschrome/i, /phantomjs/i,
];

function hasScannerUA(userAgent) {
  return typeof userAgent === 'string' && SCANNER_UA_PATTERNS.some((re) => re.test(userAgent));
}

// Rapid-fire: N+ requests from the same IP within a short rolling window.
const RAPID_FIRE_WINDOW_MS = 5 * 1000;
const RAPID_FIRE_THRESHOLD = 10;

// ?src= enumeration: an IP cycling through many distinct campaignSource
// values in a short window looks like brute-force guessing, not a real
// visitor (a real visitor arrives with exactly one campaign tag).
const ENUMERATION_WINDOW_MS = 5 * 60 * 1000;
const ENUMERATION_DISTINCT_SOURCES = 8;

/**
 * Parse one raw log line into an entry with a numeric `_ts` (epoch ms) for
 * sorting/bucketing, or null if the line is unparseable/malformed.
 */
export function parseLogLine(line) {
  if (!line) return null;
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const ts = Date.parse(obj.timestamp);
  if (Number.isNaN(ts)) return null;
  return { ...obj, _ts: ts };
}

/**
 * Decide which IPs behaved like bots across the whole entry set (burst
 * traffic or source-tag enumeration). Independent of per-entry scanner-UA
 * detection, which is decided separately so a single scanner hit doesn't
 * need burst behavior to be flagged.
 */
function detectBotIPs(entries) {
  const byIP = new Map();
  for (const e of entries) {
    if (!e.ip) continue;
    if (!byIP.has(e.ip)) byIP.set(e.ip, []);
    byIP.get(e.ip).push(e);
  }

  const botIPs = new Set();
  for (const [ip, list] of byIP) {
    list.sort((a, b) => a._ts - b._ts);

    for (let i = 0; i + RAPID_FIRE_THRESHOLD - 1 < list.length; i++) {
      if (list[i + RAPID_FIRE_THRESHOLD - 1]._ts - list[i]._ts <= RAPID_FIRE_WINDOW_MS) {
        botIPs.add(ip);
        break;
      }
    }
    if (botIPs.has(ip)) continue;

    const withSource = list.filter((e) => typeof e.campaignSource === 'string' && e.campaignSource);
    outer: for (let i = 0; i < withSource.length; i++) {
      const windowEnd = withSource[i]._ts + ENUMERATION_WINDOW_MS;
      const distinct = new Set();
      for (let j = i; j < withSource.length && withSource[j]._ts <= windowEnd; j++) {
        distinct.add(withSource[j].campaignSource);
        if (distinct.size >= ENUMERATION_DISTINCT_SOURCES) {
          botIPs.add(ip);
          break outer;
        }
      }
    }
  }
  return botIPs;
}

/** First 3 octets of an IPv4 address, or a /64-style truncation for IPv6. */
export function ipPrefix(ip) {
  if (typeof ip !== 'string' || !ip) return 'unknown';
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.\d+$/);
  if (v4) return `${v4[1]}.${v4[2]}.${v4[3]}.xxx`;
  if (ip.includes(':')) {
    const parts = ip.replace(/^::ffff:/i, '').split(':');
    return parts.slice(0, 4).join(':') + '::xxxx';
  }
  return ip; // private/loopback/unknown strings pass through as-is
}

const BROWSER_PATTERNS = [
  ['Edge', /Edg(?:e|A|iOS)?\//i],
  ['Samsung Browser', /SamsungBrowser\//i],
  ['Opera', /OPR\/|Opera/i],
  ['Firefox', /Firefox\//i],
  ['Chrome', /Chrome\//i],
  ['Safari', /Safari\//i],
];

function detectBrowser(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent) return 'Unknown';
  for (const [name, re] of BROWSER_PATTERNS) {
    if (re.test(userAgent)) return name;
  }
  return 'Other';
}

const TV_UA_PATTERN = /Smart[\s-]?TV|Tizen|Web0S|NetCast|HbbTV|GoogleTV|Google TV|Android\s?TV|AFT[A-Z]|CrKey|BRAVIA|AppleTV|tvOS|Roku|VIDAA|PhilipsTV|DTV/i;
const MOBILE_UA_PATTERN = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_UA_PATTERN = /iPad|Tablet/i;

/** Coarse form-factor bucket: tv / mobile / tablet / desktop. */
function detectFormFactor(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent) return 'unknown';
  if (TV_UA_PATTERN.test(userAgent)) return 'tv';
  if (TABLET_UA_PATTERN.test(userAgent)) return 'tablet';
  if (MOBILE_UA_PATTERN.test(userAgent)) return 'mobile';
  return 'desktop';
}

export const WINDOW_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

function bucketKey(ts, hourly) {
  const iso = new Date(ts).toISOString();
  return hourly ? iso.slice(0, 13) + ':00:00.000Z' : iso.slice(0, 10);
}

/**
 * Build the full aggregated stats blob.
 *
 * @param {Array<object>} rawEntries - output of parseLogLine (nulls filtered)
 * @param {object} options
 * @param {number} [options.now] - epoch ms "current time" (injectable for tests)
 * @param {'24h'|'7d'|'30d'|'all'} [options.window]
 * @param {boolean} [options.includeBots] - include bot-flagged traffic in real counts
 * @param {boolean} [options.full] - return full IPs instead of redacted prefixes
 * @param {{source?: string, action?: string, search?: string}} [options.filters]
 * @param {(ip: string) => boolean} [options.isHomeIP]
 */
export function aggregateVisitorStats(rawEntries, options = {}) {
  const {
    now = Date.now(),
    window = '30d',
    includeBots = false,
    full = false,
    filters = {},
    isHomeIP = () => false,
  } = options;

  const entries = (rawEntries || []).filter((e) => e && typeof e._ts === 'number');
  const botIPs = detectBotIPs(entries);

  const classified = entries.map((e) => ({
    ...e,
    _isAdminNoise: ADMIN_NOISE_ACTIONS.has(e.action),
    _isBot: !ADMIN_NOISE_ACTIONS.has(e.action) && (hasScannerUA(e.userAgent) || botIPs.has(e.ip)),
  }));

  const real = classified.filter((e) => !e._isAdminNoise && (includeBots || !e._isBot));
  const botCount = classified.filter((e) => !e._isAdminNoise && e._isBot).length;
  const adminNoiseCount = classified.filter((e) => e._isAdminNoise).length;

  // ---- KPI row: fixed windows regardless of the chart's `window` toggle ----
  const countSince = (ms, pred) => real.filter((e) => e._ts >= now - ms && (!pred || pred(e))).length;
  const uniqueSince = (ms) => new Set(real.filter((e) => e._ts >= now - ms).map((e) => e.ip)).size;
  const trend = (currentMs) => {
    const current = countSince(currentMs);
    const previous = real.filter((e) => e._ts >= now - 2 * currentMs && e._ts < now - currentMs).length;
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const kpis = {
    visitsToday: countSince(WINDOW_MS['24h']),
    visitsTodayTrendPct: trend(WINDOW_MS['24h']),
    visits7d: countSince(WINDOW_MS['7d']),
    visits7dTrendPct: trend(WINDOW_MS['7d']),
    visits30d: countSince(WINDOW_MS['30d']),
    visits30dTrendPct: trend(WINDOW_MS['30d']),
    uniqueVisitors7d: uniqueSince(WINDOW_MS['7d']),
    gamesCreated7d: countSince(WINDOW_MS['7d'], (e) => e.action === 'CREATE_GAME'),
    playersSeen7d: countSince(WINDOW_MS['7d'], (e) => e.action === 'PLAYER_JOINED'),
  };

  // ---- windowed + filtered pool driving everything else on the page ----
  const windowMs = WINDOW_MS[window] ?? WINDOW_MS['30d'];
  const cutoff = windowMs === Infinity ? -Infinity : now - windowMs;
  let pool = real.filter((e) => e._ts >= cutoff && e._ts <= now);

  if (filters.action) pool = pool.filter((e) => e.action === filters.action);
  if (filters.source) pool = pool.filter((e) => (e.campaignSource || 'none') === filters.source);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    pool = pool.filter((e) =>
      (e.ip || '').toLowerCase().includes(q) || (e.gameId || '').toLowerCase().includes(q)
    );
  }
  // filters.country: no-op today -- visitors.log carries no geo field (see
  // module comment). Accepted here so the client can wire the dropdown up
  // front without a breaking API change once geo data exists.

  // ---- traffic over time (bucketed) + games-created overlay ----
  const hourly = window === '24h';
  const buckets = new Map();
  for (const e of pool) {
    const key = bucketKey(e._ts, hourly);
    if (!buckets.has(key)) buckets.set(key, { bucket: key, visits: 0, gamesCreated: 0 });
    const b = buckets.get(key);
    b.visits++;
    if (e.action === 'CREATE_GAME') b.gamesCreated++;
  }
  const traffic = Array.from(buckets.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));

  // ---- sources: campaignSource tags, plus one aggregate "no tag" bucket ----
  const sourceCounts = new Map();
  let untaggedCount = 0;
  for (const e of pool) {
    if (typeof e.campaignSource === 'string' && e.campaignSource) {
      sourceCounts.set(e.campaignSource, (sourceCounts.get(e.campaignSource) || 0) + 1);
    } else if (e.action !== 'ADMIN_AUTH_SUCCESS' && e.action !== 'ADMIN_AUTH_FAILED') {
      untaggedCount++;
    }
  }
  const sources = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // ---- devices: OS bucket (from `device`), browser + form-factor (from UA) ----
  const byOS = new Map();
  const byBrowser = new Map();
  const byFormFactor = new Map();
  for (const e of pool) {
    const os = e.device || 'Unknown';
    byOS.set(os, (byOS.get(os) || 0) + 1);
    const browser = detectBrowser(e.userAgent);
    byBrowser.set(browser, (byBrowser.get(browser) || 0) + 1);
    const ff = detectFormFactor(e.userAgent);
    byFormFactor.set(ff, (byFormFactor.get(ff) || 0) + 1);
  }
  const toSorted = (m) => Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // ---- home vs foreign (given HOME_IP auto-detection added earlier) ----
  let homeCount = 0;
  let foreignCount = 0;
  for (const e of pool) {
    if (isHomeIP(e.ip)) homeCount++;
    else foreignCount++;
  }

  // ---- recent activity feed (newest first) ----
  const recent = pool
    .slice()
    .sort((a, b) => b._ts - a._ts)
    .slice(0, 20)
    .map((e) => redact(e, full));

  // ---- CSV-export slice: the same filtered pool, oldest first ----
  const exportRows = pool
    .slice()
    .sort((a, b) => a._ts - b._ts)
    .map((e) => redact(e, full));

  return {
    generatedAt: new Date(now).toISOString(),
    window,
    includeBots,
    totals: {
      inWindow: pool.length,
      uniqueIPsInWindow: new Set(pool.map((e) => e.ip)).size,
      botCount,
      adminNoiseExcluded: adminNoiseCount,
    },
    kpis,
    traffic,
    sources: { tagged: sources, untagged: untaggedCount },
    devices: { byOS: toSorted(byOS), byBrowser: toSorted(byBrowser), byFormFactor: toSorted(byFormFactor) },
    geography: { available: false, note: 'No country/geo field in visitors.log yet -- see follow-up in CHANGELOG/TODO.' },
    homeVsForeign: { home: homeCount, foreign: foreignCount },
    recent,
    exportRows,
  };
}

function redact(e, full) {
  const { _ts, _isBot, _isAdminNoise, ip, ...rest } = e;
  return {
    ...rest,
    ip: full ? ip : ipPrefix(ip),
    isBot: _isBot,
  };
}
