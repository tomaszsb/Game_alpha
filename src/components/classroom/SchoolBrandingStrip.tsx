// src/components/classroom/SchoolBrandingStrip.tsx
//
// A teacher's school name + logo form, on the classroom's own row. Folded away until opened so
// the row stays the size it was. The logo is checked by the server (by file content); this form
// only previews and reports what the server says.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { colors } from '../../styles/theme';
import {
  fetchSchoolBranding, logoUrl, removeLogo, saveSchoolName, uploadLogo,
  type SchoolBranding, type SchoolBrandingDeps,
} from './schoolBrandingApi';

interface Props {
  instanceId: string;
  deps?: SchoolBrandingDeps;
}

export function SchoolBrandingStrip({ instanceId, deps }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState<SchoolBranding | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const found = await fetchSchoolBranding(instanceId, deps);
    setBranding(found);
    setName(found?.schoolName ?? '');
  }, [instanceId, deps]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const finish = async (result: { success: boolean; error?: string }, okText: string) => {
    setMessage(result.success ? { ok: true, text: okText } : { ok: false, text: result.error || 'That did not work.' });
    if (result.success) await load();
    setBusy(false);
  };

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    await finish(await uploadLogo(instanceId, file, deps), 'Logo saved.');
  };

  return (
    <div style={styles.wrap}>
      <button type="button" style={styles.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        🏷️ School name &amp; logo {open ? '▴' : '▾'}
      </button>
      {open && (
        <div style={styles.body}>
          <label style={styles.label} htmlFor={`school-name-${instanceId}`}>School name</label>
          <div style={styles.line}>
            <input
              id={`school-name-${instanceId}`}
              style={styles.input}
              value={name}
              maxLength={200}
              placeholder="e.g. Farmingdale State College"
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              type="button"
              style={styles.btn}
              disabled={busy || name.trim() === (branding?.schoolName ?? '')}
              onClick={async () => { setBusy(true); setMessage(null); await finish(await saveSchoolName(instanceId, name.trim(), deps), 'School name saved.'); }}
            >
              Save name
            </button>
          </div>

          <div style={styles.label}>Logo</div>
          <div style={styles.line}>
            {branding?.logoVersion ? (
              <img
                src={logoUrl(instanceId, branding.logoVersion)}
                alt={`${branding.schoolName ?? 'School'} logo`}
                style={styles.preview}
              />
            ) : (
              <span style={styles.muted}>No logo yet.</span>
            )}
            <input ref={fileInput} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => void onPick(e)} />
            <button type="button" style={styles.btn} disabled={busy} onClick={() => fileInput.current?.click()}>
              {branding?.logoVersion ? 'Replace logo' : 'Choose logo'}
            </button>
            {branding?.logoVersion ? (
              <button
                type="button"
                style={styles.dangerBtn}
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('Remove this classroom\'s logo?')) return;
                  setBusy(true); setMessage(null);
                  await finish(await removeLogo(instanceId, deps), 'Logo removed.');
                }}
              >
                Remove logo
              </button>
            ) : null}
          </div>
          <div style={styles.muted}>A PNG or JPEG picture under 1 MB, at least 64 pixels wide. It is shown on your class page, the game header and the certificate.</div>
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
  body: { display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingTop: '0.4rem' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: colors.secondary.main },
  line: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' },
  input: {
    flex: '1 1 180px', minWidth: 0, padding: '0.5rem 0.6rem',
    border: `1px solid ${colors.secondary.light}`, borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box',
  },
  preview: { height: '48px', maxWidth: '120px', objectFit: 'contain', border: `1px solid ${colors.secondary.light}`, borderRadius: '6px', background: '#fff' },
  btn: {
    padding: '0.45rem 0.8rem', backgroundColor: colors.secondary.light, color: colors.secondary.main,
    border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  dangerBtn: {
    padding: '0.45rem 0.8rem', backgroundColor: '#fff', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  muted: { color: colors.secondary.main, fontSize: '0.8rem' },
  ok: { color: '#14532d', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' },
  bad: { color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #dc3545', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' },
};
