// src/components/classroom/TeacherClassroomPanel.tsx
//
// Teacher instance layer, Phase 3c — what a logged-in teacher sees after the
// combined login. Lists the classrooms they own; from each they can open
// Classroom Setup (edit their board) or start a game bound to that classroom.

import React, { useCallback, useEffect, useState } from 'react';
import { listMyClassrooms, type ClassroomMeta } from './classroomAdminApi';
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
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{c.displayName || c.id}</div>
            <div style={styles.muted}>{c.id}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button type="button" onClick={() => setOpenSetup({ id: c.id, name: c.displayName || c.id })} style={styles.secondaryBtn}>
              🏫 Classroom Setup
            </button>
            <button type="button" onClick={() => onStartGame(c.id)} style={styles.primaryBtn}>
              🎮 Start a game
            </button>
          </div>
        </div>
      ))}

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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    padding: '0.75rem 1rem', border: `1px solid ${colors.secondary.light}`, borderRadius: '10px',
    backgroundColor: 'white', flexWrap: 'wrap',
  },
  muted: { color: colors.secondary.main, fontSize: '0.85rem' },
  error: { color: '#7f1d1d', backgroundColor: '#fef2f2', border: '1px solid #dc3545', borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' },
  primaryBtn: {
    padding: '0.5rem 0.9rem', backgroundColor: colors.primary.main, color: 'white', border: 'none',
    borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  secondaryBtn: {
    padding: '0.5rem 0.9rem', backgroundColor: colors.secondary.light, color: colors.secondary.main,
    border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
  },
  logoutBtn: {
    padding: '0.4rem 0.8rem', backgroundColor: 'transparent', color: colors.secondary.main,
    border: `1px solid ${colors.secondary.main}`, borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem',
  },
};
