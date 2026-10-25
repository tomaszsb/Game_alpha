// The town board's one control plate: arrows round a fit button with zoom + and -; none on the TV; folded on the remote strip.
import React from 'react';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { TownViewPad, type ViewPadScreen } from '../../../src/components/board/TownViewPad';

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class { m22 = 1; constructor() {} };
});
afterEach(cleanup);

const board = (screen: ViewPadScreen) => render(
  <ReactFlowProvider>
    <div style={{ width: 400, height: 300 }}><ReactFlow nodes={[]} edges={[]}><TownViewPad screen={screen} dark={false} /></ReactFlow></div>
  </ReactFlowProvider>,
);

describe('TownViewPad', () => {
  it('on a PC is one plate: four arrows, a fit button in the middle, zoom + and -', () => {
    board('pc');
    for (const id of ['up', 'left', 'fit', 'right', 'down', 'zoom-in', 'zoom-out']) expect(screen.getByTestId(`view-${id}`)).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBe(7);
    expect(screen.queryByTestId('view-pad-open')).toBeNull();
    // the stock React Flow column is gone
    expect(document.querySelector('.react-flow__controls')).toBeNull();
  });

  it('on the TV draws nothing', () => {
    board('tv');
    expect(screen.queryByTestId('view-pad')).toBeNull();
    expect(screen.queryByTestId('view-pad-open')).toBeNull();
  });

  it('on the remote strip folds to one View button that opens the plate and closes again', () => {
    board('remote');
    expect(screen.queryByTestId('view-pad')).toBeNull();
    fireEvent.click(screen.getByTestId('view-pad-open'));
    expect(screen.getByTestId('view-pad')).toBeTruthy();
    fireEvent.click(screen.getByTestId('view-pad-close'));
    expect(screen.getByTestId('view-pad-open')).toBeTruthy();
  });
});
