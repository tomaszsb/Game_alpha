import { describe, it, expect, vi, afterEach } from 'vitest';
import { keepAudioUnlocked, turnAlertLine } from '../../src/utils/haptics';

describe('what a phone promises for your turn (Tom 10-30: "the buzz does not work on i phones")', () => {
  it('promises a buzz only where the phone can vibrate', () => {
    expect(turnAlertLine(true)).toMatch(/buzz/);
    expect(turnAlertLine(false)).not.toMatch(/buzz/);
    expect(turnAlertLine(false)).toMatch(/chime/);
    expect(turnAlertLine(false)).toMatch(/sound is on/);
  });
});

describe('sound stays unlocked on a phone', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('every tap unlocks it again, until stopped', () => {
    const resume = vi.fn(() => Promise.resolve());
    const Ctx = vi.fn(function (this: { state: string; resume: typeof resume }) { this.state = 'suspended'; this.resume = resume; });
    vi.stubGlobal('AudioContext', Ctx);
    const stop = keepAudioUnlocked();
    window.dispatchEvent(new Event('pointerdown'));
    expect(Ctx).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('touchend'));
    expect(resume).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new Event('pointerdown'));
    expect(resume).toHaveBeenCalledTimes(2);
  });
});
