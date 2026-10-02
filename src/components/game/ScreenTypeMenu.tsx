// src/components/game/ScreenTypeMenu.tsx
//
// The in-game way to change what THIS screen is (PC / TV / phone) - Tom, 2026-10-02: the
// "How are you using this screen?" question (utils/deviceRole.ts) must be fixable from inside
// a running game if someone picked wrong, without hunting for the setup gear. Replaces the
// old header "TV" toggle, which only flipped ?mode=tv and could strand a player's link.
//
// Picking a role remembers it on this device (unless remembering is switched off) and reloads
// the link rewritten for that role. A screen with no personal player link (the host) is only
// offered PC and TV - "phone" means "controls for one player".

import React, { useState } from 'react';
import { DEVICE_ROLE } from '../../constants/uiStrings';
import { roleUrl, setStoredDeviceRole, DeviceRole } from '../../utils/deviceRole';

interface ScreenTypeMenuProps {
  /** Look of the header button, so it matches its neighbours. */
  buttonStyle: React.CSSProperties;
  showLabel: boolean;
}

const EMOJI: Record<DeviceRole, string> = { pc: '🖥️', tv: '📺', phone: '📱' };

/** The role this link is currently set up as. */
export function currentRoleOf(href: string): DeviceRole | null {
  const url = new URL(href);
  const role = url.searchParams.get('role');
  if (role === 'pc' || role === 'tv' || role === 'phone') return role;
  const hasPlayer = !!(url.searchParams.get('p') || url.searchParams.get('playerId'));
  if (url.searchParams.get('mode') === 'tv') return 'tv';
  return hasPlayer ? 'phone' : 'pc';
}

export function ScreenTypeMenu({ buttonStyle, showLabel }: ScreenTypeMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const href = window.location.href;
  const hasPlayer = !!(new URL(href).searchParams.get('p') || new URL(href).searchParams.get('playerId'));
  const roles: DeviceRole[] = hasPlayer ? ['pc', 'tv', 'phone'] : ['pc', 'tv'];
  const current = currentRoleOf(href);

  const pick = (role: DeviceRole) => {
    setStoredDeviceRole(role);
    window.location.href = roleUrl(role, href);
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        data-testid="screen-type-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="What is this screen? (PC, TV or phone)"
        onClick={() => setOpen((o) => !o)}
        style={buttonStyle}
      >
        <span aria-hidden>🖥️</span>
        <span style={{ display: showLabel ? 'inline' : 'none' }}>Screen</span>
      </button>
      {open && (
        <div
          role="menu"
          data-testid="screen-type-menu"
          style={{
            position: 'absolute', top: '110%', right: 0, zIndex: 50, minWidth: 250,
            background: 'white', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: 6, textAlign: 'left',
          }}
        >
          {roles.map((role) => (
            <button
              key={role}
              type="button"
              role="menuitemradio"
              aria-checked={role === current}
              data-testid={`screen-type-${role}`}
              onClick={() => pick(role)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '7px 9px',
                borderRadius: 7, border: 'none', background: role === current ? '#e0f2fe' : 'transparent',
                color: '#1e293b', font: 'inherit', fontSize: 12,
              }}
            >
              <strong>{EMOJI[role]} {DEVICE_ROLE.label(role)}{role === current ? '  ✓' : ''}</strong>
              <div style={{ fontWeight: 400, color: '#475569', marginTop: 1 }}>{DEVICE_ROLE.hint(role)}</div>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
