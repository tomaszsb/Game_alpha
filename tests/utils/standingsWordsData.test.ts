// The standings and mat words are data (UI_STRINGS.csv), with code defaults (v3.7.21, Job 2).
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getUIString, configureUIStrings, _testOnly } from '../../src/constants/uiStrings';

const KEYS = ['TROPHY.theirTurn', 'TROPHY.finished', 'TROPHY.out', 'TROPHY.noReviews', 'TROPHY.noBudget', 'MAT.title'];
const csv = fs.readFileSync(path.join(__dirname, '../../public/data/CLEAN_FILES/UI_STRINGS.csv'), 'utf-8');

describe('standings and mat words', () => {
  afterEach(() => _testOnly.resetUIStringOverrides());

  it('the data file carries every one of them, with the same words as the code default', () => {
    for (const k of KEYS) {
      const line = csv.split(/\r?\n/).find(l => l.startsWith(k + ','));
      expect(line, k).toBeTruthy();
      expect(line!.slice(k.length + 1)).toBe(getUIString(k));
    }
  });

  it('the words are the ones players have always seen', () => {
    expect(KEYS.map(k => getUIString(k))).toEqual(['their turn', 'finished', 'out', 'No reviews yet', 'No budget yet', 'My project']);
  });

  it('a reskin can reword them in the file', () => {
    configureUIStrings([{ key: 'MAT.title', template: 'My quest' } as any]);
    expect(getUIString('MAT.title')).toBe('My quest');
  });
});
