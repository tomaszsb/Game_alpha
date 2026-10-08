// src/components/layout/HeaderMenu.tsx
//
// THE header menu - one component for the PC, the TV and the remote screen, open bar and minimised bar
// alike (Tom, 2026-10-08: "all versions tv pc remote should always strive to look identical ... buttons when
// open should look identical and when closed should look identical, and we want as much of the space as
// possible used for the game, so menus hiding are preferable").
//
// Every screen shows ONE "Menu" button; everything else lives inside it, in the same order with the same
// words. A screen lists only what it can do (the TV has no Glossary, a PC has no "Connect Phone" yet), but
// what it lists looks and reads the same everywhere. The always-there items (adjust screen size, what kind
// of screen this is, full screen) are built in so no screen can forget or reword them.

import React, { useEffect, useState } from 'react';
import { ScreenSizeControl } from './ScreenSizeControl';
import { DEVICE_ROLE } from '../../constants/uiStrings';
import { roleUrl, setStoredDeviceRole, DeviceRole } from '../../utils/deviceRole';
import { currentRoleOf } from '../game/ScreenTypeMenu';

export interface HeaderMenuItem {
  id: string;
  icon: string;
  label: string;
  onSelect: () => void;
  /** Shows a tick / "(showing)" for an item that opens a panel which is open now. */
  active?: boolean;
  /** A switch (Speed): flips in place and the menu stays open. */
  stayOpen?: boolean;
  testId?: string;
  title?: string;
}

export interface HeaderMenuProps {
  items: HeaderMenuItem[];
  /** The look of the Menu button (size differs per screen; colours are the family look). */
  buttonStyle: React.CSSProperties;
  /** Which side the list opens towards. */
  align?: 'left' | 'right';
  /** Runs when the screen-size panel opens (the TV lobby stops its first-use pulse). */
  onOpenScreenSize?: () => void;
  /** Extra look for the screen-size item while it should pulse. */
  screenSizeStyle?: React.CSSProperties;
  /** Icon only (the narrow bar); the list inside is the same either way. */
  iconOnly?: boolean;
}

const ROLE_EMOJI: Record<DeviceRole, string> = { pc: '🖥️', tv: '📺', phone: '📱' };

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

/** Switch this screen to another kind: remember it, then reload the link written for that kind. */
function goToRole(role: DeviceRole, href: string): void {
  setStoredDeviceRole(role);
  window.location.assign(roleUrl(role, href));
}

export function HeaderMenu({ items, buttonStyle, align = 'right', onOpenScreenSize, screenSizeStyle, iconOnly }: HeaderMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const item: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '9px 13px', fontSize: '0.95rem', fontWeight: 600,
    background: 'transparent', color: '#1a202c', border: 'none', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  };
  const close = () => { setOpen(false); setShowRoles(false); };

  const href = window.location.href;
  const hasPlayer = !!(new URL(href).searchParams.get('p') || new URL(href).searchParams.get('playerId'));
  const roles: DeviceRole[] = hasPlayer ? ['pc', 'tv', 'phone'] : ['pc', 'tv'];
  const current = currentRoleOf(href);
  const pickRole = (role: DeviceRole) => goToRole(role, href);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        data-testid="header-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => { setOpen(o => !o); setShowRoles(false); }}
        style={{ ...buttonStyle, backgroundColor: open ? 'rgba(255,255,255,0.4)' : buttonStyle.backgroundColor }}
      >
        ☰{iconOnly ? '' : ' Menu'}
      </button>
      {open && (
        <div
          role="menu"
          data-testid="header-menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 1100, minWidth: 250, maxHeight: '80vh', overflowY: 'auto',
            padding: 6, background: '#fff', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column',
          }}
        >
          {items.map(it => (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              data-testid={it.testId}
              title={it.title}
              style={item}
              onClick={() => { it.onSelect(); if (!it.stayOpen) close(); }}
            >
              {it.icon} {it.label}{it.active ? ' (showing)' : ''}
            </button>
          ))}
          <ScreenSizeControl
            onOpen={onOpenScreenSize}
            style={{ ...item, ...(screenSizeStyle ?? {}) }}
          />
          <button
            type="button"
            role="menuitem"
            data-testid="screen-type-button"
            aria-expanded={showRoles}
            title="What is this screen? (PC, TV or phone)"
            style={item}
            onClick={() => setShowRoles(s => !s)}
          >
            {ROLE_EMOJI[current ?? 'pc']} This screen is a {current ?? 'pc'} {showRoles ? '▾' : '▸'}
          </button>
          {showRoles && roles.map(role => (
            <button
              key={role}
              type="button"
              role="menuitemradio"
              aria-checked={role === current}
              data-testid={`screen-type-${role}`}
              onClick={() => pickRole(role)}
              style={{ ...item, paddingLeft: 30, fontSize: '0.85rem', background: role === current ? '#e0f2fe' : 'transparent' }}
            >
              <strong>{ROLE_EMOJI[role]} {DEVICE_ROLE.label(role)}{role === current ? '  ✓' : ''}</strong>
              <div style={{ fontWeight: 400, color: '#475569', marginTop: 1, whiteSpace: 'normal' }}>{DEVICE_ROLE.hint(role)}</div>
            </button>
          ))}
          <button type="button" role="menuitem" data-testid="fullscreen-toggle" style={item} onClick={() => { toggleFullscreen(); close(); }}>
            ⛶ {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      )}
    </div>
  );
}
