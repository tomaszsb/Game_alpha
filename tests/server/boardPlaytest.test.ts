// "Check my board" (Job 4): the plain-words verdict, the one-at-a-time runner, and two real runs of the
// ghost bot in a child process (a good board finishes; a board with a dead-end loop is reported stuck).
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizePlaytest, createPlaytestRunner } from '../../server/boardPlaytest.js';

const g = (reason: string, extra: Record<string, unknown> = {}) => ({ type: 'game', reason, ...extra });

describe('summarizePlaytest', () => {
  it('all finished = ok', () => {
    const s = summarizePlaytest([g('FINISHED'), g('FINISHED'), g('FINISHED')]);
    expect(s.verdict).toBe('ok');
    expect(s.problems).toEqual([]);
    expect(s.counts).toMatchObject({ games: 3, finished: 3 });
  });

  it('a lost game (ran out of money) is the game working, not a board fault', () => {
    const s = summarizePlaytest([g('FINISHED'), g('LOST', { lossReason: 'bankruptcy' }), g('FINISHED')]);
    expect(s.verdict).toBe('ok');
    expect(s.counts.lost).toBe(1);
    expect(s.lostNote).toMatch(/normal play/);
  });

  it('a stuck game names where it went round in circles', () => {
    const s = summarizePlaytest([g('FINISHED'), g('LOOP', { finalSpace: 'AUTH-1' }), g('TURN_CAP', { finalSpace: 'AUTH-1' })]);
    expect(s.verdict).toBe('problem');
    expect(s.problems[0].code).toBe('STUCK');
    expect(s.problems[0].spaces).toEqual(['AUTH-1']);
    expect(s.problems[0].message).toContain('2 of 3');
  });

  it('a crash is a problem and carries the error', () => {
    const s = summarizePlaytest([g('EXCEPTION', { error: 'boom' })]);
    expect(s.verdict).toBe('problem');
    expect(s.problems[0].message).toContain('boom');
  });

  it('nobody finished and nobody stuck is unclear, not a pass', () => {
    expect(summarizePlaytest([g('LOST'), g('LOST')]).verdict).toBe('unclear');
    expect(summarizePlaytest([]).verdict).toBe('unclear');
  });
});

describe('createPlaytestRunner (fake child process)', () => {
  function fakeSpawn() {
    const child: any = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => { child.emit('close', null); };
    const calls: any[] = [];
    const spawn = (...args: any[]) => { calls.push(args); return child; };
    return { child, spawn, calls };
  }

  it('collects game lines, ignores log noise, and ends with a summary', () => {
    const { child, spawn, calls } = fakeSpawn();
    const runner = createPlaytestRunner({ spawn });
    runner.start('room-1', '/some/CLEAN_FILES', { games: 2, seats: 2 });
    expect(calls[0][1].slice(-4)).toEqual(['/some/CLEAN_FILES', '2', '2', '424242']);
    child.stdout.emit('data', Buffer.from('CARD_TYPES.csv has no column\n{"type":"game","reason":"FINISHED"}\n{"type":"gam'));
    child.stdout.emit('data', Buffer.from('e","reason":"LOOP","finalSpace":"X"}\n{"type":"done"}\n'));
    child.emit('close', 0);
    const job = runner.get('room-1');
    expect(job.status).toBe('done');
    expect(job.results.length).toBe(2);
    expect(job.summary.verdict).toBe('problem');
    expect(job.child).toBeUndefined();
  });

  it('allows one check at a time on the whole server', () => {
    const { spawn } = fakeSpawn();
    const runner = createPlaytestRunner({ spawn });
    runner.start('a', '/x');
    expect(() => runner.start('b', '/x')).toThrow(/right now/);
    expect(() => runner.start('a', '/x')).toThrow(/already running/);
  });

  it('a child that dies early is an error, not a verdict on the board', () => {
    const { child, spawn } = fakeSpawn();
    const runner = createPlaytestRunner({ spawn });
    runner.start('a', '/x');
    child.emit('close', 1);
    const job = runner.get('a');
    expect(job.status).toBe('error');
    expect(job.summary.verdict).toBe('unclear');
    expect(runner.isBusy()).toBe(false);
  });

  it('clamps games and seats', () => {
    const { spawn, calls } = fakeSpawn();
    createPlaytestRunner({ spawn }).start('a', '/x', { games: 99, seats: 99 });
    expect(calls[0][1].slice(-3, -1)).toEqual(['6', '4']);
  });
});

describe('the real bot in a child process', () => {
  const stock = path.join(process.cwd(), 'public', 'data', 'CLEAN_FILES');

  function run(cleanDir: string, games: number): Promise<any> {
    const runner = createPlaytestRunner();
    runner.start('real', cleanDir, { games, seats: 1 });
    return new Promise((resolve) => {
      const t = setInterval(() => {
        const j = runner.get('real');
        if (j.status !== 'running') { clearInterval(t); resolve(j); }
      }, 500);
    });
  }

  it('plays the stock board to the end', async () => {
    const job = await run(stock, 1);
    expect(job.error).toBeNull();
    expect(job.status).toBe('done');
    expect(job.results[0].reason === 'FINISHED' || job.results[0].reason === 'LOST').toBe(true);
    expect(job.results[0].ms).toBeGreaterThan(0);
  }, 180_000);

  it('reports a board whose first space leads back to itself as stuck', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boardcheck-'));
    try {
      for (const f of fs.readdirSync(stock)) {
        if (f.endsWith('.csv')) fs.copyFileSync(path.join(stock, f), path.join(tmp, f));
      }
      const mv = path.join(tmp, 'MOVEMENT.csv');
      const text = fs.readFileSync(mv, 'utf-8').replace(
        /^OWNER-SCOPE-INITIATION,First,fixed,OWNER-FUND-INITIATION/m,
        'OWNER-SCOPE-INITIATION,First,fixed,OWNER-SCOPE-INITIATION',
      );
      fs.writeFileSync(mv, text);
      const job = await run(tmp, 1);
      expect(job.status).toBe('done');
      expect(job.summary.verdict).toBe('problem');
      expect(job.summary.problems[0].code === 'STUCK' || job.summary.problems[0].code === 'BROKEN').toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 300_000);
});
