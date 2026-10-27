// tests/components/board/PlayerPawn.test.tsx
//
// fb:fefe42f8 (Tom 10-27): players on the town board were 28 px faces in the
// sign, hard to find. They are now big pawns: a white pawn picture tinted to
// the player's colour, with the player's face as the head.

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlayerPawn, pawnHeight, PAWN_BODY_SRC } from '../../../src/components/board/PlayerPawn';

afterEach(cleanup);

describe('PlayerPawn', () => {
  it('is as tall as pawnHeight says, so the board can make room for it', () => {
    render(<PlayerPawn avatar="👷" color="#dc3545" width={84} title="Ana" testId="pawn" />);
    const el = screen.getByTestId('pawn');
    expect(el.style.width).toBe('84px');
    expect(el.style.height).toBe(`${pawnHeight(84)}px`);
    expect(el.getAttribute('title')).toBe('Ana');
  });

  it("tints the body with the player's colour, cut to the pawn picture", () => {
    const { container } = render(<PlayerPawn color="#dc3545" width={60} testId="pawn" />);
    const spans = [...container.querySelectorAll('span')];
    const tint = spans.find(s => s.style.background.includes('rgb(220, 53, 69)') || s.style.background.includes('#dc3545'));
    expect(tint).toBeTruthy();
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe(PAWN_BODY_SRC);
    expect(img.style.mixBlendMode).toBe('multiply');
  });

  it('still draws a pawn for a player with no colour yet', () => {
    render(<PlayerPawn width={60} testId="pawn" />);
    expect(screen.getByTestId('pawn')).toBeTruthy();
  });
});
