// src/pages/AdminStatsPage.tsx
// Bookmarkable /admin/stats route. Rendered as its own React root from
// main.tsx (before <App/> ever mounts) so visiting this URL never triggers
// App.tsx's auto-create-a-new-game behavior — same reasoning as the
// /challenge playtester landing page (see main.tsx).
//
// Reuses the existing admin-password session (sessionStorage, adminAuth.ts):
// an admin who already unlocked Admin Tools in this tab skips straight to
// the dashboard; a fresh bookmark visit gets a password prompt first.

import React, { useState } from 'react';
import { colors } from '../styles/theme';
import { isAdminAuthenticated, verifyAdminPassword } from '../utils/adminAuth';
import { StatsDashboard } from '../components/admin/StatsDashboard';

export function AdminStatsPage(): JSX.Element {
  const [unlocked, setUnlocked] = useState(() => isAdminAuthenticated());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleLogin = async () => {
    if (!password.trim()) return;
    setVerifying(true);
    setError('');
    try {
      const success = await verifyAdminPassword(password);
      if (success) {
        setUnlocked(true);
        setPassword('');
      } else {
        setError('Incorrect password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
    } finally {
      setVerifying(false);
    }
  };

  if (!unlocked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: colors.background.secondary, padding: '1rem',
      }}>
        <div style={{
          background: colors.background.paper, border: `1px solid ${colors.border.primary}`,
          borderRadius: 12, padding: '1.5rem', maxWidth: 320, width: '100%',
        }}>
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>🔑 Admin Stats</h2>
          <p style={{ fontSize: '0.85rem', color: colors.text.secondary }}>Enter the admin password to view the stats dashboard.</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoFocus
            autoComplete="current-password"
            style={{
              width: '100%', padding: '0.6rem 0.75rem', boxSizing: 'border-box',
              border: `2px solid ${error ? colors.danger.main : colors.border.primary}`,
              borderRadius: 6, fontSize: '0.95rem', marginBottom: '0.75rem',
            }}
          />
          <button
            type="button"
            onClick={handleLogin}
            disabled={verifying}
            style={{
              width: '100%', padding: '0.6rem', background: colors.primary.main, color: 'white',
              border: 'none', borderRadius: 6, cursor: verifying ? 'wait' : 'pointer', fontWeight: 500,
            }}
          >
            {verifying ? 'Checking…' : 'Log in'}
          </button>
          {error && <div style={{ color: colors.danger.text, fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background.secondary }}>
      <StatsDashboard />
    </div>
  );
}
