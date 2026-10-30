/* @vitest-pool forks */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeaderMenu, menuFitHeight } from '../../../src/components/layout/HeaderMenu';
import { buildHeaderMenuItems } from '../../../src/utils/headerMenuItems';
import { setGameSpeed, getGameSpeed } from '../../../src/utils/gameSpeed';

const items = (over: Parameters<typeof buildHeaderMenuItems>[0] extends infer O ? Partial<O> : never = {}) => buildHeaderMenuItems({
  howToPlay: vi.fn(), gameLog: { onToggle: vi.fn() }, glossary: { onToggle: vi.fn() },
  theme: { dark: false, toggle: vi.fn() }, speed: { fast: false, toggle: vi.fn() }, ...over,
});

describe('HeaderMenu (one menu for the PC, the TV and the remote screen)', () => {
  beforeEach(() => { localStorage.clear(); setGameSpeed('normal'); });
  afterEach(() => cleanup());

  it('shows ONE Menu button and keeps everything else inside it', () => {
    render(<HeaderMenu items={items()} buttonStyle={{}} />);
    expect(screen.getByTestId('header-menu-button')).toBeInTheDocument();
    expect(screen.queryByText(/How to play/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('header-menu-button'));
    for (const label of [/How to play/, /Game log/, /Glossary/, /Dark mode/, /Speed/, /This screen is/, /Full screen/]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('a screen lists only what it can do, in the same order with the same words', () => {
    const tv = buildHeaderMenuItems({
      howToPlay: vi.fn(), gameLog: { onToggle: vi.fn() }, standings: { onToggle: vi.fn() }, connectPhone: { onToggle: vi.fn() },
      speed: { fast: false, toggle: vi.fn() },
    });
    const pc = buildHeaderMenuItems({
      howToPlay: vi.fn(), gameLog: { onToggle: vi.fn() }, glossary: { onToggle: vi.fn() }, theme: { dark: false, toggle: vi.fn() },
      speed: { fast: false, toggle: vi.fn() },
    });
    const shared = tv.filter(t => pc.some(p => p.id === t.id)).map(t => [t.id, t.label]);
    expect(shared).toEqual(pc.filter(p => tv.some(t => t.id === p.id)).map(p => [p.id, p.label]));
    expect(tv.map(t => t.id)).toEqual(['how-to-play', 'game-log', 'standings', 'connect-phone', 'speed']);
  });

  it('runs the action and closes the menu', () => {
    const howToPlay = vi.fn();
    render(<HeaderMenu items={items({ howToPlay })} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    fireEvent.click(screen.getByText(/How to play/));
    expect(howToPlay).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('header-menu')).not.toBeInTheDocument();
  });

  it('an open panel is marked, so the player knows what is showing', () => {
    render(<HeaderMenu items={items({ gameLog: { onToggle: vi.fn(), open: true } })} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    expect(screen.getByText(/Game log/)).toHaveTextContent('(showing)');
  });

  it('the speed item flips Normal <-> Fast and stays open', () => {
    let fast = false;
    const make = () => items({ speed: { fast, toggle: () => { fast = !fast; setGameSpeed(fast ? 'fast' : 'normal'); } } });
    const { rerender } = render(<HeaderMenu items={make()} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    fireEvent.click(screen.getByTestId('game-speed-toggle'));
    expect(getGameSpeed()).toBe('fast');
    rerender(<HeaderMenu items={make()} buttonStyle={{}} />);
    expect(screen.getByTestId('game-speed-toggle')).toHaveTextContent('Fast');
    expect(screen.getByTestId('header-menu')).toBeInTheDocument();
  });

  it('the Board item appears only when the board has a town, says which board shows, and stays open', () => {
    const toggle = vi.fn();
    expect(items().some(i => i.id === 'board-style')).toBe(false);
    render(<HeaderMenu items={items({ boardStyle: { town: false, toggle } })} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    expect(screen.getByTestId('board-style-toggle')).toHaveTextContent('Board: Classic');
    fireEvent.click(screen.getByTestId('board-style-toggle'));
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('header-menu')).toBeInTheDocument();
  });

  it('closes on its own X, on a click outside it, and on Esc', () => {
    render(<><div data-testid="outside">board</div><HeaderMenu items={items()} buttonStyle={{}} /></>);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    fireEvent.click(screen.getByTestId('header-menu-close'));
    expect(screen.queryByTestId('header-menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('header-menu-button'));
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('header-menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('header-menu-button'));
    fireEvent.pointerDown(screen.getByText(/How to play/));
    expect(screen.getByTestId('header-menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('header-menu')).not.toBeInTheDocument();
  });

  it('the game code lives in the menu as "Invite a friend", and says when the link was copied', () => {
    const onInvite = vi.fn();
    const { rerender } = render(<HeaderMenu items={items({ invite: { code: 'G-ABCD-1234', copied: false, onInvite } })} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    expect(screen.getByTestId('invite-friend')).toHaveTextContent('Invite a friend · G-ABCD-1234');
    fireEvent.click(screen.getByTestId('invite-friend'));
    expect(onInvite).toHaveBeenCalledTimes(1);
    rerender(<HeaderMenu items={items({ invite: { code: 'G-ABCD-1234', copied: true, onInvite } })} buttonStyle={{}} />);
    expect(screen.getByTestId('invite-friend')).toHaveTextContent('Link copied');
  });

  it('what kind of screen this is can be changed from inside the menu', () => {
    render(<HeaderMenu items={items()} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    expect(screen.queryByTestId('screen-type-tv')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('screen-type-button'));
    expect(screen.getByTestId('screen-type-pc')).toBeInTheDocument();
    expect(screen.getByTestId('screen-type-tv')).toBeInTheDocument();
  });
});

describe('the menu fits the screen (Tom, TV test 10-30)', () => {
  afterEach(() => cleanup());

  it('Full screen comes first, so it can always be reached', () => {
    render(<HeaderMenu items={items()} buttonStyle={{}} />);
    fireEvent.click(screen.getByTestId('header-menu-button'));
    const list = screen.getByTestId('header-menu').querySelectorAll('[role^="menuitem"]');
    expect(list[0]).toBe(screen.getByTestId('fullscreen-toggle'));
  });

  it('is never taller than what can be seen below where it opens', () => {
    expect(menuFitHeight(136, 360)).toBe(216);
    expect(menuFitHeight(100, 1080)).toBe(972);
    expect(menuFitHeight(100, 508, 2)).toBe(200);
    expect(menuFitHeight(136, 150)).toBe(60); // a sliver of window still leaves a usable list, which scrolls
  });
});
