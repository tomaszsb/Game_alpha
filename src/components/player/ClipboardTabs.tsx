// ClipboardTabs - the page tabs on the clipboard's right edge, on the panel and on every open page (Tom, 2026-10-13, fb:4e8a8550: "lean into the clipboard look ... tabs on the paper's right side"). Money, Time,
// Expeditors and Scope open the pages their boxes already open; Life events opens the life-event cards. The tabs are
// small icon buttons so they cost no height on a phone.
import React from 'react';
import type { PanelPalette } from './panelTheme';
import { NUMBERS } from '../../constants/uiStrings';

export type PanelPageId = 'money' | 'time' | 'expeditors' | 'scope' | 'life';

export const PAGE_TABS: Array<{ id: PanelPageId; icon: string; label: () => string }> = [
  { id: 'money', icon: '💰', label: () => NUMBERS.TILE_MONEY },
  { id: 'time', icon: '🕐', label: () => NUMBERS.TILE_TIME },
  { id: 'expeditors', icon: '⚡', label: () => NUMBERS.TILE_EXPEDITORS },
  { id: 'scope', icon: '🏢', label: () => NUMBERS.TILE_SCOPE },
  { id: 'life', icon: '📰', label: () => NUMBERS.TILE_LIFE },
];

interface TabsProps {
  active: PanelPageId | null;
  onSelect: (id: PanelPageId) => void;
  palette: PanelPalette;
}

/** The strip down the clipboard's right edge: placed absolutely, so it takes no layout space. */
export function ClipboardTabs({ active, onSelect, palette: p }: TabsProps): JSX.Element {
  return (
    <div data-testid="clipboard-tabs" style={{ position: 'absolute', right: 1, top: 6, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 1 }}>
      {PAGE_TABS.map(t => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            data-testid={`clipboard-tab-${t.id}`}
            data-active={on ? 'true' : 'false'}
            aria-label={t.label()}
            aria-pressed={on}
            title={t.label()}
            onClick={() => onSelect(t.id)}
            style={{
              width: on ? 30 : 26, height: 29, padding: 0, cursor: 'pointer', fontSize: 14, lineHeight: 1,
              background: on ? p.bg : p.surf2, color: p.text,
              border: `${on ? 2 : 1}px solid ${on ? p.text : p.borderStrong}`, borderLeft: 'none',
              borderRadius: '0 7px 7px 0', marginLeft: on ? -4 : 0,
            }}
          >
            <span aria-hidden>{t.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
