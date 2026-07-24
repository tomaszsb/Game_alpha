// src/utils/adminStatsApi.ts
// Client for GET /api/admin/stats/summary (the /admin/stats dashboard).
// Same admin-password-header pattern as adminSettingsApi.ts.

import { getAdminPassword } from './adminAuth';
import { getBackendURL } from './networkDetection';

export type StatsWindow = '24h' | '7d' | '30d' | 'all';

export interface TrafficBucket {
  bucket: string;
  visits: number;
  gamesCreated: number;
}

export interface SourceCount {
  source: string;
  count: number;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface RecentEntry {
  timestamp: string;
  ip: string;
  device?: string;
  userAgent?: string;
  action: string;
  gameId?: string;
  campaignSource?: string;
  playerCount?: number;
  isBot: boolean;
  [key: string]: unknown;
}

export interface StatsSummary {
  generatedAt: string;
  window: StatsWindow;
  includeBots: boolean;
  totals: {
    inWindow: number;
    uniqueIPsInWindow: number;
    botCount: number;
    adminNoiseExcluded: number;
  };
  kpis: {
    visitsToday: number;
    visitsTodayTrendPct: number;
    visits7d: number;
    visits7dTrendPct: number;
    visits30d: number;
    visits30dTrendPct: number;
    uniqueVisitors7d: number;
    gamesCreated7d: number;
    playersSeen7d: number;
  };
  traffic: TrafficBucket[];
  sources: { tagged: SourceCount[]; untagged: number };
  devices: { byOS: NamedCount[]; byBrowser: NamedCount[]; byFormFactor: NamedCount[] };
  geography: { available: boolean; note: string };
  homeVsForeign: { home: number; foreign: number };
  recent: RecentEntry[];
  exportRows: RecentEntry[];
}

export interface StatsFilters {
  window?: StatsWindow;
  includeBots?: boolean;
  full?: boolean;
  source?: string;
  action?: string;
  search?: string;
  country?: string;
}

export interface AdminStatsApiDeps {
  fetch?: typeof fetch;
  getAdminPassword?: () => string | null;
  getBackendURL?: () => string;
}

export async function fetchStatsSummary(filters: StatsFilters = {}, d: AdminStatsApiDeps = {}): Promise<StatsSummary> {
  const fetchFn = d.fetch ?? fetch;
  const getPassword = d.getAdminPassword ?? getAdminPassword;
  const getURL = d.getBackendURL ?? getBackendURL;

  const password = getPassword();
  if (!password) throw new Error('Admin session expired. Log in again to view stats.');

  const params = new URLSearchParams();
  if (filters.window) params.set('window', filters.window);
  if (filters.includeBots) params.set('includeBots', 'true');
  if (filters.full) params.set('full', 'true');
  if (filters.source) params.set('source', filters.source);
  if (filters.action) params.set('action', filters.action);
  if (filters.search) params.set('search', filters.search);
  if (filters.country) params.set('country', filters.country);

  const response = await fetchFn(`${getURL()}/api/admin/stats/summary?${params.toString()}`, {
    headers: { 'x-admin-password': password },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Request failed (HTTP ${response.status})`);
  }
  return response.json();
}

/** Builds a CSV string from the filtered export rows returned by the summary endpoint. */
export function toCsv(rows: RecentEntry[]): string {
  if (rows.length === 0) return 'timestamp,ip,device,action,gameId,campaignSource,playerCount,isBot\n';
  const columns = ['timestamp', 'ip', 'device', 'action', 'gameId', 'campaignSource', 'playerCount', 'isBot'];
  const escape = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(','));
  }
  return lines.join('\n');
}
