/* @vitest-pool forks */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TvMenu } from '../../../src/components/layout/TvMenu';
import { setGameSpeed, getGameSpeed } from '../../../src/utils/gameSpeed';

const base = () => ({
  playing: true, buttonStyle: {}, showScoreboard: false, showHistory: false, showQRPanel: false,
  onToggleScoreboard: vi.fn(), onToggleHistory: vi.fn(), onToggleQR: vi.fn(), onOpenRules: vi.fn(),
  onBackToPC: vi.fn(), onOpenScreenSize: vi.fn(),
});

describe('TvMenu', () => {
  beforeEach(() => { localStorage.clear(); setGameSpeed('normal'); });
  afterEach(() => cleanup());

  it('shows one Menu button and keeps the six old buttons inside it', () => {
    render(<TvMenu {...base()} />);
    expect(screen.getByTestId('tv-menu-button')).toBeInTheDocument();
    expect(screen.queryByText(/Rules/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tv-menu-button'));
    for (const label of [/Rules/, /Standings/, /History/, /Connect Phone/, /Back to PC/, /Speed/]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('runs the old action and closes the menu', () => {
    const props = base();
    render(<TvMenu {...props} />);
    fireEvent.click(screen.getByTestId('tv-menu-button'));
    fireEvent.click(screen.getByText(/Rules/));
    expect(props.onOpenRules).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('tv-menu')).not.toBeInTheDocument();
  });

  it('hides History and Connect Phone before the game starts', () => {
    render(<TvMenu {...base()} playing={false} />);
    fireEvent.click(screen.getByTestId('tv-menu-button'));
    expect(screen.queryByText(/History/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Connect Phone/)).not.toBeInTheDocument();
  });

  it('the speed item flips Normal <-> Fast and stays open', () => {
    render(<TvMenu {...base()} />);
    fireEvent.click(screen.getByTestId('tv-menu-button'));
    fireEvent.click(screen.getByTestId('game-speed-toggle'));
    expect(getGameSpeed()).toBe('fast');
    expect(screen.getByTestId('game-speed-toggle')).toHaveTextContent('Fast');
    expect(screen.getByTestId('tv-menu')).toBeInTheDocument();
  });
});
