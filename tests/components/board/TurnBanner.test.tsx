/* @vitest-pool forks */
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { TurnBanner, bannerMs, bannerText, inkOn } from '../../../src/components/board/TurnBanner';

const P1 = { id: 'a', name: 'Ana', color: '#007bff' }, P2 = { id: 'b', name: 'Ben', color: '#ffc107' };

describe('the "X\'s turn" banner', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('stands when the turn passes, in the player\'s colour, and goes by itself', () => {
    const { rerender } = render(<TurnBanner player={P1} text="{name}'s turn" ms="3000" still={false} />);
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument(); // not when the screen first opens
    rerender(<TurnBanner player={P2} text="{name}'s turn" ms="3000" still={false} />);
    expect(screen.getByTestId('turn-banner')).toHaveTextContent("Ben's turn");
    act(() => { vi.advanceTimersByTime(2900); });
    expect(screen.getByTestId('turn-banner')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument();
  });

  it('shows with motion off too (only its fade stops)', () => {
    const { rerender } = render(<TurnBanner player={P1} text="{name}'s turn" ms="3000" still />);
    rerender(<TurnBanner player={P2} text="{name}'s turn" ms="3000" still />);
    expect(screen.getByTestId('turn-banner')).toBeInTheDocument();
    expect((screen.getByTestId('turn-banner').firstElementChild as HTMLElement).style.animation).toBe('');
  });

  it('the words and the seconds are data; blank or 0 turns it off', () => {
    expect(bannerText('Over to {name}!', 'Ana')).toBe('Over to Ana!');
    expect(bannerText(undefined, 'Ana')).toBe("Ana's turn");
    expect(bannerText('  ', 'Ana')).toBe('');
    expect(bannerMs('5000')).toBe(5000);
    expect(bannerMs('0')).toBe(0);
    expect(bannerMs('soon')).toBe(3000);
    const { rerender } = render(<TurnBanner player={P1} text="{name}" ms="0" still={false} />);
    rerender(<TurnBanner player={P2} text="{name}" ms="0" still={false} />);
    expect(screen.queryByTestId('turn-banner')).not.toBeInTheDocument();
  });

  it('picks whichever ink reads on the player\'s colour', () => {
    expect(inkOn('#ffc107')).toBe('#111827');
    expect(inkOn('#007bff')).toBe('#ffffff');
  });
});
