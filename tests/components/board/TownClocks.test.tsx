// The town clocks: one row along the top of the board, shuffle only on change, slim on the remote strip.
import React from 'react';
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { CLOCK_W, FlipClock, MIN_ROW_SCALE, ROW_GAP, ROW_MARGIN, TownClocks, rowScale, useShuffledText } from '../../../src/components/board/TownClocks';
import { clockDate } from '../../../src/utils/gameClock';

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class { m22 = 1; constructor() {} };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('rowScale', () => {
  it('keeps the wanted size when the row fits, squeezes every clock evenly when it does not', () => {
    expect(rowScale(4, 1920, 1)).toBe(1);
    expect(rowScale(4, 1920, 1.6)).toBe(1.6);
    const tv = rowScale(4, 960, 1.6);
    expect(tv).toBeLessThan(1.6);
    expect(tv).toBeGreaterThan(MIN_ROW_SCALE);
    // the squeezed row really fits across the screen
    expect(4 * CLOCK_W * tv + 3 * ROW_GAP + 2 * ROW_MARGIN).toBeLessThanOrEqual(960 + 0.01);
    expect(rowScale(2, 960, 1.6)).toBeLessThanOrEqual(1.6);
    expect(rowScale(4, 100, 1)).toBe(MIN_ROW_SCALE);
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
    const players = [
      { id: 'a', name: 'Ann', color: '#2563eb', timeSpent: 5 },
      { id: 'b', name: 'Bo', color: '#dc2626', timeSpent: 40 },
    ];
    render(
      <ReactFlowProvider>
        <div style={{ width: 400, height: 300 }}>
          <ReactFlow nodes={[]} edges={[]}><TownClocks players={players} currentPlayerId="b" startIso="2026-10-25" screen="remote" /></ReactFlow>
        </div>
      </ReactFlowProvider>,
    );
    expect(screen.queryByTestId('town-clock-a')).toBeNull();
    expect(screen.getByTestId('town-clock-b').getAttribute('aria-label')).toBe('Bo: 2026 DEC 04');
  });
});

describe('TownClocks when a player has left', () => {
  it("takes a finished player's clock off the board but keeps the others", () => {
    const players = [
      { id: 'a', name: 'Ann', color: '#2563eb', timeSpent: 5 },
      { id: 'b', name: 'Bo', color: '#dc2626', timeSpent: 40, gone: true },
      { id: 'c', name: 'Cy', color: '#16a34a', timeSpent: 9 },
    ];
    render(
      <ReactFlowProvider>
        <div style={{ width: 400, height: 300 }}>
          <ReactFlow nodes={[]} edges={[]}><TownClocks players={players} currentPlayerId="a" startIso="2026-10-25" screen="pc" /></ReactFlow>
        </div>
      </ReactFlowProvider>,
    );
    expect(screen.queryByTestId('town-clock-b')).toBeNull();
    expect(screen.getByTestId('town-clock-a')).toBeTruthy();
    expect(screen.getByTestId('town-clock-c')).toBeTruthy();
  });
});

describe('TownClocks row', () => {
  it('puts every clock in one row, in player order, with the current player glowing', () => {
    const players = [
      { id: 'a', name: 'Ann', color: '#2563eb', timeSpent: 5 },
      { id: 'b', name: 'Bo', color: '#dc2626', timeSpent: 40 },
      { id: 'c', name: 'Cy', color: '#16a34a', timeSpent: 9 },
    ];
    render(
      <ReactFlowProvider>
        <div style={{ width: 400, height: 300 }}>
          <ReactFlow nodes={[]} edges={[]}><TownClocks players={players} currentPlayerId="b" startIso="2026-10-25" screen="pc" /></ReactFlow>
        </div>
      </ReactFlowProvider>,
    );
    const row = screen.getByTestId('town-clock-row');
    expect([...row.querySelectorAll('[data-testid^="town-clock-"]')].map(e => e.getAttribute('data-testid'))).toEqual(['town-clock-a', 'town-clock-b', 'town-clock-c']);
    expect(screen.getByTestId('town-clock-b').style.boxShadow).toContain('14px');
    expect(screen.getByTestId('town-clock-a').style.boxShadow).not.toContain('14px');
  });
});
