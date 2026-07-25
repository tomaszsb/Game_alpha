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

/**
 * fb:0cdd59ba — "next to space name I should see some indicator if we have
 * been here before." Counts how many times the player has ARRIVED at a space,
 * derived from their ordered spaceVisitLog (one entry is pushed per arrival in
 * MovementService). Returns 0 if never visited, 1 on the first visit, 2 on the
 * second, etc. The ActionCenterPanel header uses this to show a "Visit #N"
 * badge on return visits.
 */
export function computeVisitNumber(
  spaceVisitLog: ReadonlyArray<{ spaceName: string }>,
  spaceName: string,
): number {
  return spaceVisitLog.reduce((n, r) => (r.spaceName === spaceName ? n + 1 : n), 0);
}

/**
 * Friendly "you've been here before" badge label for the panel header, or null
 * when no badge should show (first visit). Gated on the engine's authoritative
 * `visitType` so the badge can never contradict the space's First/Subsequent
 * content; the visit number from the log just enriches the label when reliable.
 */
export function formatVisitBadge(
  visitType: 'First' | 'Subsequent',
  visitNumber: number,
): string | null {
  if (visitType !== 'Subsequent') return null;
  return visitNumber >= 2 ? `↩ Visit #${visitNumber}` : '↩ Return visit';
}

/**
 * fb — Playwright playtest, LOW: "a board tile's hover/expand narrative
 * still shows the First-visit copy even after a player has re-entered that
 * space." BoardCanvas renders the whole SHARED board, but visit history is
 * per-player, so "has this space been visited" needs a "whose perspective"
 * answer. Uses the same convention the component already applies to
 * isCurrent/displayStory (funding-token resolution): the CURRENT
 * (active-turn) player, i.e. whichever Player matches currentPlayerId.
 *
 * Returns 'First' when there's no active player (spectator/TV mode with no
 * currentPlayerId — matches the initial-node default so nothing crashes or
 * looks broken) or the active player hasn't visited this space yet;
 * 'Subsequent' once they have. Feeds directly into
 * dataService.getSpaceContent(spaceName, visitType) so the hover/expand
 * narrative can be refreshed on re-entry instead of staying frozen to the
 * First-visit copy baked into the initial node build.
 *
 * Pure so the visit-type resolution is unit-testable without rendering
 * React Flow — same reasoning as computeTileVisualState/resolveTileOverlap.
 */
export function resolveTileVisitType(
  activePlayer: { visitedSpaces?: string[] } | undefined,
  spaceName: string,
): 'First' | 'Subsequent' {
  return activePlayer?.visitedSpaces?.includes(spaceName) ? 'Subsequent' : 'First';
}

// fb:97fa9c75 — five-step size hierarchy so players see where they are and
// where they can go without needing to mouse-hover. The classic three-step
// machine (compact / hover / expanded) only used borders to distinguish
// current and valid-move tiles, which playtesters missed.
//
// Priority order (highest first):
//   editMode    — admin is dragging; force compact so React Flow drag stays
//                 predictable and tile pops don't fight the cursor.
//   expanded    — user clicked to lock; takes priority over everything else.
//   currentBig  — current player's tile; "fully expanded by default" per user.
//   hover       — mouse is over the tile (any tile, even the current one).
//   validMove   — current player can land here; "hover-sized by default."
//   compact     — everything else.
export type TileSize = 'compact' | 'validMove' | 'hover' | 'currentBig' | 'expanded';

export interface TileSizeInputs {
  isEditMode?: boolean;
  isExpanded?: boolean;
  isCurrent?: boolean;
  isHovered?: boolean;
  isValidMove?: boolean;
}

export interface TileVisualState {
  size: TileSize;
  width: number;
  minHeight: number;
  zIndex: number;
  storyMax: number;   // max story-snippet length for this size (ignored when showsFullText)
  showsStory: boolean;
  showsAction: boolean;
  // v3.0.27 (fb:97fa9c75): the current tile (and click-expanded tiles) render
  // their story + action description UNtruncated — they're "fully open" with
  // nothing left to reveal. Smaller sizes still truncate to storyMax.
  showsFullText: boolean;
}

