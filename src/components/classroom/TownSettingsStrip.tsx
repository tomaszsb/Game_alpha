// src/components/classroom/TownSettingsStrip.tsx
//
// A teacher's town settings (round town, stage 1a), on the classroom's own row, folded away until opened. Plain on
// purpose (the backroom is being redesigned): one line per setting, the classroom's value or the stock one, Save and
// Reset. `round_town` = on gives every new game in this class the round town.

import React, { useCallback, useEffect, useState } from 'react';
import { colors } from '../../styles/theme';
import { fetchTownSettings, saveTownSetting, type TownSettingRow, type TownSettingsDeps } from './townSettingsApi';

interface Props {
  instanceId: string;
  deps?: TownSettingsDeps;
}

export function TownSettingsStrip({ instanceId, deps }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<TownSettingRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const found = await fetchTownSettings(instanceId, deps);
    setRows(found);
    setDraft(Object.fromEntries((found ?? []).map(r => [r.key, r.mine ?? r.stock])));
  }, [instanceId, deps]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const save = async (key: string, value: string, okText: string) => {
    setBusy(true);
    setMessage(null);
    const result = await saveTownSetting(instanceId, key, value, deps);
    setMessage(result.success ? { ok: true, text: okText } : { ok: false, text: result.error });
    if (result.success) await load();
    setBusy(false);
  };

  return (
    <div style={styles.wrap} data-testid={`town-settings-${instanceId}`}>
      <button type="button" style={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        🏘️ Town settings (round town) {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={styles.body}>
          {rows === null && <div style={styles.muted}>Loading…</div>}
          {rows?.map(r => {
            const value = draft[r.key] ?? '';
            const changed = value.trim() !== (r.mine ?? r.stock);
            return (
              <div key={r.key} style={styles.line}>
                <label style={styles.key} htmlFor={`town-${instanceId}-${r.key}`}>{r.key}</label>
                <input
                  id={`town-${instanceId}-${r.key}`}
                  style={styles.input}
                  value={value}
                  maxLength={400}
                  disabled={busy}
                  onChange={(e) => setDraft(d => ({ ...d, [r.key]: e.target.value }))}
                />
                <button type="button" style={styles.btn} disabled={busy || !changed} onClick={() => void save(r.key, value, `${r.key} saved.`)}>Save</button>
                <button type="button" style={styles.btn} disabled={busy || r.mine === null} onClick={() => void save(r.key, '', `${r.key} is back to ${r.stock || 'blank'}.`)} title={`Back to the stock value: ${r.stock}`}>Reset</button>
                {r.mine !== null && <span style={styles.muted}>(stock: {r.stock})</span>}
              </div>
            );
          })}
          <div style={styles.muted}>round_town on = every new game in this class is round. Changes apply to games started after saving.</div>
          {message && <div role="status" style={message.ok ? styles.ok : styles.bad}>{message.text}</div>}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { width: '100%' },
  toggle: {
    background: 'none', border: 'none', padding: '0.2rem 0', cursor: 'pointer',
    color: colors.secondary.main, fontSize: '0.85rem', fontWeight: 500,
  },
  body: { display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingTop: '0.4rem' },
  line: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' },
  key: { flex: '0 0 11rem', fontSize: '0.8rem', fontFamily: 'ui-monospace, Menlo, Consolas, monospace', color: colors.secondary.main },
  input: {
    flex: '1 1 160px', minWidth: 0, padding: '0.35rem 0.5rem',
    border: `1px solid ${colors.secondary.light}`, borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box',
  },
  btn: {
    padding: '0.3rem 0.6rem', backgroundColor: colors.secondary.light, color: colors.secondary.main,
    border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
  },
  muted: { color: colors.secondary.main, fontSize: '0.8rem' },
  ok: { color: '#14532d', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' },
  bad: { color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #dc3545', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' },
};
