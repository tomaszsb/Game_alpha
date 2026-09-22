import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HelpButton } from '../../../src/components/help/HelpButton';
import { panelPalettes } from '../../../src/components/player/panelTheme';

/**
 * The one "?" (Onboarding Phase C, "one ? everywhere", v3.2.71).
 *
 * Before this, "explain this to me" had five different looks and gestures. The
 * "?" is now one component, so these pin what every place that wears it must
 * keep: the accessible name, the disclosure state, and the structural hooks that
 * are not copy (the nightly robot found controls by their words and went blind
 * three releases in a row — see the v3.2.55 entry in CLAUDE.md).
 */
describe('HelpButton', () => {
  afterEach(() => cleanup());

  const renderButton = (overrides: Partial<React.ComponentProps<typeof HelpButton>> = {}) => {
    const onToggle = vi.fn();
    render(
      <HelpButton
        label="Add a team member"
        kind="action"
        isOpen={false}
        onToggle={onToggle}
        palette={panelPalettes.light}
        {...overrides}
      />,
    );
    return { onToggle, button: screen.getByRole('button') };
  };

  it('is a "?" named for the question a beginner asks, with the thing it explains', () => {
    const { button } = renderButton();
    // The glyph alone would be colour/shape-only signalling; the name says what.
    expect(button).toHaveAccessibleName("What's this? Add a team member");
    expect(button).toHaveTextContent('?');
  });

  it('carries structural hooks that are not copy', () => {
    const { button } = renderButton({ kind: 'step' });
    expect(button).toHaveAttribute('data-testid', 'help-button');
    expect(button).toHaveAttribute('data-help-kind', 'step');
  });

  it('reports open and closed through aria-expanded', () => {
    cleanup();
    const closed = renderButton({ isOpen: false }).button;
    expect(closed).toHaveAttribute('aria-expanded', 'false');
    cleanup();
    const open = renderButton({ isOpen: true }).button;
    expect(open).toHaveAttribute('aria-expanded', 'true');
  });

  it('points at its card only while the card exists', () => {
    // aria-controls to an element that is not in the DOM is a dangling reference.
    cleanup();
    expect(renderButton({ isOpen: false, cardId: 'help-card-x' }).button).not.toHaveAttribute('aria-controls');
    cleanup();
    expect(renderButton({ isOpen: true, cardId: 'help-card-x' }).button).toHaveAttribute('aria-controls', 'help-card-x');
  });

  it('asks its owner to toggle, once per press', () => {
    const { button, onToggle } = renderButton();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps its minimum width and lets a title row set its own height', () => {
    // 2026-09-22 (Tom, live feedback): shrunk from a 44px touch-target floor
    // to match the header toolbar's small icon buttons — see HelpButton.tsx.
    const { button } = renderButton({ minHeight: 26 });
    expect(button).toHaveStyle({ minWidth: '26px', minHeight: '26px' });
  });

  it('accepts a placement-only style (the editor preview overlays it)', () => {
    const { button } = renderButton({ style: { position: 'absolute', top: 10, right: 12 } });
    expect(button).toHaveStyle({ position: 'absolute', top: '10px', right: '12px' });
  });

  it('is a real <button>, never a role pretending', () => {
    // TextWithTerms' glossary terms are <span role="button"> with stopPropagation,
    // so the "?" must be a sibling of anything it explains and a genuine control.
    const { button } = renderButton();
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });
});
