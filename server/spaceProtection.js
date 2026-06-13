// server/spaceProtection.js
// Teacher instance layer, Phase 2 (docs/core/TEACHER_LAYER_DESIGN.md).
//
// Which spaces a teacher may NOT switch off, and why. Spec: "Protection is
// two-tier, rolled out gradually":
//
//   structural   — start, end, resume hubs. Never disableable; a board
//                  without an entrance or exit is broken, not strict.
//   semantic     — spaces engine features depend on (hardcoded references
//                  in gameplay services). Protected at Phase 2 launch
//                  (auditor #4: naive degradation cascades). Features
//                  graduate to disableable one at a time, each gated by a
//                  ghost-batch run — when one graduates, remove it here.
//   path-choice  — conditionally protected WHILE a space participates in
//                  path-choice topology (memory keys, lock points,
//                  PATH_CHOICE_RULES rows). Guards against silent intent
//                  corruption: player picks Left, game delivers Right.
//
// Pure module; the resolver's validation calls computeProtection.

import { parseCsvWithHeaders } from './processGameData.js';

// Grep audit of src/services + src/hooks, 2026-06-12 (cross-checked against
// GAME_CONFIG.csv): every full space name the engine references in code.
// tests/server/spaceProtection.test.ts re-runs this audit and fails if the
// code grows a reference this list doesn't have.
export const SEMANTIC_ANCHORS = [
  'ARCH-INITIATION',
  'BANK-FUND-REVIEW',
  'CHEAT-BYPASS',
  'CON-INITIATION',
  'ENG-INITIATION',
  'INVESTOR-FUND-REVIEW',
  'OWNER-FUND-INITIATION',
  'OWNER-SCOPE-INITIATION',
  'PM-DECISION-CHECK',
  'REG-DOB-AUDIT',
  'REG-DOB-FINAL-REVIEW',
  'REG-DOB-PLAN-EXAM',
  'REG-DOB-TYPE-SELECT',
  'REG-FDNY-FEE-REVIEW',
  'REG-FDNY-PLAN-EXAM',
  'START-QUICK-PLAY-GUIDE',
];

function isYes(value) {
  return String(value || '').trim().toLowerCase() === 'yes';
}

/**
 * Compute the protection map for the current stock.
 * @param {{ stockSpacesCsv: string, pathChoiceCsv?: string }} args
 * @returns {Map<string, { tier: 'structural'|'semantic'|'path-choice', reason: string }>}
 */
export function computeProtection({ stockSpacesCsv, pathChoiceCsv }) {
  const protection = new Map();
  const protect = (name, tier, reason) => {
    // First tier wins; structural is computed first and outranks the rest.
    if (name && !protection.has(name)) protection.set(name, { tier, reason });
  };

  const spaceRows = parseCsvWithHeaders(stockSpacesCsv);

  for (const row of spaceRows) {
    const name = (row.space_name || '').trim();
    if (!name) continue;
    if (isYes(row.is_starting_space)) protect(name, 'structural', 'starting space');
    if (isYes(row.is_ending_space)) protect(name, 'structural', 'ending space');
    if (isYes(row.is_resume_hub)) protect(name, 'structural', 'resume hub');
  }

  for (const name of SEMANTIC_ANCHORS) {
    protect(name, 'semantic', 'an engine feature depends on this space (Phase 2 launch protection; graduates via ghost-batch gate)');
  }

  for (const row of spaceRows) {
    const name = (row.space_name || '').trim();
    if (!name) continue;
    if ((row.path_choice_memory_key || '').trim()) {
      protect(name, 'path-choice', `carries path-choice memory key "${row.path_choice_memory_key.trim()}"`);
    }
    if (isYes(row.is_path_choice_lock_point)) {
      protect(name, 'path-choice', 'is a path-choice lock point');
    }
  }

  if (pathChoiceCsv) {
    for (const row of parseCsvWithHeaders(pathChoiceCsv)) {
      protect((row.affected_space || '').trim(), 'path-choice', 'path-choice rules apply at this space');
      protect((row.chosen_value || '').trim(), 'path-choice', 'is a rememberable path choice');
      protect((row.excluded_destination || '').trim(), 'path-choice', 'is excluded by a remembered path choice');
    }
  }

  return protection;
}
