import { describe, it, expect, beforeEach } from 'vitest';
import { getGameSpeed, setGameSpeed, scaleMs, FAST_FACTOR, initGameSpeed } from '../../src/utils/gameSpeed';

describe('gameSpeed', () => {
  beforeEach(() => { localStorage.clear(); setGameSpeed('normal'); });

  it('is Normal until the player picks Fast, and Normal leaves every wait alone', () => {
    expect(getGameSpeed()).toBe('normal');
    expect(scaleMs(350)).toBe(350);
  });

  it('Fast shortens waits and glides, is remembered, and puts a marker on the page', () => {
    setGameSpeed('fast');
    expect(getGameSpeed()).toBe('fast');
    expect(scaleMs(350)).toBe(Math.round(350 * FAST_FACTOR));
    expect(localStorage.getItem('uc-game-speed')).toBe('fast');
    expect(document.documentElement.dataset.gameSpeed).toBe('fast');
    expect(document.getElementById('uc-game-speed-style')).not.toBeNull();
  });

  it('a remembered Fast is applied at start-up, and Normal puts the page back', () => {
    localStorage.setItem('uc-game-speed', 'fast');
    initGameSpeed();
    expect(document.documentElement.dataset.gameSpeed).toBe('fast');
    setGameSpeed('normal');
    expect(document.documentElement.dataset.gameSpeed).toBe('normal');
    expect(scaleMs(100)).toBe(100);
  });
});
