/**
 * ModalSettle.test.tsx
 *
 * A pop-up whose swing-down froze partway (reports 10-19 and 10-21, Farmingdale class) is
 * snapped flat a second after it opens. A flat one is never touched.
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ModalBase, settleTiltedModal, MODAL_SETTLE_MS } from '../../../src/components/modals/shared/ModalBase';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('settleTiltedModal', () => {
  it('flattens a modal left at an angle and leaves a flat one alone', () => {
    const el = document.createElement('div');
    el.style.transform = 'perspective(900px) rotateX(-40deg)';
    el.style.opacity = '0.4';
    expect(settleTiltedModal(el)).toBe(true);
    expect(el.style.transform).toBe('none');
    expect(el.style.opacity).toBe('1');
    const flat = document.createElement('div');
    flat.style.transform = 'perspective(900px) rotateX(0deg) translateX(0px)';
    expect(settleTiltedModal(flat)).toBe(false);
    expect(settleTiltedModal(null)).toBe(false);
  });
});

describe('ModalBase failsafe', () => {
  it('snaps a tilted dialog flat after the settle time', () => {
    vi.useFakeTimers();
    render(<ModalBase isOpen onClose={() => {}} title="Result" testId="m">body</ModalBase>);
    const dialog = screen.getByTestId('m');
    dialog.style.transform = 'rotateX(-60deg)'; // as if the flip froze
    act(() => { vi.advanceTimersByTime(MODAL_SETTLE_MS + 50); });
    expect(dialog.style.transform).toBe('none');
  });
});
