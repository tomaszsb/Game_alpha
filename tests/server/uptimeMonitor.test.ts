import { describe, it, expect } from 'vitest';
import { decideUptime, FAILS_BEFORE_ALERT } from '../../server/uptimeMonitor.js';

const T0 = '2026-10-14T12:00:00.000Z';
const at = (min: number) => new Date(Date.parse(T0) + min * 60000).toISOString();

describe('decideUptime (the outside uptime check)', () => {
  it('stays quiet while everything answers', () => {
    expect(decideUptime(null, true, T0)).toEqual({ state: { fails: 0, alerted: false, downSince: null }, alert: null });
  });

  it('one or two misses do not text anyone (a restart is not an outage)', () => {
    let s: any = null;
    for (let i = 0; i < FAILS_BEFORE_ALERT - 1; i++) {
      const r = decideUptime(s, false, at(i * 5));
      expect(r.alert).toBeNull();
      s = r.state;
    }
    expect(s.fails).toBe(FAILS_BEFORE_ALERT - 1);
  });

  it('the third miss in a row texts once, with when it started', () => {
    let s: any = null;
    let sent: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = decideUptime(s, false, at(i * 5));
      if (r.alert) sent.push(r.alert);
      s = r.state;
    }
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('DOWN');
    expect(sent[0]).toContain(T0);
  });

  it('a miss followed by an answer resets the count', () => {
    const a = decideUptime(null, false, T0);
    const b = decideUptime(a.state, true, at(5));
    expect(b.state.fails).toBe(0);
    expect(b.alert).toBeNull();
  });

  it('texts again when it is back, with how long it was down, then goes quiet', () => {
    let s: any = null;
    for (let i = 0; i < 3; i++) s = decideUptime(s, false, at(i * 5)).state;
    const back = decideUptime(s, true, at(30));
    expect(back.alert).toContain('back up');
    expect(back.alert).toContain('30 min');
    expect(decideUptime(back.state, true, at(35)).alert).toBeNull();
  });
});