export function computeTileVisualState(inputs: TileSizeInputs): TileVisualState {
  const size: TileSize =
    inputs.isEditMode ? 'compact'
    : inputs.isExpanded ? 'expanded'
    : inputs.isCurrent ? 'currentBig'
    : inputs.isHovered ? 'hover'
    : inputs.isValidMove ? 'validMove'
    : 'compact';

  // v3.0.27 (fb:97fa9c75): currentBig now matches the click-expanded footprint
  // (240×130) so the current tile is genuinely "fully open" by default —
  // clicking it no longer grows/rewraps it, because there's nothing more to show.
  const width =
    size === 'compact' ? 150
    : size === 'validMove' ? 180
    : size === 'hover' ? 200
    : size === 'currentBig' ? 240
    : 240;
  const minHeight =
    size === 'compact' ? 60
    : size === 'validMove' ? 90
    : size === 'hover' ? 100
    : size === 'currentBig' ? 130
    : 130;

  // Click-locked > current > hovered > valid-move > base. Keeps the user's
  // active click on top while ensuring the current-player tile peeks over
  // path edges and neighboring compact tiles.
  const zIndex =
    inputs.isExpanded ? 30
    : inputs.isCurrent ? 25
    : inputs.isHovered ? 20
    : inputs.isValidMove ? 5
    : 1;

  const storyMax =
    size === 'validMove' ? 50
    : size === 'hover' ? 60
    : size === 'currentBig' ? 80
    : 100;

  // currentBig + expanded show the full story and the action description with
  // no truncation. Other sizes truncate to storyMax and hide the action block.
  const showsFullText = size === 'currentBig' || size === 'expanded';

  return {
    size,
    width,
    minHeight,
    zIndex,
    storyMax,
    showsStory: size !== 'compact',
    showsAction: showsFullText,
    showsFullText,
  };
}

// fb:84da66be — board next-move arrows must match the player panel's
// destination choice. The panel offers MovementService.getValidMoves (the
// narrowed set: pathChoiceMemory + approval narrowing applied). The board used
// to draw a green arrow for every outgoing MOVEMENT.csv edge whenever its own
// validMoves snapshot hadn't loaded — a SUPERSET that reintroduced destinations
// the engine had narrowed away, so the board showed 4 arrows while the panel
// offered 2. This helper makes validMoves the single source of truth for
// next-move edges, with no superset fallback.
export interface BoardEdgeVisibility {
  /** All edge ids (`${source}__${target}`) the non-admin board should show. */
  allowedIds: Set<string>;
  /** The subset that are legal next moves out of the current space (green). */
  nextMoveIds: Set<string>;
}

/**
 * Compute which board edges a non-admin player should see: the legal next-move
 * edges out of their current space PLUS the route they've already walked.
 *
 * Next-move edges come ONLY from `validMoves`. When `validMoves` is empty
 * (player already moved this turn, a move is in flight, or the snapshot hasn't
 * loaded yet) NO next-move arrows are shown — we never fall back to the raw
 * outgoing-edge superset, which is what caused the board/panel desync
 * (fb:84da66be). Path-taken edges are the consecutive pairs in the visit log.
 *
 * @param currentSpace   the current player's space (edge source for next moves)
 * @param validMoves     legal destinations from MovementService.getValidMoves
 * @param spaceVisitLog  ordered visit records; consecutive pairs form the path
 */
export function computeVisibleEdgeIds(
  currentSpace: string,
  validMoves: string[],
  spaceVisitLog: ReadonlyArray<{ spaceName: string }>,
): BoardEdgeVisibility {
  const allowedIds = new Set<string>();
  const nextMoveIds = new Set<string>();

  for (const tgt of validMoves) {
    const id = `${currentSpace}__${tgt}`;
    allowedIds.add(id);
    nextMoveIds.add(id);
  }

  for (let i = 1; i < spaceVisitLog.length; i++) {
    const src = spaceVisitLog[i - 1].spaceName;
    const tgt = spaceVisitLog[i].spaceName;
    if (src !== tgt) allowedIds.add(`${src}__${tgt}`);
  }

  return { allowedIds, nextMoveIds };
}

// fb:97fa9c75 — sizes exposed so the BoardLayoutEditor's ghost buffer stays
// in lockstep with the runtime size hierarchy. MAX_INGRID is the largest
// size a tile reaches WITHOUT popover-floating; the click-locked "expanded"
// size is intentionally excluded because it floats above the grid (B-style)
// and doesn't physically need spacing.
export const BOARD_TILE_COMPACT = { w: 150, h: 60 };
// v3.0.27: currentBig grew to 240×130 (now == expanded footprint), so the
// largest in-grid tile the editor must leave room for matches that.
// 130 is only the *floor* — a tile with a long story/action grows taller than
// this (see estimateTileMaxIngridHeight). fb:a4c50822.
export const BOARD_TILE_MAX_INGRID = { w: 240, h: 130 };

