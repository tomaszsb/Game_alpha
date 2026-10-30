import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getBoardStyle, setBoardStyle, setGameBoardStyle, setTownAvailable, useBoardStyleMenu, setTownWalking, useTownWalking } from '../../src/utils/boardStyle';

describe('boardStyle (the Board: Classic / Town switch)', () => {
  beforeEach(() => { localStorage.clear(); setGameBoardStyle(undefined); setTownAvailable(false); });

  it('starts on Classic, and Town is remembered on this device', () => {
    localStorage.clear();
    expect(getBoardStyle()).toBe('classic');
    setBoardStyle('town');
    expect(getBoardStyle()).toBe('town');
    expect(localStorage.getItem('uc-board-style:')).toBe('town');
  });

  it("starts on the host's pick for the game, and the screen's own Menu choice wins", () => {
    setGameBoardStyle('town');
    expect(getBoardStyle()).toBe('town');
    setBoardStyle('classic');
    expect(getBoardStyle()).toBe('classic');
    setGameBoardStyle('classic');
    localStorage.clear();
    expect(getBoardStyle()).toBe('classic');
    setGameBoardStyle(undefined);
    expect(getBoardStyle()).toBe('classic');
  });

  it('the menu offers the switch only when the board has a town', () => {
    const { result } = renderHook(() => useBoardStyleMenu());
    expect(result.current).toBeUndefined();
    act(() => setTownAvailable(true));
    expect(result.current).toMatchObject({ town: false });
    act(() => result.current!.toggle());
    expect(result.current).toMatchObject({ town: true });
    expect(getBoardStyle()).toBe('town');
    act(() => result.current!.toggle());
    expect(result.current).toMatchObject({ town: false, round: true });
    expect(getBoardStyle()).toBe('round');
    act(() => result.current!.toggle());
    expect(getBoardStyle()).toBe('classic');
  });

  it('the Menu names the round town', async () => {
    const { buildHeaderMenuItems } = await import('../../src/utils/headerMenuItems');
    const label = (b: { town: boolean; round?: boolean }) => buildHeaderMenuItems({ speed: { fast: false, toggle: () => {} }, boardStyle: { ...b, toggle: () => {} } }).find(i => i.id === 'board-style')?.label;
    expect(label({ town: true })).toBe('Board: Town');
    expect(label({ town: false, round: true })).toBe('Board: Round town');
    expect(label({ town: false })).toBe('Board: Classic');
  });

  it('Round town is a board like the others: a screen can pick it, and a round game starts every screen on it', () => {
    setGameBoardStyle('round');
    expect(getBoardStyle()).toBe('round');
    setBoardStyle('town');
    expect(getBoardStyle()).toBe('town');
    localStorage.clear();
    setGameBoardStyle(undefined);
    expect(getBoardStyle()).toBe('classic');
  });

  it('a town walk tells the screen to hold its pop-ups, and lets go when it ends', () => {
    const { result } = renderHook(() => useTownWalking());
    expect(result.current).toBe(false);
    act(() => setTownWalking(true));
    expect(result.current).toBe(true);
    act(() => setTownWalking(false));
    expect(result.current).toBe(false);
  });
});
