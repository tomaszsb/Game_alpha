// tests/server/pipelineFaithful.test.ts
//
// The pipeline must be able to REPRODUCE the committed CLEAN_FILES from the
// committed SOURCE_FILES. Anything it cannot reproduce is an "orphan" edit --
// a value written straight into a generated file -- and the next regeneration
// silently deletes it.
//
// That is not hypothetical. Three such edits were found on 2026-08-22, and all
// three had ALREADY been erased on the live server, which regenerates on every
// content save:
//   - SPACE_EFFECTS fee_type: the bank's tiered loan fee reverted to a flat
//     percentage, so live was charging the wrong money.
//   - DICE_EFFECTS fee_category: which bucket a fee is spent from, gone.
//   - GAME_CONFIG npc_speaker / approval_role: the CSV-portability lift's own
//     data, gone, leaving those features stuck on hardcoded fallbacks.
//
// This test is the guard. If it fails, do NOT fix the CLEAN file by hand --
// that is what created the problem. Fix the pipeline, or put the value in a
// SOURCE column the pipeline reads.

import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { processGameData } from '../../server/processGameData.js';

const SOURCE = join(process.cwd(), 'public', 'data', 'SOURCE_FILES');
const CLEAN = join(process.cwd(), 'public', 'data', 'CLEAN_FILES');

describe('the pipeline reproduces the committed CLEAN files', () => {
  const out = mkdtempSync(join(tmpdir(), 'pipeline-faithful-'));
  processGameData(
    readFileSync(join(SOURCE, 'Spaces.csv'), 'utf-8'),
    readFileSync(join(SOURCE, 'DiceRoll Info.csv'), 'utf-8'),
    out,
    readFileSync(join(SOURCE, 'ModalConfig.csv'), 'utf-8'),
  );

  const norm = (t: string) => t.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd();

  for (const file of readdirSync(out).filter(f => f.endsWith('.csv'))) {
    it(`${file} regenerates byte-for-byte`, () => {
      const generated = norm(readFileSync(join(out, file), 'utf-8'));
      const committed = norm(readFileSync(join(CLEAN, file), 'utf-8'));
      expect(generated).toBe(committed);
    });
  }
});