/**
 * fb:a4c50822 — "tiles overlap despite buffers." The editor's buffer ghost used
 * a fixed 240×130 footprint, but a board tile in its largest in-grid state
 * (currentBig — full story + action text, see computeTileVisualState) grows
 * DOWNWARD to fit its content with no max height. A content-heavy tile (e.g.
 * REG Plan Exam's long FDNY blurb) therefore renders taller than the ghost, so
 * neighbors placed flush against the ghost still get overlapped.
 *
 * This estimates the worst-case in-grid rendered height from the tile's text so
 * the buffer ghost can grow to match. It's an approximation (no DOM measure):
 * we estimate wrapped-line counts at currentBig's content width + font sizes,
 * matching the BoardNode render in BoardCanvas.tsx. We round up and keep
 * BOARD_TILE_MAX_INGRID.h as the floor — over-reserving space is safe (the user
 * just leaves a little more room); under-reserving is what causes overlap.
 */
export interface TileHeightContent {
  title?: string;
  story?: string;
  action?: string;
  npcName?: string;
}

export function estimateTileMaxIngridHeight(content: TileHeightContent): number {
  // currentBig content box: 240 wide minus 10px horizontal padding each side.
  const CONTENT_W = BOARD_TILE_MAX_INGRID.w - 20; // 220
  // Approx chars-per-line for a sans-serif font: avg glyph ≈ 0.52em.
  const cpl = (fontPx: number) => Math.max(1, Math.floor(CONTENT_W / (fontPx * 0.52)));
  // Wrapped line count, honoring explicit newlines in authored copy.
  const lines = (text: string | undefined, fontPx: number): number => {
    if (!text) return 0;
    const perLine = cpl(fontPx);
    return text.split('\n').reduce((acc, seg) => acc + Math.max(1, Math.ceil(seg.length / perLine)), 0);
  };

  const PAD_Y = 8 + 8;            // top + bottom padding
  const PHASE_H = 11;            // phase label (fontSize 9, single line)
  const TITLE_LH = 14 * 1.2;    // title line height (isBig fontSize 14)
  const STORY_LH = 11 * 1.35;   // story line height
  const ACTION_LH = 10 * 1.35;  // action line height
  const GAP = 6;                // marginTop between blocks

  const titleLines = Math.max(1, lines(content.title, 14));
  const storyText = content.story
    ? (content.npcName ? `${content.npcName}: ${content.story}` : content.story)
    : '';
  const storyLines = lines(storyText, 11);
  const actionText = content.action ? `Next: ${content.action}` : '';
  const actionLines = lines(actionText, 10);

  let h = PAD_Y + PHASE_H + 2 + titleLines * TITLE_LH;
  if (storyLines > 0) h += GAP + storyLines * STORY_LH;
  if (actionLines > 0) h += GAP + actionLines * ACTION_LH;
  // A little slack for the player-token row / rounding so we never under-reserve.
  h += 10;

  return Math.max(BOARD_TILE_MAX_INGRID.h, Math.ceil(h));
}

export interface TileBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * fb:feedback-1782842971898-c73c35ca — "board node overlaps a tile, want a
 * way to force nodes not to overlap." Given a dragged tile's box and one
 * sibling's box, returns the (dx, dy) to add to the dragged box's position so
 * it just touches the sibling instead of crossing into it — or null if the
 * two boxes don't overlap at all. Resolves along whichever axis has the
 * SMALLER penetration (the "path of least resistance"), so a tile dragged
 * mostly-past a neighbor slides along its edge rather than snapping back the
 * way it came — it hugs the outline instead of being shoved through it.
 */
export function resolveTileOverlap(dragged: TileBox, other: TileBox): { dx: number; dy: number } | null {
  const overlapX = Math.min(dragged.x + dragged.w, other.x + other.w) - Math.max(dragged.x, other.x);
  const overlapY = Math.min(dragged.y + dragged.h, other.y + other.h) - Math.max(dragged.y, other.y);
  if (overlapX <= 0 || overlapY <= 0) return null;

  if (overlapX < overlapY) {
    const draggedCenterX = dragged.x + dragged.w / 2;
    const otherCenterX = other.x + other.w / 2;
    return { dx: draggedCenterX < otherCenterX ? -overlapX : overlapX, dy: 0 };
  }
  const draggedCenterY = dragged.y + dragged.h / 2;
  const otherCenterY = other.y + other.h / 2;
  return { dx: 0, dy: draggedCenterY < otherCenterY ? -overlapY : overlapY };
}

/**
 * fb:35daf1ba — dice spaces keep their destinations in DICE_OUTCOMES.csv (six
 * roll columns), not MOVEMENT.csv. The board edge graph needs the unique set so
 * a dice space gets static edges (e.g. CHEAT-BYPASS → REG-FDNY-FEE-REVIEW),
 * letting the path-taken line render after a player moves through it. Dedups
 * repeated rolls (CHEAT-BYPASS lands PM-DECISION-CHECK on both 5 and 6) and
 * drops blanks. Returns [] for a missing outcome.
 */
