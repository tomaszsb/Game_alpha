// src/components/classroom/TeacherClassroomPanel.tsx
//
// Teacher instance layer, Phase 3c — what a logged-in teacher sees after the
// combined login. Lists the classrooms they own; from each they can open
// Classroom Setup (edit their board) or start a game bound to that classroom.

import React, { useCallback, useEffect, useState } from 'react';
import { listMyClassrooms, createMyClassroom, deleteClassroom, type ClassroomMeta } from './classroomAdminApi';
import { ClassroomSetup } from './ClassroomSetup';
import { teacherLogout, getTeacherAccount } from '../../utils/teacherAuth';
import { colors } from '../../styles/theme';

interface TeacherClassroomPanelProps {
  /** Start a game bound to a classroom (PlayerSetup owns create + navigate). */
  onStartGame: (instanceId: string) => void;
  /** Called after a successful logout so the parent can reset its view. */
  onLoggedOut: () => void;
}

export function TeacherClassroomPanel({ onStartGame, onLoggedOut }: TeacherClassroomPanelProps): JSX.Element {
  const account = getTeacherAccount();
  const [classrooms, setClassrooms] = useState<ClassroomMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSetup, setOpenSetup] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setClassrooms(await listMyClassrooms());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your classrooms.');
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleLogout = async () => {
    await teacherLogout();
    onLoggedOut();
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await createMyClassroom({ displayName: name });
      setNewName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the classroom.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: ClassroomMeta) => {
    const label = c.displayName || c.id;
    if (!window.confirm(`Delete classroom "${label}"? This removes its board setup. Games already in progress are not affected.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteClassroom(c.id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the classroom.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <span style={{ fontWeight: 600 }}>
          👩‍🏫 Signed in as {account?.displayName || account?.username || 'teacher'}
        </span>
        <button type="button" onClick={handleLogout} style={styles.logoutBtn}>Log out</button>
      </div>

      {error && <div style={styles.error} role="alert">{error}</div>}

      {classrooms === null && !error && <div style={styles.muted}>Loading your classrooms…</div>}

      {classrooms && classrooms.length === 0 && (
        <div style={styles.muted}>
          No classrooms are assigned to you yet. Ask the administrator to create one for your account.
        </div>
      )}

      {classrooms && classrooms.map((c) => (
        <div key={c.id} style={styles.row}>
          <div style={{ flex: '1 1 100%', minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{c.displayName || c.id}</div>
            <div style={styles.muted}>{c.id}</div>
          </div>
          <div style={styles.btnGroup}>
            <button type="button" disabled={busy} onClick={() => setOpenSetup({ id: c.id, name: c.displayName || c.id })} style={styles.secondaryBtn}>
              🏫 Classroom Setup
            </button>
            <button type="button" disabled={busy} onClick={() => onStartGame(c.id)} style={styles.primaryBtn}>
              🎮 Start a game
            </button>
            <button type="button" disabled={busy} onClick={() => void handleDelete(c)} style={styles.dangerBtn} title={`Delete ${c.displayName || c.id}`}>
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}

      {classrooms && (
        <div style={styles.createRow}>
          <input
            style={styles.input}
            placeholder="New classroom name (e.g. Room 4B)"
            value={newName}
            disabled={busy}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
          />
          <button type="button" disabled={busy || !newName.trim()} onClick={() => void handleCreate()} style={styles.primaryBtn}>
            ➕ New classroom
          </button>
        </div>
      )}

      {openSetup && (
        <ClassroomSetup
          instanceId={openSetup.id}
          classroomName={openSetup.name}
          onClose={() => { setOpenSetup(null); void reload(); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' },
  row: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem',
    padding: '0.75rem 1rem', border: `1px solid ${colors.secondary.light}`, borderRadius: '10px',
    backgroundColor: 'white', flexWrap: 'wrap', boxSizing: 'border-box',
  },
  // Buttons wrap to new lines on a narrow screen instead of overflowing the
  // panel (fb:845c64d6 — "Start a game" was clipped off the right edge).
  btnGroup: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%' },
  createRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' },
  input: {
    flex: '1 1 180px', minWidth: 0, padding: '0.5rem 0.6rem',
    border: `1px solid ${colors.secondary.light}`, borderRadius: '6px', fontSize: '0.85rem', boxSizing: 'border-box',
  },
  muted: { color: colors.secondary.main, fontSize: '0.85rem' },
  error: { color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #dc3545', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' },
  primaryBtn: {
    flex: '0 1 auto', whiteSpace: 'nowrap',
    padding: '0.5rem 0.9rem', backgroundColor: colors.primary.main, color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  secondaryBtn: {
    flex: '0 1 auto', whiteSpace: 'nowrap',
    padding: '0.5rem 0.9rem', backgroundColor: colors.secondary.light, color: colors.secondary.main,
    border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  dangerBtn: {
    flex: '0 1 auto', whiteSpace: 'nowrap',
    padding: '0.5rem 0.9rem', backgroundColor: '#fff', color: '#b91c1c',
    border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  logoutBtn: {
    padding: '0.4rem 0.8rem', backgroundColor: 'transparent', color: colors.secondary.main,
    border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
  },
};
