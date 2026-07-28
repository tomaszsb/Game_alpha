// src/components/admin/StatsDashboard.tsx
// The actual dashboard content for the /admin/stats page: KPI row, traffic
// chart, sources chart, device split, recent activity feed, filter bar, CSV
// export. Rendered by src/pages/AdminStatsPage.tsx once the admin password
// is confirmed. Auto-refreshes every 60s while the tab is visible.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Line, Bar, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer,
  ComposedChart, BarChart, PieChart,
} from 'recharts';
import { fetchStatsSummary, toCsv, type StatsSummary, type StatsWindow } from '../../utils/adminStatsApi';
import { colors } from '../../styles/theme';

const REFRESH_MS = 60 * 1000;
const CHART_COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#17a2b8', '#fd7e14', '#6c757d'];

function fmtBucket(bucket: string, window: StatsWindow): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return bucket;
  return window === '24h'
    ? d.toLocaleTimeString(undefined, { hour: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TrendArrow({ pct }: { pct: number }): JSX.Element | null {
  if (pct === 0) return <span style={{ color: colors.text.tertiary, fontSize: '0.75rem' }}>—</span>;
  const up = pct > 0;
  return (
    <span style={{ color: up ? colors.success.text : colors.danger.text, fontSize: '0.75rem', fontWeight: 600 }}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

function KpiTile({ label, value, trendPct }: { label: string; value: number | string; trendPct?: number }): JSX.Element {
  return (
    <div style={{
      background: colors.background.paper, border: `1px solid ${colors.border.primary}`,
      borderRadius: 10, padding: '0.9rem 1rem', flex: '1 1 140px', minWidth: 140,
    }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: colors.text.primary, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: colors.text.secondary, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{label}</span>
        {trendPct !== undefined && <TrendArrow pct={trendPct} />}
      </div>
    </div>
  );
}

function Section({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }): JSX.Element {
  return (
    <div style={{
      background: colors.background.paper, border: `1px solid ${colors.border.primary}`,
      borderRadius: 10, padding: '1rem', marginBottom: '1rem',
    }}>
      <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: colors.text.primary }}>{title}</h3>
      {children}
      {footer && <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: colors.text.tertiary }}>{footer}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem', border: `1px solid ${colors.border.primary}`, borderRadius: 6, fontSize: '0.85rem',
};
const btnStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem', border: 'none', borderRadius: 6, fontSize: '0.85rem',
  cursor: 'pointer', fontWeight: 500,
};

export function StatsDashboard(): JSX.Element {
  const [data, setData] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [window_, setWindow] = useState<StatsWindow>('7d');
  const [includeBots, setIncludeBots] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [originFilter, setOriginFilter] = useState<'' | 'home' | 'foreign'>('');
  const [search, setSearch] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const summary = await fetchStatsSummary({
        window: window_,
        includeBots,
        action: actionFilter || undefined,
        source: sourceFilter || undefined,
        search: search || undefined,
        origin: originFilter || undefined,
      });
      setData(summary);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [window_, includeBots, actionFilter, sourceFilter, originFilter, search]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s while the tab is visible.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  // "last updated Xs ago" ticker.
  const tickerRef = useRef<number | null>(null);
  useEffect(() => {
    if (tickerRef.current) window.clearInterval(tickerRef.current);
    tickerRef.current = window.setInterval(() => {
      if (lastUpdatedAt) setSecondsAgo(Math.round((Date.now() - lastUpdatedAt) / 1000));
    }, 1000);
    return () => { if (tickerRef.current) window.clearInterval(tickerRef.current); };
  }, [lastUpdatedAt]);

  const handleExportCsv = () => {
    if (!data) return;
    const csv = toCsv(data.exportRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-stats-${window_}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: colors.text.secondary }}>Loading stats…</div>;
  }

  if (error && !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: colors.danger.text }}>
        {error}
        <div style={{ marginTop: '1rem' }}>
          <button type="button" style={{ ...btnStyle, background: colors.primary.main, color: 'white' }} onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return <></>;

  const formFactorData = data.devices.byFormFactor.map((d) => ({ name: d.name, value: d.count }));
  const browserData = data.devices.byBrowser;
  const sourceChartData = [...data.sources.tagged];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1rem', fontFamily: 'inherit' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>📊 Site Stats</h2>
        <div style={{ fontSize: '0.75rem', color: colors.text.tertiary }}>
          {error ? <span style={{ color: colors.danger.text }}>{error} (showing last good data)</span> : `Updated ${secondsAgo}s ago`}
        </div>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center',
        marginBottom: '1rem', background: colors.background.secondary, padding: '0.6rem', borderRadius: 8,
      }}>
        <select value={window_} onChange={(e) => setWindow(e.target.value as StatsWindow)} style={inputStyle}>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={inputStyle}>
          <option value="">All actions</option>
          {['CREATE_GAME', 'PLAYER_JOINED', 'GAME_STARTED', 'DELETE_GAME', 'JOIN_INFO', 'BUG_REPORT', 'ADMIN_AUTH_SUCCESS', 'ADMIN_AUTH_FAILED'].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        {data.sources.tagged.length > 0 && (
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={inputStyle}>
            <option value="">All sources</option>
            {data.sources.tagged.map((s) => <option key={s.source} value={s.source}>{s.source}</option>)}
          </select>
        )}
        <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value as '' | 'home' | 'foreign')} style={inputStyle}>
          <option value="">Home + foreign</option>
          <option value="home">🏠 Home only</option>
          <option value="foreign">🌍 Foreign only</option>
        </select>
        <input
          type="text" placeholder="Search IP or game ID" value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: 160 }}
        />
        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={includeBots} onChange={(e) => setIncludeBots(e.target.checked)} />
          Include bots
        </label>
        <button type="button" onClick={handleExportCsv} style={{ ...btnStyle, background: colors.secondary.main, color: 'white', marginLeft: 'auto' }}>
          ⬇️ Export CSV
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <KpiTile label="Visits today" value={data.kpis.visitsToday} trendPct={data.kpis.visitsTodayTrendPct} />
        <KpiTile label="Visits (7d)" value={data.kpis.visits7d} trendPct={data.kpis.visits7dTrendPct} />
        <KpiTile label="Visits (30d)" value={data.kpis.visits30d} trendPct={data.kpis.visits30dTrendPct} />
        <KpiTile label="Unique visitors (7d)" value={data.kpis.uniqueVisitors7d} />
        <KpiTile label="Games created (7d)" value={data.kpis.gamesCreated7d} />
        <KpiTile label="Players seen (7d)" value={data.kpis.playersSeen7d} />
      </div>

      {/* Traffic over time */}
      <Section
        title="Traffic over time"
        footer={`${data.totals.botCount} bot hit(s) and ${data.totals.adminNoiseExcluded} admin-panel refresh(es) excluded from these numbers.`}
      >
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={data.traffic}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.primary} />
              <XAxis dataKey="bucket" tickFormatter={(b) => fmtBucket(b, window_)} fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip labelFormatter={(b) => fmtBucket(String(b), window_)} />
              <Legend />
              <Line type="monotone" dataKey="visits" name="Visits" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gamesCreated" name="Games created" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Sources */}
      <Section
        title="Traffic sources"
        footer={`${data.sources.untagged} visit(s) without a ?src= campaign tag. Referrer breakdown (Reddit, direct, etc.) isn't available yet — visitors.log doesn't capture the Referer header today.`}
      >
        {sourceChartData.length === 0 ? (
          <div style={{ color: colors.text.tertiary, fontSize: '0.85rem' }}>No tagged campaign traffic in this window.</div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={sourceChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border.primary} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="source" width={120} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" name="Visits" fill={CHART_COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      {/* Geography */}
      <Section
        title="Geography"
        footer={data.geography.available ? `${data.geography.unknownCount} visit(s) with no resolvable country (private/local IPs, etc).` : undefined}
      >
        {!data.geography.available ? (
          <div style={{ color: colors.text.tertiary, fontSize: '0.85rem' }}>{data.geography.note}</div>
        ) : data.geography.byCountry.length === 0 ? (
          <div style={{ color: colors.text.tertiary, fontSize: '0.85rem' }}>No visits with a resolvable country in this window.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', maxWidth: 360 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border.primary}` }}>
                  <th style={{ padding: '4px 6px' }}>Country</th>
                  <th style={{ padding: '4px 6px' }}>Visits</th>
                </tr>
              </thead>
              <tbody>
                {data.geography.byCountry.map((c) => (
                  <tr key={c.country} style={{ borderBottom: `1px solid ${colors.border.primary}` }}>
                    <td style={{ padding: '4px 6px' }}>{c.country}</td>
                    <td style={{ padding: '4px 6px' }}>{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Devices */}
      <Section title="Devices">
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: 220, height: 200 }}>
            <div style={{ fontSize: '0.8rem', color: colors.text.secondary, marginBottom: 4 }}>Form factor</div>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={formFactorData} dataKey="value" nameKey="name" outerRadius={70} label>
                  {formFactorData.map((entry, i) => <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: '1 1 260px', minWidth: 260, height: 200 }}>
            <div style={{ fontSize: '0.8rem', color: colors.text.secondary, marginBottom: 4 }}>Browser</div>
            <ResponsiveContainer>
              <BarChart data={browserData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border.primary} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" name="Visits" fill={CHART_COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ fontSize: '0.75rem', color: colors.text.tertiary, marginTop: 8 }}>
          Screen-size histogram isn’t available yet — the client doesn’t currently report its screen size to the server.
        </div>
      </Section>

      {/* Home vs foreign */}
      <Section
        title="Home vs. foreign traffic"
        footer="Home = your own detected/configured HOME_IP (see the foreign-game text alert feature). Filter the table below to Home only / Foreign only to inspect individual visits."
      >
        {(() => {
          const { home, foreign } = data.homeVsForeign;
          const total = home + foreign;
          const homePct = total === 0 ? 0 : Math.round((home / total) * 100);
          return (
            <>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.95rem', marginBottom: '0.6rem' }}>
                <div>🏠 Home: <strong>{home}</strong> {total > 0 && <span style={{ color: colors.text.tertiary, fontSize: '0.8rem' }}>({homePct}%)</span>}</div>
                <div>🌍 Foreign: <strong>{foreign}</strong> {total > 0 && <span style={{ color: colors.text.tertiary, fontSize: '0.8rem' }}>({100 - homePct}%)</span>}</div>
              </div>
              {total > 0 && (
                <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', border: `1px solid ${colors.border.primary}` }}>
                  <div style={{ width: `${homePct}%`, background: CHART_COLORS[1] }} title={`Home: ${home} (${homePct}%)`} />
                  <div style={{ width: `${100 - homePct}%`, background: CHART_COLORS[3] }} title={`Foreign: ${foreign} (${100 - homePct}%)`} />
                </div>
              )}
            </>
          );
        })()}
      </Section>

      {/* Recent activity */}
      <Section title="Recent activity">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.border.primary}` }}>
                <th style={{ padding: '4px 6px' }}>Time</th>
                <th style={{ padding: '4px 6px' }}>Action</th>
                <th style={{ padding: '4px 6px' }}>Origin</th>
                <th style={{ padding: '4px 6px' }}>IP prefix</th>
                <th style={{ padding: '4px 6px' }}>Country</th>
                <th style={{ padding: '4px 6px' }}>Device</th>
                <th style={{ padding: '4px 6px' }}>Game</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((entry, i) => (
                <React.Fragment key={`${entry.timestamp}-${i}`}>
                  <tr
                    onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                    style={{ cursor: 'pointer', borderBottom: `1px solid ${colors.border.primary}`, opacity: entry.isBot ? 0.5 : 1 }}
                  >
                    <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '4px 6px' }}>{entry.action}{entry.isBot ? ' 🤖' : ''}</td>
                    <td style={{ padding: '4px 6px' }} title={entry.isHome ? 'Home' : 'Foreign'}>{entry.isHome ? '🏠' : '🌍'}</td>
                    <td style={{ padding: '4px 6px' }}>{entry.ip}</td>
                    <td style={{ padding: '4px 6px' }}>{entry.country || '—'}</td>
                    <td style={{ padding: '4px 6px' }}>{entry.device || '—'}</td>
                    <td style={{ padding: '4px 6px' }}>{entry.gameId || '—'}</td>
                  </tr>
                  {expandedRow === i && (
                    <tr>
                      <td colSpan={7} style={{ padding: '6px', background: colors.background.secondary, fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(entry, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {data.recent.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: colors.text.tertiary }}>No activity in this window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