export function uniqueDiceDestinations(
  outcome: { roll_1?: string; roll_2?: string; roll_3?: string; roll_4?: string; roll_5?: string; roll_6?: string } | undefined,
): string[] {
  if (!outcome) return [];
  const rolls = [outcome.roll_1, outcome.roll_2, outcome.roll_3, outcome.roll_4, outcome.roll_5, outcome.roll_6];
  return Array.from(new Set(rolls.filter((d): d is string => !!d && d.trim().length > 0)));
}

// ===================================================================
// PC-mode camera memory (maintainer-forwarded review, 2026-07-14) —
// BoardCanvas.tsx uses these for its own two behaviors:
//   1. Space-size-based initial zoom instead of "fit everything": pick the
//      zoom that keeps a tile's on-screen size within
//      [TARGET_MIN_TILE_PX, TARGET_MAX_TILE_PX] via getViewportForBounds
//      (the same function React Flow's own `fitView` uses internally, just
//      given tile-legibility-derived min/max zoom instead of generic ones).
//   2. Remember the chosen zoom/pan per device (localStorage), keyed by a
//      cheap fingerprint of the board's own layout (node count + bounding
//      box) so a saved viewport is never blindly applied to a differently-
//      shaped board — a mismatch just falls through to a fresh fit.
// Pure/localStorage-only logic lives here (not in BoardCanvas.tsx) so it's
// unit-testable without rendering the React Flow component — same reasoning
// as computeTileVisualState/resolveTileOverlap above.
// ===================================================================

export const TARGET_MIN_TILE_PX = 80;
export const TARGET_MAX_TILE_PX = 200;
export const BOARD_VIEWPORT_STORAGE_KEY = 'ucBoardViewport';

/** Minimal shape needed from a React Flow node bounds computation —
 *  avoids a hard dependency on @xyflow/react's Node type here. */
export interface BoardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BoardViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Cheap fingerprint of a board's layout: node count + bounding box, rounded
 *  to whole pixels. Stable across renders (a saved viewport should still
 *  apply after a page reload); changes the instant the board's actual shape
 *  does (a different classroom layout, or a future board with more spaces),
 *  which is exactly when a saved viewport should NOT be reused. */
export function boardFingerprint(nodeCount: number, bounds: BoardBounds): string {
  return `${nodeCount}:${Math.round(bounds.x)}:${Math.round(bounds.y)}:${Math.round(bounds.width)}:${Math.round(bounds.height)}`;
}

/** Reads a saved viewport for this exact board fingerprint, or null if
 *  there's none, it's for a different board, or storage is unavailable/corrupt. */
export function readSavedViewport(fingerprint: string): BoardViewport | null {
  try {
    const raw = localStorage.getItem(BOARD_VIEWPORT_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { fingerprint?: string; viewport?: BoardViewport };
    if (saved?.fingerprint === fingerprint && saved.viewport) return saved.viewport;
  } catch {
    /* localStorage unavailable or corrupt — treat as no saved viewport */
  }
  return null;
}

/** Persists a viewport for this board fingerprint. Silently no-ops if
 *  localStorage is unavailable — the memory just won't persist this session. */
export function writeSavedViewport(fingerprint: string, viewport: BoardViewport): void {
  try {
    localStorage.setItem(BOARD_VIEWPORT_STORAGE_KEY, JSON.stringify({ fingerprint, viewport }));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

/** Pan-only camera target for TV auto-focus (fb:2b5b9f2a — "zoom should not
 *  change when I move"). Returns the center of the bounding box around the
 *  focus set's TILE CENTERS (position is a tile's top-left corner, so half a
 *  compact tile is added), or null when none of the focus ids resolve to a
 *  node. Pure so the follow-camera math is unit-testable without rendering
 *  React Flow; BoardCanvas passes the result to setCenter() at the current
 *  zoom instead of re-running fitView (whose recomputed zoom swung wildly
 *  turn to turn depending on how spread out each space's destinations are). */
export function computeFocusCenter(
  nodes: Array<{ id: string; position: { x: number; y: number } }>,
  focusIds: string[],
  tileW: number = BOARD_TILE_COMPACT.w,
  tileH: number = BOARD_TILE_COMPACT.h
): { x: number; y: number } | null {
  const wanted = new Set(focusIds);
  const pts = nodes
    .filter(n => wanted.has(n.id))
    .map(n => ({ x: n.position.x + tileW / 2, y: n.position.y + tileH / 2 }));
  if (pts.length === 0) return null;
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}
