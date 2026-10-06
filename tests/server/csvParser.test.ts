// The server's one CSV reader (processGameData.parseCsvWithHeaders). Pins the
// quoted-line-break rule whose absence trapped games on teacher-authored spaces
// (editor review 2026-10-05, R1).
import { describe, it, expect } from 'vitest';
import { parseCsvRecords, parseCsvWithHeaders, toCsv } from '../../server/processGameData.js';

describe('parseCsvWithHeaders', () => {
  it('reads a plain file', () => {
    expect(parseCsvWithHeaders('a,b\n1,2\n3,4\n')).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  });

  it('keeps a line break inside a quoted field in one row', () => {
    const rows = parseCsvWithHeaders('name,story,exit\nX,"line one\nline two",NEXT\nY,plain,OTHER\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'X', story: 'line one\nline two', exit: 'NEXT' });
    expect(rows[1].exit).toBe('OTHER');
  });

  it('keeps commas and "" inside quotes', () => {
    const rows = parseCsvWithHeaders('a,b\n"x, y","say ""hi"""\n');
    expect(rows[0]).toEqual({ a: 'x, y', b: 'say "hi"' });
  });

  it('handles CRLF line endings and a BOM', () => {
    const rows = parseCsvWithHeaders('﻿a,b\r\n1,"two\r\nlines"\r\n');
    expect(rows).toEqual([{ a: '1', b: 'two\r\nlines' }]);
  });

  it('survives a stray lone CR before a field (DiceRoll Info.csv has one in every row)', () => {
    const rows = parseCsvWithHeaders('a,b,button_label\n1,2,\rGo\n');
    expect(rows[0].button_label).toBe('Go');
  });

  it('falls back to line-by-line when a quote is never closed, instead of swallowing the file', () => {
    const rows = parseCsvWithHeaders('a,b\n1,"oops\n3,4\n');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some(r => r.a === '3' && r.b === '4')).toBe(true);
  });

  it('round-trips what toCsv writes, including line breaks, commas and quotes', () => {
    const rows = [{ a: 'one\ntwo', b: 'x, "y"', c: 'z' }, { a: 'plain', b: '', c: 'end' }];
    const back = parseCsvWithHeaders(toCsv(rows, ['a', 'b', 'c']));
    expect(back).toEqual(rows);
  });

  it('parseCsvRecords returns [] for empty text', () => {
    expect(parseCsvRecords('')).toEqual([]);
    expect(parseCsvRecords('  \n ')).toEqual([]);
  });
});
