// src/components/classroom/ClassroomAdminPanel.tsx
//
// Teacher instance layer, Phase 3c — the admin "Manage Classrooms & Teachers"
// screen (launched from Admin Tools, admin master password). Admin-mediated
// per the spec: only here are teacher accounts and classrooms created and
// owners assigned. No self-signup, no email.

import React, { useCallback, useEffect, useState } from 'react';
import {
  listAllClassrooms, createClassroom, setClassroomOwner,
  listTeacherAccounts, createTeacherAccount, resetTeacherPassword,
  type ClassroomMeta, type TeacherAccountInfo,
} from './classroomAdminApi';
import { colors } from '../../styles/theme';

interface ClassroomAdminPanelProps {
  onClose: () => void;
}

export function ClassroomAdminPanel({ onClose }: ClassroomAdminPanelProps): JSX.Element {
  const [accounts, setAccounts] = useState<TeacherAccountInfo[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create-account form
  const [auName, setAuName] = useState('');
  const [auPass, setAuPass] = useState('');
  const [auDisplay, setAuDisplay] = useState('');

  // create-classroom form
  const [crId, setCrId] = useState('');
  const [crName, setCrName] = useState('');
  const [crOwner, setCrOwner] = useState('');

  const reload = useCallback(async () => {
    try {
      const [accs, rooms] = await Promise.all([listTeacherAccounts(), listAllClassrooms()]);
      setAccounts(accs);
      setClassrooms(rooms);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data.');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await fn();
      setNotice(ok);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const accountName = (id: string | null) => {
    if (!id) return '— none —';
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.displayName} (${a.username})` : id;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.titleRow}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>🛠️ Manage Classrooms &amp; Teachers</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn}>✕ Close</button>
        </div>

        {error && <div style={styles.error} role="alert">{error}</div>}
        {notice && <div style={styles.notice}>{notice}</div>}

        <div style={styles.columns}>
          {/* Create teacher account */}
          <section style={styles.card}>
            <h3 style={styles.h3}>Create teacher account</h3>
            <input style={styles.input} placeholder="username" value={auName} onChange={(e) => setAuName(e.target.value)} />
            <input style={styles.input} placeholder="display name (optional)" value={auDisplay} onChange={(e) => setAuDisplay(e.target.value)} />
            <input style={styles.input} type="password" placeholder="password (min 8 chars)" value={auPass} onChange={(e) => setAuPass(e.target.value)} />
            <button
              type="button"
              disabled={busy || !auName.trim() || auPass.length < 8}
              onClick={() => run(async () => {
                await createTeacherAccount({ username: auName.trim(), password: auPass, displayName: auDisplay.trim() || undefined });
                setAuName(''); setAuPass(''); setAuDisplay('');
              }, 'Teacher account created.')}
              style={styles.primaryBtn}
            >
              Create account
            </button>
            <div style={styles.subhead}>Existing teachers</div>
            {accounts.length === 0 && <div style={styles.muted}>None yet.</div>}
            {accounts.map((a) => (
              <div key={a.id} style={styles.listItem}>
                <span>{a.displayName} <span style={styles.muted}>({a.username})</span></span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const np = window.prompt(`New password for ${a.username} (min 8 chars):`);
                    if (np && np.length >= 8) void run(() => resetTeacherPassword(a.id, np), `Password reset for ${a.username}.`);
                    else if (np !== null) setError('Password must be at least 8 characters.');
                  }}
                  style={styles.tinyBtn}
                >
                  Reset password
                </button>
              </div>
            ))}
          </section>

          {/* Create classroom */}
          <section style={styles.card}>
            <h3 style={styles.h3}>Create classroom</h3>
            <input style={styles.input} placeholder="id (lowercase, e.g. classroom-2)" value={crId} onChange={(e) => setCrId(e.target.value)} />
            <input style={styles.input} placeholder="display name" value={crName} onChange={(e) => setCrName(e.target.value)} />
            <select style={styles.input} value={crOwner} onChange={(e) => setCrOwner(e.target.value)}>
              <option value="">— assign owner later —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName} ({a.username})</option>)}
            </select>
            <button
              type="button"
              disabled={busy || !crId.trim()}
              onClick={() => run(async () => {
                await createClassroom({ id: crId.trim(), displayName: crName.trim() || undefined, owner: crOwner || undefined });
                setCrId(''); setCrName(''); setCrOwner('');
              }, 'Classroom created.')}
              style={styles.primaryBtn}
            >
              Create classroom
            </button>
            <div style={styles.subhead}>Existing classrooms</div>
            {classrooms.length === 0 && <div style={styles.muted}>None yet.</div>}
            {classrooms.map((c) => (
              <div key={c.id} style={styles.listItemCol}>
                <div><strong>{c.displayName || c.id}</strong> <span style={styles.muted}>({c.id})</span></div>
                <div style={styles.muted}>owner: {accountName(c.owner)}</div>
                <select
                  style={{ ...styles.input, marginTop: '0.25rem' }}
                  value={c.owner || ''}
                  disabled={busy}
                  onChange={(e) => {
                    const owner = e.target.value || null;
                    void run(() => setClassroomOwner(c.id, owner), `Owner updated for ${c.displayName || c.id}.`);
                  }}
                >
                  <option value="">— no owner (admin only) —</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.displayName} ({a.username})</option>)}
                </select>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto',
  },
  modal: {
    backgroundColor: '#f8fafc', borderRadius: '14px', padding: '1.25rem', width: 'min(900px, 100%)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
  },
  titleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' },
  closeBtn: { padding: '0.4rem 0.8rem', backgroundColor: 'transparent', color: colors.secondary.main, border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' },
  columns: { display: 'flex', gap: '1rem', flexWrap: 'wrap' },
  card: { flex: '1 1 340px', backgroundColor: 'white', border: `1px solid ${colors.secondary.light}`, borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 },
  h3: { margin: '0 0 0.25rem', fontSize: '1rem' },
  subhead: { marginTop: '0.75rem', fontWeight: 600, fontSize: '0.85rem', color: colors.secondary.main },
  input: { padding: '0.5rem 0.6rem', border: `1px solid ${colors.secondary.light}`, borderRadius: '6px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' },
  primaryBtn: { padding: '0.55rem 0.9rem', backgroundColor: colors.primary.main, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 },
  tinyBtn: { padding: '0.3rem 0.6rem', backgroundColor: 'transparent', color: colors.secondary.main, border: `1px solid ${colors.secondary.light}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0 },
  listItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '0.4rem 0', borderBottom: `1px solid ${colors.secondary.light}`, fontSize: '0.85rem' },
  listItemCol: { display: 'flex', flexDirection: 'column', padding: '0.5rem 0', borderBottom: `1px solid ${colors.secondary.light}`, fontSize: '0.85rem' },
  muted: { color: colors.secondary.main, fontSize: '0.8rem' },
  error: { color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #dc3545', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.5rem' },
  notice: { color: '#14532d', backgroundColor: '#f0fdf4', border: '1px solid #22c55e', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.5rem' },
};
