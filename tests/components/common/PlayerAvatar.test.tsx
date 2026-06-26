import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { PlayerAvatar } from '../../../src/components/common/PlayerAvatar';

describe('PlayerAvatar', () => {
  afterEach(() => cleanup());

  it('encircles the emoji in the player color (the cross-device "that\'s me" signal)', () => {
    render(<PlayerAvatar avatar="🦊" color="#1d4ed8" title="Tomasz" />);
    // jsdom serializes hex to rgb(); #1d4ed8 === rgb(29, 78, 216).
    const css = screen.getByText('🦊').getAttribute('style') || '';
    expect(css).toContain('border-radius: 50%');
    expect(css).toContain('rgb(29, 78, 216)'); // ring + faint fill derive from the player color
  });

  it('falls back to a neutral ring when the player has no color', () => {
    render(<PlayerAvatar avatar="🦊" />);
    // Neutral slate #94a3b8 === rgb(148, 163, 184).
    expect(screen.getByText('🦊').getAttribute('style') || '').toContain('rgb(148, 163, 184)');
  });
});
