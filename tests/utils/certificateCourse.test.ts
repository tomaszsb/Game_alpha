import { describe, it, expect } from 'vitest';
import { cleanClassAnswer } from '../../server/classAnswers.js';

describe('class answers: course', () => {
  const base = { name: 'Maya', gameCode: 'G-ABC', fun: {}, why: [] };
  it('saves 350 and 409, even with no other answers', () => {
    expect(cleanClassAnswer({ ...base, course: '350' }).record?.course).toBe('350');
    expect(cleanClassAnswer({ ...base, course: '409' }).record?.course).toBe('409');
  });
  it('refuses any other course', () => {
    expect(cleanClassAnswer({ ...base, course: '999' }).error).toBeTruthy();
  });
  it('old posts without a course still save', () => {
    const r = cleanClassAnswer({ ...base, fun: { playAgain: 'yes' } });
    expect(r.record?.course).toBe('');
  });
});
