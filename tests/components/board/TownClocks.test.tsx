// The town clocks: pinned to the top of the visible part of each band, shuffle only on change, slim on the remote strip.
import React from 'react';
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { FlipClock, TownClocks, bandSpans, pinClock, useShuffledText } from '../../../src/components/board/TownClocks';
import { clockDate } from '../../../src/utils/gameClock';

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class { m22 = 1; constructor() {} };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const span = { x: 100, top: 0, bottom: 400 };
describe('pinClock', () => {
  it('sits at the cut line when the band top is on screen', () => {
    const p = pinClock(span, { x: 0, y: 50, zoom: 1 }, { w: 800, h: 600 }, 120)!;
    expect(p.sy).toBe(56);
    expect(p.sx).toBe(100);
  });
  it('sticks to the top edge of the screen when the band top has scrolled off', () => {
    expect(pinClock(span, { x: 0, y: -200, zoom: 1 }, { w: 800, h: 600 }, 120)!.sy).toBe(6);
  });
  it('hides when under 60px of the band is on screen', () => {
    expect(pinClock(span, { x: 0, y: -350, zoom: 1 }, { w: 800, h: 600 }, 120)).toBeNull();
    expect(pinClock(span, { x: 0, y: 580, zoom: 1 }, { w: 800, h: 600 }, 120)).toBeNull();
  });
  it('keeps the clock of a small band that is fully on screen (4 players at fit zoom)', () => {
    expect(pinClock({ x: 100, top: 0, bottom: 40 }, { x: 0, y: 10, zoom: 1 }, { w: 800, h: 600 }, 120)).not.toBeNull();
    expect(pinClock({ x: 100, top: 0, bottom: 40 }, { x: 0, y: -30, zoom: 1 }, { w: 800, h: 600 }, 120)).toBeNull();
  });
  it('keeps the whole clock on screen sideways', () => {
    expect(pinClock(span, { x: -300, y: 0, zoom: 1 }, { w: 800, h: 600 }, 120)!.sx).toBe(66);
    expect(pinClock(span, { x: 900, y: 0, zoom: 1 }, { w: 800, h: 600 }, 120)!.sx).toBe(734);
  });
});

describe('bandSpans', () => {
  it('gives one span per player, each lower than the last', () => {
    const layout = { bounds: { minCol: 0, maxCol: 10, minRow: 0, maxRow: 50 }, settings: { seat_drow: '16.4' } } as never;
    const s = bandSpans(layout, 3, 50);
    expect(s.length).toBe(3);
    expect(s[1].top).toBeGreaterThan(s[0].top);
    expect(s[2].top).toBeGreaterThan(s[1].top);
    expect(s[0].bottom).toBeCloseTo(s[1].top, 5);
  });
});

function Probe({ text, still }: { text: string; still: boolean }) {
  const { shown, ring } = useShuffledText(text, still);
  return <div data-testid="p" data-ring={ring ? '1' : '0'}>{shown}</div>;
}

describe('shuffle', () => {
  it('shows the text at once the first time, shuffles on change, then settles on the new text', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe text="2026 OCT 25" still={false} />);
    expect(screen.getByTestId('p').textContent).toBe('2026 OCT 25');
    rerender(<Probe text="2026 NOV 04" still={false} />);
    expect(screen.getByTestId('p').textContent).toHaveLength(11);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByTestId('p').textContent).toHaveLength(11);
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByTestId('p').textContent).toBe('2026 NOV 04');
  });
  it('with reduced motion there is no shuffle: new date at once, short ring', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe text="2026 OCT 25" still />);
    rerender(<Probe text="2026 OCT 26" still />);
    expect(screen.getByTestId('p').textContent).toBe('2026 OCT 26');
    expect(screen.getByTestId('p').dataset.ring).toBe('1');
    act(() => { vi.advanceTimersByTime(1500); });
    expect(screen.getByTestId('p').dataset.ring).toBe('0');
  });
});

describe('FlipClock', () => {
  it('reads the player\'s own date', () => {
    render(<FlipClock player={{ id: 'a', name: 'Ann', color: '#2563eb', timeSpent: 0 }} date={clockDate('2026-10-25', 10)} big={false} current={false} still={false} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Ann: 2026 NOV 04');
  });
});

describe('TownClocks on the remote strip', () => {
  it('draws one slim clock, the current player\'s', () => {
    const layout = { bounds: { minCol: 0, maxCol: 10, minRow: 0, maxRow: 50 }, settings: {} } as never;
    const players = [
      { id: 'a', name: 'Ann', color: '#2563eb', timeSpent: 5 },
      { id: 'b', name: 'Bo', color: '#dc2626', timeSpent: 40 },
    ];
    render(
      <ReactFlowProvider>
        <div style={{ width: 400, height: 300 }}>
          <ReactFlow nodes={[]} edges={[]}><TownClocks players={players} currentPlayerId="b" layout={layout} tile={50} startIso="2026-10-25" screen="remote" /></ReactFlow>
        </div>
      </ReactFlowProvider>,
    );
    expect(screen.queryByTestId('town-clock-a')).toBeNull();
    expect(screen.getByTestId('town-clock-b').getAttribute('aria-label')).toBe('Bo: 2026 DEC 04');
  });
});
