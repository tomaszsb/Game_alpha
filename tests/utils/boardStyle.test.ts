import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getBoardStyle, setBoardStyle, setTownAvailable, useBoardStyleMenu } from '../../src/utils/boardStyle';

describe('boardStyle (the Board: Classic / Town switch)', () => {
  beforeEach(() => { localStorage.clear(); setBoardStyle('classic'); setTownAvailable(false); });

  it('starts on Classic, and Town is remembered on this device', () => {
    localStorage.clear();
    expect(getBoardStyle()).toBe('classic');
    setBoardStyle('town');
    expect(getBoardStyle()).toBe('town');
    expect(localStorage.getItem('uc-board-style')).toBe('town');
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
    expect(getBoardStyle()).toBe('classic');
  });
});
