import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getSoundOn, setSoundOn, useSoundMenu } from '../../src/utils/soundSetting';
import { setTownAvailable } from '../../src/utils/boardStyle';
import { playResultChime, isAudioReady } from '../../src/utils/haptics';
import { bubbleVolume, DEFAULT_BUBBLE_VOLUME } from '../../src/utils/townLayout';
import { buildHeaderMenuItems } from '../../src/utils/headerMenuItems';

describe('the town chimes', () => {
  beforeEach(() => { localStorage.clear(); setTownAvailable(false); });

  it('Sound starts On and the choice is remembered on this device', () => {
    expect(getSoundOn()).toBe(true);
    setSoundOn(false);
    expect(getSoundOn()).toBe(false);
    expect(localStorage.getItem('uc-sound')).toBe('off');
  });

  it('the menu offers Sound only when the board has a town', () => {
    const { result } = renderHook(() => useSoundMenu());
    expect(result.current).toBeUndefined();
    act(() => setTownAvailable(true));
    expect(result.current).toMatchObject({ on: true });
    act(() => result.current!.toggle());
    expect(result.current).toMatchObject({ on: false });
  });

  it('the header menu lists it, in words, with a test hook', () => {
    const items = buildHeaderMenuItems({ speed: { fast: false, toggle: () => {} }, sound: { on: true, toggle: () => {} } });
    const item = items.find(i => i.id === 'sound');
    expect(item).toMatchObject({ label: 'Sound: On', testId: 'sound-toggle' });
  });

  it('the volume is data: 0 to 1, 0 = silent, bad or missing = the default', () => {
    expect(bubbleVolume({ bubble_sound_volume: '0.5' })).toBe(0.5);
    expect(bubbleVolume({ bubble_sound_volume: '0' })).toBe(0);
    expect(bubbleVolume({ bubble_sound_volume: '7' })).toBe(1);
    expect(bubbleVolume({ bubble_sound_volume: 'loud' })).toBe(DEFAULT_BUBBLE_VOLUME);
    expect(bubbleVolume({})).toBe(DEFAULT_BUBBLE_VOLUME);
  });

  it('makes no sound on a page nobody has tapped (and never throws)', () => {
    const Ctx = vi.fn();
    vi.stubGlobal('AudioContext', Ctx);
    expect(isAudioReady()).toBe(false);
    expect(() => playResultChime('good', 0.2)).not.toThrow();
    expect(Ctx).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
