// tests/server/textLimits.test.ts
// The text caps (v3.8.6) and the client's matching maxLength numbers.

import { describe, it, expect } from 'vitest';
import { TEXT_LIMITS, findOverlongText, findOverlongCsvCell, overlongMessage } from '../../server/textLimits.js';
import { TEXT_LIMITS as CLIENT_LIMITS } from '../../src/components/classroom/textLimits';

describe('findOverlongText', () => {
  it('passes text at the cap and refuses one character more', () => {
    expect(findOverlongText({ story: 'x'.repeat(2000) })).toBeNull();
    expect(findOverlongText({ story: 'x'.repeat(2001) })).toEqual({ field: 'story', length: 2001, limit: 2000 });
  });

  it('gives names, titles, times and fees the short cap', () => {
    for (const field of ['displayName', 'Title', 'time', 'fee', 'Time', 'Fee']) {
      expect(findOverlongText({ [field]: 'x'.repeat(200) })).toBeNull();
      expect(findOverlongText({ [field]: 'x'.repeat(201) })?.limit).toBe(200);
    }
  });

  it('looks inside nested objects and arrays (copy rows, insertion patches)', () => {
    expect(findOverlongText({ patch: { story: 'x'.repeat(2001) } })?.field).toBe('story');
    expect(findOverlongText({ rows: [{ Event: 'ok' }, { Event: 'x'.repeat(2001) }] })?.field).toBe('Event');
  });

  it('skips whole CSV files and the password (checked elsewhere / not text)', () => {
    expect(findOverlongText({ spacesCSV: 'x'.repeat(50_000), password: 'x'.repeat(5000) })).toBeNull();
  });

  it('ignores numbers, booleans and null', () => {
    expect(findOverlongText({ feePercent: 5, dryRun: true, fee: null })).toBeNull();
  });
});

describe('findOverlongCsvCell', () => {
  it('checks every cell against its column cap', () => {
    expect(findOverlongCsvCell('space_name,Event\nA,short\n')).toBeNull();
    expect(findOverlongCsvCell(`space_name,Event\nA,${'x'.repeat(2001)}\n`)?.field).toBe('Event');
    expect(findOverlongCsvCell(`space_name,Title\nA,${'x'.repeat(201)}\n`)?.limit).toBe(200);
  });

  it('passes the shipped board files unchanged', async () => {
    const fs = await import('node:fs');
    for (const f of ['Spaces.csv', 'DiceRoll Info.csv', 'ModalConfig.csv']) {
      const csv = fs.readFileSync(`public/data/SOURCE_FILES/${f}`, 'utf8');
      expect(findOverlongCsvCell(csv), f).toBeNull();
    }
  });
});

describe('overlongMessage', () => {
  it('says what is wrong in plain words', () => {
    expect(overlongMessage({ field: 'story', length: 5_000_000, limit: 2000 })).toBe(
      'The story is too long (5,000,000 characters). Please keep it under 2,000 characters and save again.');
    expect(overlongMessage({ field: 'displayName', length: 201, limit: 200 })).toMatch(/^The name is too long/);
  });
});

it('the client maxLength numbers match the server caps', () => {
  expect(CLIENT_LIMITS).toEqual({ ...TEXT_LIMITS });
});
