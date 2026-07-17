// src/components/setup/AdminToolsPanel.tsx

import React from 'react';
import { colors } from '../../styles/theme';
import { getBackendURL } from '../../utils/networkDetection';
import { getTeacherSession } from '../../utils/teacherAuth';
import { TeacherClassroomPanel } from '../classroom/TeacherClassroomPanel';
import { styles } from './PlayerSetup.styles';
import { useAdminAuth } from './useAdminAuth';
import { AdminGameManager } from './AdminGameManager';

interface AdminToolsPanelProps {
  /** Needed by handleStartClassroomGame's URL mode param. */
  selectedMode: 'pc' | 'tv';
  onOpenDataEditor: () => void;
  onOpenBugReports: () => void;
  onOpenBoardLayoutEditor: () => void;
  onOpenClassroomSetup: () => void;
  onOpenClassroomAdmin: () => void;
}

/**
 * "Admin Tools" / "My Classrooms" settings-drawer section: teacher-panel,
 * unlocked-admin-toolbar, or login-prompt, depending on auth state.
 */
export function AdminToolsPanel({
  selectedMode,
  onOpenDataEditor,
  onOpenBugReports,
  onOpenBoardLayoutEditor,
  onOpenClassroomSetup,
  onOpenClassroomAdmin,
}: AdminToolsPanelProps): JSX.Element {
  const {
    isAdminUnlocked,
    showAdminPrompt,
    setShowAdminPrompt,
    adminPassword,
    setAdminPassword,
    adminError,
    setAdminError,
    adminVerifying,
    loginUsername,
    setLoginUsername,
    teacherAccount,
    setTeacherAccount,
    handleLogin,
    handleLock,
  } = useAdminAuth();

  /**
   * Start a new game bound to a teacher's classroom: create it with the
   * instanceId (server authorizes via the teacher session), then navigate to
   * it carrying ?i= so the client loads that classroom's board.
   */
  const handleStartClassroomGame = async (instanceId: string) => {
    try {
      const backendURL = getBackendURL();
      const response = await fetch(`${backendURL}/api/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getTeacherSession() ? { 'x-teacher-session': getTeacherSession() as string } : {}),
        },
        body: JSON.stringify({ instanceId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        alert(`Could not start a game: ${data.error || `server returned ${response.status}`}`);
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('g', data.gameId);
      url.searchParams.set('token', data.token);
      if (instanceId && instanceId !== 'classroom-1') url.searchParams.set('i', instanceId);
      else url.searchParams.delete('i');
      if (selectedMode === 'tv') url.searchParams.set('mode', 'tv');
      window.location.href = url.toString();
    } catch (err) {
      alert(`Could not start a game: ${err instanceof Error ? err.message : 'network error'}`);
    }
  };

  return (
    <div style={styles.settingsBlock}>
      <h3 style={styles.sectionTitleSmall}>
        {teacherAccount ? '👩‍🏫 My Classrooms' : '🛠️ Admin Tools'}
      </h3>

      {teacherAccount ? (
        <TeacherClassroomPanel
          onStartGame={handleStartClassroomGame}
          onLoggedOut={() => setTeacherAccount(null)}
        />
      ) : isAdminUnlocked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onOpenDataEditor}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: colors.secondary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              ⚙️ Space Data Editor
            </button>
            <button
              type="button"
              onClick={onOpenBoardLayoutEditor}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: colors.secondary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Drag tiles to set their positions on the board. Applies to every future game."
            >
              🗺️ Edit Board Layout
            </button>
            <button
              type="button"
              onClick={onOpenClassroomSetup}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: colors.secondary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Browse the deck of spaces: switch cards on/off, make your own copies. Applies to every future game."
            >
              🏫 Classroom Setup
            </button>
            <button
              type="button"
              onClick={onOpenClassroomAdmin}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: colors.secondary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Create teacher accounts and classrooms, and assign owners."
            >
              👥 Manage Classrooms &amp; Teachers
            </button>
            <button
              type="button"
              onClick={onOpenBugReports}
              style={{
                padding: '0.6rem 1rem',
                backgroundColor: colors.secondary.main,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              🐛 Bug Reports
            </button>
            <button
              type="button"
              onClick={handleLock}
              style={{
                padding: '0.4rem 0.75rem',
                backgroundColor: 'transparent',
                color: colors.secondary.main,
                border: `1px solid ${colors.secondary.light}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              🔓 Lock
            </button>
          </div>

          <AdminGameManager />
        </div>
      ) : showAdminPrompt ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Teacher username (blank = admin)"
            value={loginUsername}
            onChange={(e) => { setLoginUsername(e.target.value); setAdminError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoFocus
            autoComplete="username"
            style={{
              padding: '0.5rem 0.75rem',
              border: `2px solid ${adminError ? '#dc3545' : colors.secondary.light}`,
              borderRadius: '6px',
              fontSize: '0.9rem',
              width: '220px'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={adminPassword}
            onChange={(e) => { setAdminPassword(e.target.value); setAdminError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoComplete="current-password"
            style={{
              padding: '0.5rem 0.75rem',
              border: `2px solid ${adminError ? '#dc3545' : colors.secondary.light}`,
              borderRadius: '6px',
              fontSize: '0.9rem',
              width: '160px'
            }}
          />
          <button
            type="button"
            onClick={handleLogin}
            disabled={adminVerifying}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: colors.primary.main,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: adminVerifying ? 'wait' : 'pointer',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}
          >
            {adminVerifying ? '...' : 'Log in'}
          </button>
          <button
            type="button"
            onClick={() => { setShowAdminPrompt(false); setAdminPassword(''); setLoginUsername(''); setAdminError(''); }}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'transparent',
              color: colors.secondary.main,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            Cancel
          </button>
          {adminError && (
            <span style={{ color: '#dc3545', fontSize: '0.8rem', width: '100%' }}>{adminError}</span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdminPrompt(true)}
          style={{
            padding: '0.6rem 1rem',
            backgroundColor: colors.secondary.light,
            color: colors.secondary.main,
            border: `1px solid ${colors.secondary.main}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          🔑 Log in (admin or teacher)
        </button>
      )}
    </div>
  );
}
