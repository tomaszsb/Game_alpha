/**
 * ModalBasePanelAnchor.test.tsx
 *
 * PC "play" pop-ups open over the player panel with the dark cover only over the panel; reading
 * pop-ups, phones and remotes (no panel marker) and narrow windows stay centred and full-screen.
 * The test ids, role="dialog", aria-modal and the "Close modal" button do not change (the Jarvis
 * robot clicks them every night).
 * @vitest-environment jsdom
 */

import React, { useRef } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { ModalBase } from '../../../src/components/modals/shared/ModalBase';
import { PanelAnchorContext } from '../../../src/components/modals/shared/panelAnchor';

function PanelPage({ anchor, width = 1280 }: { anchor?: 'panel'; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  return (
    <PanelAnchorContext.Provider value={ref}>
      <div ref={ref} data-testid="col" />
      <ModalBase isOpen onClose={vi.fn()} title="T" testId="m" anchor={anchor}>
        <button>Go</button>
      </ModalBase>
    </PanelAnchorContext.Provider>
  );
}

describe('ModalBase anchor="panel"', () => {
  let panelWidth = 350;
  beforeEach(() => {
    panelWidth = 350;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const isCol = this.getAttribute('data-testid') === 'col';
      return (isCol
        ? { top: 55, left: 4, width: panelWidth, height: 800, right: 4 + panelWidth, bottom: 855, x: 4, y: 55, toJSON: () => ({}) }
        : { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('covers only the panel when asked to, and keeps its hooks', () => {
    render(<PanelPage anchor="panel" />);
    const overlay = screen.getByTestId('m-overlay');
    expect(overlay.style.left).toBe('4px');
    expect(overlay.style.top).toBe('55px');
    expect(overlay.style.width).toBe('350px');
    expect(overlay.style.height).toBe('800px');
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('data-testid', 'm');
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
  });

  it('stays full-screen for a reading pop-up (no anchor)', () => {
    render(<PanelPage />);
    const overlay = screen.getByTestId('m-overlay');
    expect(overlay.style.top).toBe('0px');
    expect(overlay.style.left).toBe('0px');
    expect(overlay.style.right).toBe('0px');
    expect(overlay.style.bottom).toBe('0px');
  });

  it('stays full-screen in a narrow window even when asked', () => {
    render(<PanelPage anchor="panel" width={700} />);
    expect(screen.getByTestId('m-overlay').style.right).toBe('0px');
  });

  it('stays full-screen when the panel is too narrow to read in (1024x768 panel is 300px)', () => {
    panelWidth = 300;
    render(<PanelPage anchor="panel" width={1024} />);
    expect(screen.getByTestId('m-overlay').style.right).toBe('0px');
  });

  it('stays full-screen with no panel marker (phone / remote)', () => {
    render(
      <ModalBase isOpen onClose={vi.fn()} title="T" testId="m" anchor="panel">
        <button>Go</button>
      </ModalBase>
    );
    expect(screen.getByTestId('m-overlay').style.right).toBe('0px');
  });
});
