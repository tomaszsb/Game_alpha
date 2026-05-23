// src/utils/boardCommon.ts
//
// Shared visual helpers for board rendering. Extracted from the retired
// BoardV3 lineage (src/utils/boardLayout.ts, deleted in v3.0.0) so that the
// surviving renderer (BoardCanvas) can import them from a small,
// purpose-built module.
//
// What survived the retirement:
//  - PHASE_COLORS — phase → border/text color tokens. Used for tile borders,
//    legend swatches, and the small phase strip in BoardCanvas custom nodes.
//  - shortName(spaceName) — strip the NPC prefix and Title-Case what remains
//    so the board tile shows "Fee Review" instead of "ARCH-FEE-REVIEW".
//    Falls back to SPECIAL_NAMES for spaces that need a hand-tuned label.
//  - truncate(text, max) — append an ellipsis when text exceeds max chars.
//
// What we deliberately left behind in v3.0.0:
//  - BOARD, PATH_*, EDGES, etc. — the snake/zig-zag layout walker that
//    BoardV3 used. BoardCanvas reads `pos_x`/`pos_y` from GAME_CONFIG.csv
//    directly via dataService.getPosition(), so the walker is dead code.
//  - PHASE_RANK, branchFamily, flattenBranchNodes — only consumed by the
//    walker that's no longer needed.
//  - ConfigRow / MovementRow / Point / etc. — duplicated locally in the
//    deleted boardLayout.ts; the canonical shapes live in src/types/.
//  - parseCSVLine / parseCSV — DataService has its own CSV parser; the
//    walker's standalone copy went with it.

// SPECIAL_NAMES lets us override a space's auto-generated short label. Used
// when the prefix-stripped form is ambiguous, awkward, or has historical
// product naming we want to preserve.
const SPECIAL_NAMES: Record<string, string> = {
  'FINISH': 'Finish',
  'PM-DECISION-CHECK': 'PM Check',
  // START-QUICK-PLAY-GUIDE entry retained for completeness even though the
  // space is filtered out of the board in BoardCanvas (v2.69.8). Any other
  // surface that still references its short name keeps working.
  'START-QUICK-PLAY-GUIDE': 'Quick Play',
  'BANK-FUND-REVIEW': 'Bank Review',
  'INVESTOR-FUND-REVIEW': 'Investor Review',
};

// NPC-prefix detection used by shortName(). Prefixes are matched longest-first
// (REG-DOB- before REG-) by virtue of the data — REG-DOB-/REG-FDNY- both
// appear before any bare REG- would, and there's no bare REG- in the data.
// Add to the list when introducing a new character namespace.
const NPC_PREFIXES = [
  'OWNER-', 'ARCH-', 'ENG-', 'REG-DOB-', 'REG-FDNY-', 'CON-', 'PM-',
  'LEND-', 'BANK-', 'INVESTOR-', 'CHEAT-',
];

/**
 * Phase → border + text color tokens. Drives:
 *  - Tile border colors in BoardCanvas custom nodes.
 *  - Phase legend swatches.
 *  - Per-phase background regions where used.
 *
 * Keep aligned with the phase order in GAME_CONFIG.csv. Adding a new phase
 * here without also wiring it into the GameConfig schema will leave the
 * tile rendering with a fallback gray border (#adb5bd).
 */
export const PHASE_COLORS: Record<string, { border: string; text: string }> = {
  'SETUP':        { border: '#2196F3', text: '#1565c0' },
  'OWNER':        { border: '#2196F3', text: '#1565c0' },
  'FUNDING':      { border: '#FF9800', text: '#f57f17' },
  'DESIGN':       { border: '#9C27B0', text: '#7b1fa2' },
  'REGULATORY':   { border: '#f44336', text: '#c62828' },
  'CONSTRUCTION': { border: '#4CAF50', text: '#2e7d32' },
  'END':          { border: '#009688', text: '#00695c' },
};

/**
 * Convert a CSV space name (e.g. "ARCH-FEE-REVIEW") into the short
 * display label rendered on board tiles ("Fee Review"). Steps:
 *  1. If SPECIAL_NAMES has an override, use it verbatim.
 *  2. Strip the leading NPC prefix (ARCH-, REG-DOB-, etc.) if present.
 *  3. Title-Case the remaining hyphen-separated tokens, leaving short
 *     tokens (≤2 chars, e.g. "PM") as-is.
 *
 * The display_label_override column on GAME_CONFIG.csv takes precedence
 * over this helper in the actual render path; shortName is the fallback
 * for spaces without a hand-picked override.
 */
export function shortName(s: string): string {
  if (SPECIAL_NAMES[s]) return SPECIAL_NAMES[s];
  let name = s;
  for (const p of NPC_PREFIXES) {
    if (name.startsWith(p)) { name = name.slice(p.length); break; }
  }
  return name.split('-').map(w =>
    w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.toLowerCase().slice(1)
  ).join(' ');
}

/**
 * Append a Unicode ellipsis when text exceeds max characters. Used for
 * tile-tooltip story and action snippets in BoardCanvas.
 */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}
