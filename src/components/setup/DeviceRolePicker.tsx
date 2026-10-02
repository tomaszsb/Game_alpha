// src/components/setup/DeviceRolePicker.tsx
//
// "How are you using this screen?" - shown once when a personal player link opens on a
// screen the game can't be sure about (see utils/deviceRole.ts). Pure UI: it doesn't touch
// storage or the address bar; the gate that renders it does.

import React from 'react';
import { colors } from '../../styles/theme';
import { DEVICE_ROLE } from '../../constants/uiStrings';
import type { DeviceRole } from '../../utils/deviceRole';

const ROLES: DeviceRole[] = ['pc', 'tv', 'phone'];
const EMOJI: Record<DeviceRole, string> = { pc: '🖥️', tv: '📺', phone: '📱' };

export function DeviceRolePicker({ suggested, onPick }: { suggested: DeviceRole; onPick: (role: DeviceRole) => void }): JSX.Element {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={DEVICE_ROLE.TITLE}
      data-testid="device-role-picker"
      style={{
        minHeight: '100vh', boxSizing: 'border-box', padding: '1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)',
      }}
    >
      <div style={{ background: 'white', borderRadius: 16, padding: '1.5rem', maxWidth: 520, width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', color: colors.secondary.dark }}>{DEVICE_ROLE.TITLE}</h1>
        <p style={{ margin: '0.4rem 0 1rem', color: colors.text.secondary, fontSize: '0.9rem', lineHeight: 1.4 }}>{DEVICE_ROLE.SUBTITLE}</p>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              data-testid={`device-role-${role}`}
              onClick={() => onPick(role)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '0.8rem 1rem', borderRadius: 12,
                border: `2px solid ${role === suggested ? colors.primary.main : colors.secondary.border}`,
                background: 'white', color: colors.text.primary, font: 'inherit',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                <span aria-hidden>{EMOJI[role]} </span>{DEVICE_ROLE.label(role)}
                {role === suggested && (
                  <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 700, color: 'white', background: colors.primary.main, borderRadius: 6, padding: '2px 6px', verticalAlign: 'middle' }}>
                    {DEVICE_ROLE.SUGGESTED}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 2, color: colors.text.secondary, fontSize: '0.85rem' }}>{DEVICE_ROLE.hint(role)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
