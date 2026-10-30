import { describe, it, expect } from 'vitest';
import { cameraLockFor, TV_CAMERA_LOCK } from '../../src/utils/tvCamera';
import { keyNameOf } from '../../src/utils/tvMeter';

describe('a TV\'s camera moves only by itself', () => {
  it('turns off everything a pointer can do, on a TV only', () => {
    expect(cameraLockFor('tv')).toEqual(TV_CAMERA_LOCK);
    for (const key of ['panOnDrag', 'panOnScroll', 'zoomOnScroll', 'zoomOnPinch', 'zoomOnDoubleClick'] as const) expect(TV_CAMERA_LOCK[key]).toBe(false);
    expect(cameraLockFor('pc')).toEqual({});
    expect(cameraLockFor('remote')).toEqual({});
    expect(cameraLockFor(undefined)).toEqual({});
  });
});

describe('the remote\'s key names', () => {
  it('sends a named key as it is, and never a typed letter or digit', () => {
    expect(keyNameOf({ key: 'ArrowUp', keyCode: 38 })).toBe('ArrowUp');
    expect(keyNameOf({ key: 'a', keyCode: 65 })).toBe('char');
    expect(keyNameOf({ key: '7', keyCode: 55 })).toBe('char');
    expect(keyNameOf({ key: 'Unidentified', keyCode: 233 })).toBe('code233');
  });
});
