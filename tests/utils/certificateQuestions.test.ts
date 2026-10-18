import { describe, it, expect } from 'vitest';
import { buildWhyQuestions } from '../../src/utils/certificateQuestions';
import { buildCertificateHtml } from '../../src/utils/certificate';
import { cleanClassAnswer, appendClassAnswer, readClassAnswers, MAX_ANSWER } from '../../server/classAnswers.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Tom, 2026-10-18 (Review Q4 + Q5): "why" questions from the student's own game.
// Numbers come from the game state, never typed into the wording; they ask WHY.
const base = {
  journey: [
    { spaceName: 'REG-FDNY-PLAN-EXAM', daysSpent: 30, entryTurn: 5 },
    { spaceName: 'ARCH-FEE-REVIEW', daysSpent: 50, entryTurn: 9 },
    { spaceName: 'REG-FDNY-PLAN-EXAM', daysSpent: 40, entryTurn: 12 },
  ],
  daysTotal: 502,
  money: (n: number) => `$${n.toLocaleString('en-US')}`,
  spaceTitle: (s: string) => ({ 'REG-FDNY-PLAN-EXAM': 'Fire Dept. Review', 'ARCH-FEE-REVIEW': "Architect's Fee" } as Record<string, string>)[s] ?? s,
};

describe('buildWhyQuestions', () => {
  it('late and over budget: asks why, with the real numbers', () => {
    const q = buildWhyQuestions({ ...base, row: { daysUsed: 502, daysPlanned: 330, moneySpent: 1_190_000, moneyPlanned: 1_020_000 } });
    expect(q.map(x => x.id)).toEqual(['time', 'longest-stop', 'money']);
    expect(q[0].question).toBe('Your project took 502 days. The plan was 330 days, so you finished 172 days late. What caused most of the delay?');
    // Visits to the same stop are added up: 30 + 40 = 70 at Fire Dept. Review beats 50.
    expect(q[1].question).toBe('You spent 70 days at Fire Dept. Review, more than at any other stop. Why did it take so long there?');
    expect(q[2].question).toContain('Where did the extra $170,000 go?');
  });

  it('on time and on budget: asks what went right', () => {
    const q = buildWhyQuestions({ ...base, row: { daysUsed: 300, daysPlanned: 330, moneySpent: 900_000, moneyPlanned: 1_000_000 } });
    expect(q[0].question).toContain('What did you do that kept it on time?');
    expect(q[2].question).toContain('What helped you stay on budget?');
  });

  it('never uses game words (die, card)', () => {
    const q = buildWhyQuestions({ ...base, row: { daysUsed: 502, daysPlanned: 330, moneySpent: 1, moneyPlanned: 2 } });
    for (const x of q) expect(x.question).not.toMatch(/\b(dice|die|roll|card)\b/i);
  });

  it('with no trophy row, still asks about time and the longest stop', () => {
    const q = buildWhyQuestions({ ...base, row: null });
    expect(q.map(x => x.id)).toEqual(['time', 'longest-stop']);
  });
});

describe('certificate prints the why answers', () => {
  it('shows answered questions, escaped; skips blank ones', () => {
    const html = buildCertificateHtml('Ada', new Date('2026-10-18T12:00:00Z'), [
      { question: 'Why so long?', answer: 'The <b>FDNY</b> sent me back' },
      { question: 'Unanswered?', answer: '   ' },
    ]);
    expect(html).toContain('Thinking it over');
    expect(html).toContain('The &lt;b&gt;FDNY&lt;/b&gt; sent me back');
    expect(html).not.toContain('Unanswered?');
  });
  it('no answers: no answers block', () => {
    expect(buildCertificateHtml('Ada', new Date())).not.toContain('Thinking it over');
  });
});

describe('cleanClassAnswer (server)', () => {
  it('keeps only name, game code, answers and date; drops anything else posted', () => {
    const { record } = cleanClassAnswer({ name: ' Ada ', gameCode: 'G-AB12-CD34', fun: { playAgain: 'Yes', bestPart: 'x' }, why: [], ip: '1.2.3.4', device: 'iPhone' }, new Date('2026-10-18T00:00:00Z'));
    expect(record).toEqual({ date: '2026-10-18T00:00:00.000Z', name: 'Ada', gameCode: 'G-AB12-CD34', fun: { playAgain: 'yes', mostBoring: '', bestPart: 'x' }, why: [] });
  });
  it('cuts long text instead of refusing it, and keeps at most 3 why answers', () => {
    const { record } = cleanClassAnswer({ name: 'A', fun: { bestPart: 'y'.repeat(5000) }, why: Array(6).fill({ question: 'q', answer: 'a' }) });
    expect(record!.fun.bestPart.length).toBe(MAX_ANSWER);
    expect(record!.why.length).toBe(3);
  });
  it('refuses empty answers, a bad play-again value, and junk', () => {
    expect(cleanClassAnswer({ name: 'A', fun: {} }).error).toBeTruthy();
    expect(cleanClassAnswer({ name: 'A', fun: { playAgain: 'perhaps' } }).error).toBeTruthy();
    expect(cleanClassAnswer(null).error).toBeTruthy();
    expect(cleanClassAnswer({ name: 'A', gameCode: '../../x', fun: { playAgain: 'no' } }).record!.gameCode).toBe('');
  });
  it('appends and reads back, newest first', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-ca-'));
    appendClassAnswer(dir, cleanClassAnswer({ name: 'First', fun: { playAgain: 'no' } }).record!);
    appendClassAnswer(dir, cleanClassAnswer({ name: 'Second', fun: { playAgain: 'yes' } }).record!);
    expect(readClassAnswers(dir).map((a: { name: string }) => a.name)).toEqual(['Second', 'First']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
