#!/usr/bin/env node
// scripts/regen-clean-files.mjs
// Run the processGameData pipeline locally so CLEAN_FILES are regenerated
// from public/data/SOURCE_FILES. The pipeline is normally invoked from
// server.js on editor saves, but a CLI wrapper is useful after batch CSV
// edits (voice rewrite merge, etc.).

import { readFileSync } from 'fs';
import { join } from 'path';
import { processGameData } from '../server/processGameData.js';

const ROOT = process.cwd();
const SRC = join(ROOT, 'public/data/SOURCE_FILES');
const OUT = join(ROOT, 'public/data/CLEAN_FILES');

const spacesCsv = readFileSync(join(SRC, 'Spaces.csv'), 'utf-8');
const diceRollCsv = readFileSync(join(SRC, 'DiceRoll Info.csv'), 'utf-8');
let modalConfigCsv = null;
try {
  modalConfigCsv = readFileSync(join(SRC, 'ModalConfig.csv'), 'utf-8');
} catch {
  // ok if missing
}

console.log(`Regenerating CLEAN_FILES from ${SRC} → ${OUT}`);
const results = processGameData(spacesCsv, diceRollCsv, OUT, modalConfigCsv);
console.log(`Done. ${results.length} files written.`);
