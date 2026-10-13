/**
 * ModalBaseClipboard.test.tsx
 *
 * Tom, 2026-10-13 ("build the flip and the popups"): a page of the player's clipboard is a pop-up drawn on the wooden
 * board in the player's colour, with the page tabs down the board's edge; the pop-ups you PLAY that open over the panel
 * are pages of the clipboard too. Everything else is exactly as before, and the hooks the robot uses do not change.
 * @vitest-environment jsdom
 */

import React, { useRef } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { ModalBase } from '../../../src/components/modals/shared/ModalBase';
import { PanelAnchorContext, ClipboardLookContext } from '../../../src/components/modals/shared/panelAnchor';

function OverPanel({ anchor, look }: { anchor?: 'panel'; look: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  const inner = (
    <ModalBase isOpen onClose={vi.fn()} title="T" testId="m" anchor={anchor}>
      <button>Go</button>
    </ModalBase>
  );
  return (
    <PanelAnchorContext.Provider value={ref}>
      <div ref={ref} data-testid="col" />
      {look ? <ClipboardLookContext.Provider value={{ color: '#2563eb' }}>{inner}</ClipboardLookContext.Provider> : inner}
    </PanelAnchorContext.Provider>
  );
}

describe('ModalBase as a page of the clipboard', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const isCol = this.getAttribute('data-testid') === 'col';
      return (isCol
        ? { top: 55, left: 4, width: 350, height: 800, right: 354, bottom: 855, x: 4, y: 55, toJSON: () => ({}) }
        : { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('asked outright: the clip, the tabs on the edge and the player\'s colour on the board; hooks unchanged', () => {
    render(
      <ModalBase isOpen onClose={vi.fn()} title="Money" testId="page" clipboard={{ color: '#2563eb', tabs: <div data-testid="the-tabs" /> }}>
        <button>Go</button>
      </ModalBase>,
    );
    expect(screen.getByTestId('clipboard-clip')).toBeInTheDocument();
    expect(screen.getByTestId('the-tabs')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-testid', 'page');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.style.background).toContain('rgb(37, 99, 235)');
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    expect(screen.getByText('Money')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('a pop-up you play that opens over the panel is a page of the current player\'s clipboard', () => {
    render(<OverPanel anchor="panel" look />);
    expect(screen.getByTestId('clipboard-clip')).toBeInTheDocument();
    expect(screen.getByRole('dialog').style.background).toContain('rgb(37, 99, 235)');
    expect(screen.getByTestId('m-overlay').style.left).toBe('4px');
  });

  it('a reading pop-up, or one with no clipboard look given, is exactly as before', () => {
    const { unmount } = render(<OverPanel look />);
    expect(screen.queryByTestId('clipboard-clip')).toBeNull();
    unmount();
    cleanup();
    render(<OverPanel anchor="panel" look={false} />);
    expect(screen.queryByTestId('clipboard-clip')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
  });
});
