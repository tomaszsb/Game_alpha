// TownViewPad - the town board's one small control plate (TIME_ON_BOARD_DESIGN.md, step 1): four arrows round a
// middle "fit" button, zoom + and - on the side. It replaces React Flow's stock column of seven buttons.
// PC: always out. Remote strip: folds to one small "View" button that opens the plate (the strip is small).
// TV: not drawn at all (nobody touches it; the remote's arrow keys still pan). Nothing else on the board changes.
import React, { useState } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { scaleMs } from '../../utils/gameSpeed';

export type ViewPadScreen = 'pc' | 'tv' | 'remote';

const PAN = 120;
const BTN = 24;

export function TownViewPad({ screen, dark }: { screen: ViewPadScreen; dark: boolean }): JSX.Element | null {
  const { zoomIn, zoomOut, fitView, getViewport, setViewport } = useReactFlow();
  const [open, setOpen] = useState(false);
  if (screen === 'tv') return null;

  const panBy = (dx: number, dy: number) => {
    const v = getViewport();
    setViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom }, { duration: scaleMs(150) });
  };
  const ink = dark ? '#e2e8f0' : '#1f2937';
  const plate: React.CSSProperties = {
    background: dark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.94)', border: `1px solid ${dark ? '#475569' : '#9ca3af'}`,
    borderRadius: 8, padding: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  };
  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: BTN, height: BTN, padding: 0, border: 'none', borderRadius: 5, background: 'transparent', color: ink,
    fontSize: 15, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', ...extra,
  });
  const fit = () => { try { fitView({ padding: 0.06, duration: scaleMs(250) }); } catch { /* not measured yet */ } };

  if (screen === 'remote' && !open) {
    return (
      <Panel position="bottom-left" style={{ margin: 6 }}>
        <button type="button" data-testid="view-pad-open" aria-label="Show view buttons" title="View" onClick={() => setOpen(true)} style={{ ...plate, color: ink, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '3px 8px' }}>
          View
        </button>
      </Panel>
    );
  }

  return (
    <Panel position="bottom-left" style={{ margin: 6 }}>
      <div data-testid="view-pad" style={{ ...plate, display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${BTN}px)`, gridTemplateRows: `repeat(3, ${BTN}px)` }}>
          <button type="button" data-testid="view-up" title="Pan up" aria-label="Pan up" onClick={() => panBy(0, PAN)} style={btn({ gridColumn: 2, gridRow: 1 })}>↑</button>
          <button type="button" data-testid="view-left" title="Pan left" aria-label="Pan left" onClick={() => panBy(PAN, 0)} style={btn({ gridColumn: 1, gridRow: 2 })}>←</button>
          <button type="button" data-testid="view-fit" title="Fit the whole town" aria-label="Fit the whole town" onClick={fit} style={btn({ gridColumn: 2, gridRow: 2, fontSize: 13, border: `1px solid ${dark ? '#64748b' : '#9ca3af'}` })}>◻</button>
          <button type="button" data-testid="view-right" title="Pan right" aria-label="Pan right" onClick={() => panBy(-PAN, 0)} style={btn({ gridColumn: 3, gridRow: 2 })}>→</button>
          <button type="button" data-testid="view-down" title="Pan down" aria-label="Pan down" onClick={() => panBy(0, -PAN)} style={btn({ gridColumn: 2, gridRow: 3 })}>↓</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button type="button" data-testid="view-zoom-in" title="Zoom in" aria-label="Zoom in" onClick={() => zoomIn({ duration: scaleMs(150) })} style={btn({ fontSize: 18 })}>+</button>
          <button type="button" data-testid="view-zoom-out" title="Zoom out" aria-label="Zoom out" onClick={() => zoomOut({ duration: scaleMs(150) })} style={btn({ fontSize: 18 })}>−</button>
          {screen === 'remote' && (
            <button type="button" data-testid="view-pad-close" title="Hide" aria-label="Hide view buttons" onClick={() => setOpen(false)} style={btn({ fontSize: 12 })}>✕</button>
          )}
        </div>
      </div>
    </Panel>
  );
}
