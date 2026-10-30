// The round town's "look here" glow must be SEEN on a TV (Tom's TV test, 2026-10-30: he saw none). The cause was its size:
// it was a fixed 7 board px past the sign, and a whole town on a TV is shown at about 0.38, so under 3 screen px. The town's
// own data is read here, so the glow can never again be set too small for the screen it is watched on.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pulseHalo, pulseLookOf, pulseReach } from '../../src/utils/pulseLook';

const csv = fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES/TOWN.csv'), 'utf-8');
const setting = (key: string) => new RegExp(`^setting,${key},,,,,,,,,,([^\\r\\n]*)`, 'm').exec(csv)?.[1] ?? '';
const settings = Object.fromEntries(['pulse_size', 'pulse_glow', 'pulse_rest_glow', 'pulse_ms', 'pulse_rest_ms'].map(k => [k, setting(k)]));
/** The most zoomed out a town is on a 4-player TV (measured). */
const TV_ZOOM = 0.37;
const SIGN_SCALE = parseFloat(setting('round_sign_scale'));

describe('the move-choice glow', () => {
  it('reaches at least 10 real pixels past the sign on a TV', () => {
    expect(pulseReach(pulseLookOf(settings), SIGN_SCALE) * TV_ZOOM).toBeGreaterThanOrEqual(10);
  });
  it('is bright enough at its peak to be seen', () => {
    expect(pulseLookOf(settings).glow).toBeGreaterThanOrEqual(0.7);
  });
  it('has a white line, so it stands clear of any ground, and grows with the sign', () => {
    const small = pulseHalo({ size: 16 }, 1, '#16a34a'), big = pulseHalo({ size: 16 }, 2, '#16a34a');
    expect(small.boxShadow).toContain('#ffffff');
    expect(small.boxShadow).toContain('16px #16a34a');
    expect(big.boxShadow).toContain('32px #16a34a');
    expect(big.inset).toBe(2 * small.inset);
  });
  it('reads its size from the data, with a default', () => {
    expect(pulseLookOf({ pulse_size: '30' }).size).toBe(30);
    expect(pulseLookOf({}).size).toBe(16);
  });
});
