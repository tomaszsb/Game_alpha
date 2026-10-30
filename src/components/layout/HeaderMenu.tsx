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

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/** How tall the open menu may be so all of it fits on the screen that can be seen right now (`scale` = how much the page is shrunk or grown). */
export function menuFitHeight(top: number, visibleHeight: number, scale = 1): number {
  return Math.max(60, (visibleHeight - top - 8) / (scale > 0 ? scale : 1));
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

  // An open menu closes on a click or tap anywhere outside it, on Esc, or on its own ✕ (Tom, 2026-10-12:
  // "once i open the menu i see no way to close it").
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setShowRoles(false); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setShowRoles(false); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // The menu always fits what can be seen, measured when it opens and whenever that changes: going in and out of full
  // screen brings a browser's own frames back (Tom's TV test, 2026-10-30: "the menu no longer fits").
  const listRef = useRef<HTMLDivElement>(null);
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    const fit = () => {
      const el = listRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setFitHeight(menuFitHeight(r.top, window.visualViewport?.height ?? window.innerHeight, el.offsetHeight ? r.height / el.offsetHeight : 1));
    };
    fit();
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      document.removeEventListener('fullscreenchange', fit);
    };
  }, [open]);

  const href = window.location.href;
  const hasPlayer = !!(new URL(href).searchParams.get('p') || new URL(href).searchParams.get('playerId'));
  const roles: DeviceRole[] = hasPlayer ? ['pc', 'tv', 'phone'] : ['pc', 'tv'];
  const current = currentRoleOf(href);
  const pickRole = (role: DeviceRole) => goToRole(role, href);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
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
          ref={listRef}
          role="menu"
          data-testid="header-menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, zIndex: 1100, minWidth: 250, maxHeight: fitHeight ?? '80vh', overflowY: 'auto', boxSizing: 'border-box',
            padding: 6, background: '#fff', borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column',
          }}
        >
          <button
            type="button"
            data-testid="header-menu-close"
            aria-label="Close menu"
            title="Close"
            onClick={close}
            style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', fontSize: '1.1rem', lineHeight: 1, padding: '4px 8px', cursor: 'pointer', color: '#475569' }}
          >
            ✕
          </button>
          {/* First, so it can always be reached once the browser's frames come back. */}
          <button type="button" role="menuitem" data-testid="fullscreen-toggle" style={item} onClick={() => { toggleFullscreen(); close(); }}>
            ⛶ {isFullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
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
        </div>
      )}
    </div>
  );
}
