// src/components/player/ProjectMat.tsx
// The player's mat: one round icon per milestone (TROPHIES.csv `mat` rows), filling in as the project moves. Each
// icon is the picture of the building its step belongs to (TOWN.csv `mat_icon` rows; Tom, 2026-10-13: "use the same
// icons on the buildings"). Done = green with a check; part way = orange with its percent; not yet = faded and dashed.
// Tap an icon to read its name and state (a floating label, so it adds no height).
import React, { useState } from 'react';
import type { PanelPalette } from './panelTheme';
import type { MatTileState } from '../../utils/projectMat';
import { getUIString } from '../../constants/uiStrings';

const PARTIAL = '#f59e0b';

/** How a step reads in words: its name, with the percent when it is part way, then where it stands. */
export function matTileText(t: MatTileState): string {
  const name = t.percent !== undefined ? `${t.label} ${t.percent}%` : t.label;
  const state = t.done ? getUIString('MAT.done') : t.trouble === 'denied' ? getUIString('MAT.denied') : t.trouble === 'objection' ? getUIString('MAT.objection') : t.percent !== undefined ? getUIString('MAT.part') : getUIString('MAT.notyet');
  return `${name}: ${state}`;
}

export type RenderMatIcon = (tileId: string, size: number) => React.ReactNode;

interface RowProps {
  tiles: MatTileState[];
  palette: PanelPalette;
  size: number;
  renderIcon?: RenderMatIcon;
  testId?: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** Spread the icons across the whole row (the clipboard) instead of packing them (a phone header). */
  spread?: boolean;
}

function MatIconRow({ tiles, palette: p, size, renderIcon, selected, onSelect, spread }: RowProps): JSX.Element {
  return (
    <>
      {tiles.map(t => {
        const partial = t.percent !== undefined;
        const trouble = !t.done ? t.trouble : undefined;
        const colour = t.done ? p.good : trouble === 'denied' ? p.bad : trouble === 'objection' ? PARTIAL : partial ? PARTIAL : p.border;
        const icon = renderIcon?.(t.id, Math.round(size * 0.68));
        return (
          <button
            key={t.id}
            type="button"
            data-testid={`mat-tile-${t.id}`}
            data-done={String(t.done)}
            data-percent={t.percent}
            data-trouble={trouble}
            aria-label={matTileText(t)}
            aria-pressed={selected === t.id}
            title={matTileText(t)}
            onClick={() => onSelect(selected === t.id ? null : t.id)}
            style={{
              position: 'relative', width: size, height: size, padding: 0, flex: 'none', cursor: 'pointer', boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: Math.round(size * 0.5),
              background: t.done ? p.goodSurf : trouble === 'denied' ? p.badSurf : trouble === 'objection' || partial ? p.warnSurf : 'transparent',
              border: `2px ${t.done || partial || trouble ? 'solid' : 'dashed'} ${colour}`,
              color: p.muted, opacity: t.done || partial || trouble ? 1 : 0.5,
              marginRight: spread ? 0 : undefined,
            }}
          >
            {icon ?? <span aria-hidden>{t.done ? '✓' : '○'}</span>}
            {t.done && size >= 24 && (
              <span aria-hidden style={{ position: 'absolute', right: -4, bottom: -4, width: 12, height: 12, borderRadius: '50%', background: p.good, color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center' }}>✓</span>
            )}
            {trouble && size >= 24 && (
              <span aria-hidden style={{ position: 'absolute', right: -4, bottom: -4, width: 12, height: 12, borderRadius: '50%', background: trouble === 'denied' ? p.bad : PARTIAL, color: '#fff', fontSize: 9, lineHeight: '12px', textAlign: 'center' }}>{trouble === 'denied' ? '✗' : '!'}</span>
            )}
            {partial && size >= 24 && (
              <span aria-hidden style={{ position: 'absolute', right: -9, bottom: -6, padding: '0 3px', borderRadius: 6, background: PARTIAL, color: '#1a202c', fontSize: 9, lineHeight: '12px' }}>{t.percent}%</span>
            )}
          </button>
        );
      })}
    </>
  );
}

function Caption({ tile, palette: p }: { tile: MatTileState | undefined; palette: PanelPalette }): JSX.Element | null {
  if (!tile) return null;
  return (
    <div
      role="status"
      data-testid="mat-caption"
      style={{
        position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2, zIndex: 5, textAlign: 'center', fontSize: 11.5, fontWeight: 600,
        background: p.bg, color: p.text, border: `1px solid ${p.borderStrong}`, borderRadius: 7, padding: '3px 6px', pointerEvents: 'none',
      }}
    >
      {matTileText(tile)}
    </div>
  );
}

export function ProjectMat({ tiles, palette: p, renderIcon }: { tiles: MatTileState[]; palette: PanelPalette; renderIcon?: RenderMatIcon }): JSX.Element | null {
  const [selected, setSelected] = useState<string | null>(null);
  if (tiles.length === 0) return null;
  const done = tiles.filter(t => t.done).length;
  return (
    <div data-testid="project-mat" data-done={done} data-total={tiles.length} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: p.muted, marginBottom: 4 }}>
        <span>{getUIString('MAT.title')}</span>
        <span>{done} of {tiles.length}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <MatIconRow tiles={tiles} palette={p} size={32} renderIcon={renderIcon} selected={selected} onSelect={setSelected} spread />
      </div>
      <Caption tile={tiles.find(t => t.id === selected)} palette={p} />
    </div>
  );
}

/** The mat squeezed to one row of small icons (no extra height) for the phone header. */
export function MatDots({ tiles, palette: p, renderIcon }: { tiles: MatTileState[]; palette: PanelPalette; renderIcon?: RenderMatIcon }): JSX.Element | null {
  const [selected, setSelected] = useState<string | null>(null);
  if (tiles.length === 0) return null;
  const done = tiles.filter(t => t.done).length;
  return (
    <div style={{ position: 'relative', flexShrink: 0, margin: '-3px 0' }}>
      <div
        data-testid="project-mat-dots"
        data-done={done}
        data-total={tiles.length}
        title={`${getUIString('MAT.title')}: ${tiles.map(matTileText).join(', ')}`}
        aria-label={`${getUIString('MAT.title')}: ${done} of ${tiles.length} steps done`}
        style={{ display: 'flex', alignItems: 'center', gap: 3 }}
      >
        <MatIconRow tiles={tiles} palette={p} size={22} renderIcon={renderIcon} selected={selected} onSelect={setSelected} />
      </div>
      <Caption tile={tiles.find(t => t.id === selected)} palette={p} />
    </div>
  );
}
