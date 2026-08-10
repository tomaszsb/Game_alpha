/**
 * ModalBaseFocusTrap.test.tsx
 *
 * Fire TV report-form bug: ModalBase had no focus trap and no arrow-key
 * handling, so a D-pad remote (which sends ArrowUp/Down/Left/Right, never
 * Tab) had no way to move between fields/buttons inside a modal, and focus
 * could wander onto the page behind it entirely.
 *
 * Covers: initial focus (default + data-modal-initial-focus), Tab/Shift-Tab
 * wrap, arrow-key traversal in DOM order, arrow keys not hijacking text
 * input caret movement, focus restoration on close, and the trap surviving
 * dynamically-added elements.
 * @vitest-environment jsdom
 */

import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ModalBase } from '../../../src/components/modals/shared/ModalBase';

describe('ModalBase focus trap', () => {
  afterEach(() => cleanup());

  it('focuses the first focusable element inside the modal by default', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <button>First</button>
        <button>Second</button>
      </ModalBase>
    );
    // The header's own close button precedes the body in DOM order, so it
    // is "the first focusable element inside the modal" absent an explicit
    // data-modal-initial-focus target.
    expect(screen.getByLabelText('Close modal')).toHaveFocus();
  });

  it('focuses the data-modal-initial-focus element when present', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <button>First</button>
        <input data-modal-initial-focus placeholder="Describe the bug" />
        <button>Second</button>
      </ModalBase>
    );
    expect(screen.getByPlaceholderText('Describe the bug')).toHaveFocus();
  });

  it('Tab from the last element wraps to the first', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <button>Only</button>
      </ModalBase>
    );
    const closeBtn = screen.getByLabelText('Close modal');
    const onlyBtn = screen.getByRole('button', { name: 'Only' });
    onlyBtn.focus();
    expect(onlyBtn).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeBtn).toHaveFocus();
  });

  it('Shift+Tab from the first element wraps to the last', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <button>Only</button>
      </ModalBase>
    );
    const closeBtn = screen.getByLabelText('Close modal');
    const onlyBtn = screen.getByRole('button', { name: 'Only' });
    closeBtn.focus();
    expect(closeBtn).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(onlyBtn).toHaveFocus();
  });

  it('ArrowDown/ArrowRight move to the next focusable element in DOM order, wrapping at the end', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <button data-modal-initial-focus>A</button>
        <button>B</button>
        <button>C</button>
      </ModalBase>
    );
    const [a, b, c] = [
      screen.getByRole('button', { name: 'A' }),
      screen.getByRole('button', { name: 'B' }),
      screen.getByRole('button', { name: 'C' }),
    ];
    expect(a).toHaveFocus();

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(b).toHaveFocus();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(c).toHaveFocus();

    // Past the last element wraps back to the close button (still first in
    // DOM order, same as Tab wrap).
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByLabelText('Close modal')).toHaveFocus();
  });

  it('ArrowUp/ArrowLeft move to the previous focusable element, wrapping at the start', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <button data-modal-initial-focus>A</button>
        <button>B</button>
      </ModalBase>
    );
    const a = screen.getByRole('button', { name: 'A' });
    const closeBtn = screen.getByLabelText('Close modal');

    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(closeBtn).toHaveFocus();

    fireEvent.keyDown(document, { key: 'ArrowUp' });
    // wraps past the first (close button) to the last focusable — B
    expect(screen.getByRole('button', { name: 'B' })).toHaveFocus();
  });

  it('does not hijack arrow keys inside a text input (caret movement stays native)', () => {
    render(
      <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
        <input data-modal-initial-focus type="text" defaultValue="hello" />
        <button>Submit</button>
      </ModalBase>
    );
    const input = screen.getByDisplayValue('hello') as HTMLInputElement;
    expect(input).toHaveFocus();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    // Focus must stay on the input — arrow keys move the caret there, not focus.
    expect(input).toHaveFocus();
  });

  it('Escape still closes the modal', () => {
    const onClose = vi.fn();
    render(
      <ModalBase isOpen={true} onClose={onClose} title="Test" testId="m">
        <button>Only</button>
      </ModalBase>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously-focused element on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>Open</button>
          <ModalBase isOpen={open} onClose={() => setOpen(false)} title="Test" testId="m">
            <button>Inside</button>
          </ModalBase>
        </div>
      );
    }
    render(<Harness />);
    const openBtn = screen.getByRole('button', { name: 'Open' });
    openBtn.focus();
    fireEvent.click(openBtn);

    expect(screen.getByLabelText('Close modal')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(openBtn).toHaveFocus();
  });

  it('survives dynamically-added elements — a newly-revealed control is reachable without re-mounting the trap', () => {
    // Uses a checkbox (not a text input) as the revealed control: arrow keys
    // deliberately skip navigation while a free-text field has focus (see
    // "does not hijack arrow keys inside a text input" above), so this test
    // isolates the "was the DOM re-queried, not cached" behavior on its own.
    function Harness() {
      const [revealed, setRevealed] = useState(false);
      return (
        <ModalBase isOpen={true} onClose={vi.fn()} title="Test" testId="m">
          <button data-modal-initial-focus onClick={() => setRevealed(true)}>
            Reveal
          </button>
          {revealed && <input type="checkbox" aria-label="New option" />}
          <button>Last</button>
        </ModalBase>
      );
    }
    render(<Harness />);
    const revealBtn = screen.getByRole('button', { name: 'Reveal' });
    expect(revealBtn).toHaveFocus();

    fireEvent.click(revealBtn);
    const newField = screen.getByRole('checkbox', { name: 'New option' });

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(newField).toHaveFocus();

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });
});
