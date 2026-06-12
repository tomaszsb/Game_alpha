/**
 * ModalBase.test.tsx
 *
 * Regression tests for fb:ac29b623 — backdrop click-through protection.
 * A result modal that opens UNDER a click the player already committed
 * (rapid clicking through actions) used to be dismissed by that in-flight
 * click landing on the backdrop: the modal flashed and vanished before the
 * player could read it. Verified with a live repro 2026-06-12.
 *
 * Backdrop clicks inside BACKDROP_GRACE_MS of opening are ignored; the
 * ✕ button and deliberate (later) backdrop clicks still close the modal.
 */

import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModalBase, BACKDROP_GRACE_MS } from '../../../src/components/modals/shared/ModalBase';

describe('ModalBase backdrop click-through protection (fb:ac29b623)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  const renderModal = (onClose: () => void) =>
    render(
      <ModalBase isOpen={true} onClose={onClose} title="Test" testId="test-modal">
        <div>content</div>
      </ModalBase>
    );

  it('ignores a backdrop click that lands within the grace window of opening', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    // An in-flight click lands on the backdrop ~100ms after the modal opens
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.click(screen.getByTestId('test-modal-overlay'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('honors a deliberate backdrop click after the grace window', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    act(() => {
      vi.advanceTimersByTime(BACKDROP_GRACE_MS + 50);
    });
    fireEvent.click(screen.getByTestId('test-modal-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the ✕ close button works immediately — grace only applies to the backdrop', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    fireEvent.click(screen.getByLabelText('Close modal'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicks on the modal body never close (target !== backdrop)', () => {
    const onClose = vi.fn();
    renderModal(onClose);

    act(() => {
      vi.advanceTimersByTime(BACKDROP_GRACE_MS + 50);
    });
    fireEvent.click(screen.getByText('content'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
