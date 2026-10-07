// src/components/player/ProjectMat.tsx
// The player's mat: one tile per milestone (TROPHIES.csv `mat` rows), filling in as the project moves.
import React from 'react';
import type { PanelPalette } from './panelTheme';
import type { MatTileState } from '../../utils/projectMat';

export function ProjectMat({ tiles, palette: p }: { tiles: MatTileState[]; palette: PanelPalette }): JSX.Element | null {
  if (tiles.length === 0) return null;
  const done = tiles.filter(t => t.done).length;
  return (
    <div data-testid="project-mat" data-done={done} data-total={tiles.length}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: p.muted, marginBottom: 4 }}>
        <span>My project</span>
        <span>{done} of {tiles.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 5 }}>
        {tiles.map(t => (
          <div
            key={t.id}
            data-testid={`mat-tile-${t.id}`}
            data-done={String(t.done)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.2,
              background: t.done ? p.goodSurf : 'transparent',
              border: `1px ${t.done ? 'solid' : 'dashed'} ${t.done ? p.goodBorder : p.border}`,
              color: t.done ? p.good : p.muted, fontWeight: t.done ? 600 : 400,
            }}
          >
            <span aria-hidden style={{ fontSize: 13 }}>{t.done ? '✓' : '○'}</span>
            <span>{t.label}</span>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t.done ? ' (done)' : ' (not yet)'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The mat squeezed to one row of dots (no extra height) for the phone header. */
export function MatDots({ tiles, palette: p }: { tiles: MatTileState[]; palette: PanelPalette }): JSX.Element | null {
  if (tiles.length === 0) return null;
  const done = tiles.filter(t => t.done).length;
  return (
    <div
      data-testid="project-mat-dots"
      data-done={done}
      data-total={tiles.length}
      title={`My project: ${tiles.map(t => `${t.label} ${t.done ? '✓' : '○'}`).join(', ')}`}
      aria-label={`My project: ${done} of ${tiles.length} steps done`}
      style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
    >
      {tiles.map(t => (
        <span key={t.id} aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: t.done ? p.good : 'transparent', border: `1.5px solid ${t.done ? p.good : p.border}` }} />
      ))}
    </div>
  );
}
