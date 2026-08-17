import { describe, it, expect } from 'vitest';
import { computeTileVisualState, shortName, truncate, computeVisibleEdgeIds, buildWaypointEdgePath, maxWaypointsForLength, computeSegmentMerges, findSnapTarget, computeHandleOffset, findEdgesAtPoint, computeAnchorPoint, nearestAnchor, findEdgesAtAnchor, DEFAULT_ANCHOR_SIDE, formatEdgeLabel, computeVisitNumber, formatVisitBadge, estimateTileMaxIngridHeight, BOARD_TILE_MAX_INGRID, uniqueDiceDestinations } from '../../src/utils/boardCommon';

// fb:97fa9c75 — five-step tile size hierarchy. Was a 3-step ladder where the
// current-player tile and valid-move tiles got only border treatment, which
// playtesters missed. Now the size *itself* signals "where I am" and "where
// I can go" — no mouse-hover required to read the board.

describe('computeTileVisualState', () => {
  it('plain tile is compact (150×60, z=1, no story, no action)', () => {
    const vs = computeTileVisualState({});
    expect(vs.size).toBe('compact');
    expect(vs.width).toBe(150);
    expect(vs.minHeight).toBe(60);
    expect(vs.zIndex).toBe(1);
    expect(vs.showsStory).toBe(false);
    expect(vs.showsAction).toBe(false);
  });

  it('valid-move tile is hover-sized BY DEFAULT — the core fb:97fa9c75 ask', () => {
    const vs = computeTileVisualState({ isValidMove: true });
    expect(vs.size).toBe('validMove');
    expect(vs.width).toBe(180);
    expect(vs.minHeight).toBe(90);
    expect(vs.zIndex).toBe(5); // peeks over compact neighbors
    expect(vs.showsStory).toBe(true);
  });

  it('current-player tile is fully expanded BY DEFAULT — the other half of fb:97fa9c75', () => {
    const vs = computeTileVisualState({ isCurrent: true });
    expect(vs.size).toBe('currentBig');
    // v3.0.27: grew to the click-expanded footprint so it's genuinely "fully
    // open" — clicking no longer reveals more.
    expect(vs.width).toBe(240);
    expect(vs.minHeight).toBe(130);
    expect(vs.zIndex).toBe(25);
    expect(vs.showsStory).toBe(true);
    expect(vs.showsFullText).toBe(true);
    expect(vs.showsAction).toBe(true);
  });

  it('hover bumps a plain tile to hover size', () => {
    const vs = computeTileVisualState({ isHovered: true });
    expect(vs.size).toBe('hover');
    expect(vs.width).toBe(200);
    expect(vs.minHeight).toBe(100);
  });

  it('click-to-expand shrank from 280×180 → 240×130 to reduce neighbor overlap', () => {
    const vs = computeTileVisualState({ isExpanded: true });
    expect(vs.size).toBe('expanded');
    expect(vs.width).toBe(240);
    expect(vs.minHeight).toBe(130);
    expect(vs.zIndex).toBe(30);
    expect(vs.showsAction).toBe(true);
  });

  it('priority: edit mode beats everything (compact for clean drag UX)', () => {
    const vs = computeTileVisualState({
      isEditMode: true,
      isExpanded: true,
      isCurrent: true,
      isValidMove: true,
      isHovered: true,
    });
    expect(vs.size).toBe('compact');
  });

  it('priority: expanded beats current (user click wins over default current treatment)', () => {
    const vs = computeTileVisualState({ isExpanded: true, isCurrent: true });
    expect(vs.size).toBe('expanded');
  });

  it('priority: current beats hover (the current-player visual is louder than a passive mouse-over)', () => {
    const vs = computeTileVisualState({ isCurrent: true, isHovered: true });
    expect(vs.size).toBe('currentBig');
  });

  it('priority: hover beats valid-move (mouse-over reveals more info)', () => {
    const vs = computeTileVisualState({ isHovered: true, isValidMove: true });
    expect(vs.size).toBe('hover');
  });

  it('story snippet length scales with size (50/60/80/100)', () => {
    expect(computeTileVisualState({ isValidMove: true }).storyMax).toBe(50);
    expect(computeTileVisualState({ isHovered: true }).storyMax).toBe(60);
    expect(computeTileVisualState({ isCurrent: true }).storyMax).toBe(80);
    expect(computeTileVisualState({ isExpanded: true }).storyMax).toBe(100);
  });

  it('current + expanded tiles show the action description block (v3.0.27)', () => {
    expect(computeTileVisualState({}).showsAction).toBe(false);
    expect(computeTileVisualState({ isValidMove: true }).showsAction).toBe(false);
    expect(computeTileVisualState({ isHovered: true }).showsAction).toBe(false);
    expect(computeTileVisualState({ isCurrent: true }).showsAction).toBe(true);
    expect(computeTileVisualState({ isExpanded: true }).showsAction).toBe(true);
  });

  it('showsFullText is true only for the current + click-expanded tiles (v3.0.27)', () => {
    expect(computeTileVisualState({}).showsFullText).toBe(false);
    expect(computeTileVisualState({ isValidMove: true }).showsFullText).toBe(false);
    expect(computeTileVisualState({ isHovered: true }).showsFullText).toBe(false);
    expect(computeTileVisualState({ isCurrent: true }).showsFullText).toBe(true);
    expect(computeTileVisualState({ isExpanded: true }).showsFullText).toBe(true);
  });
});

// fb:41e35769 — pin the friendly-name helper that ActionCenterPanel now uses
// to match the BoardCanvas tile label. (The display_label_override > shortName
// fallback chain lives in the callsite, not here; this just locks the
// fallback's behavior so a refactor doesn't accidentally break the rule.)
describe('shortName fallback (used by ActionCenterPanel space header)', () => {
  it('strips NPC prefix and Title-Cases the rest', () => {
    expect(shortName('ARCH-FEE-REVIEW')).toBe('Fee Review');
    expect(shortName('OWNER-FUND-INITIATION')).toBe('Fund Initiation');
    expect(shortName('REG-DOB-PLAN-EXAM')).toBe('Plan Exam');
  });

  it('uses SPECIAL_NAMES override when defined (PM-DECISION-CHECK → PM Check)', () => {
    expect(shortName('PM-DECISION-CHECK')).toBe('PM Check');
    expect(shortName('BANK-FUND-REVIEW')).toBe('Bank Review');
  });

  it('handles short tokens (≤2 chars) without uppercasing them awkwardly', () => {
    expect(shortName('CON-INITIATION')).toBe('Initiation');
  });
});

describe('formatEdgeLabel (restore-list UIs, 2026-08-04)', () => {
  it('formats a real edge id as "Source → Target" using shortName on each side', () => {
    expect(formatEdgeLabel('OWNER-SCOPE-INITIATION__OWNER-FUND-INITIATION')).toBe('Scope Initiation → Fund Initiation');
  });

  it('applies SPECIAL_NAMES overrides on either side', () => {
    expect(formatEdgeLabel('PM-DECISION-CHECK__BANK-FUND-REVIEW')).toBe('PM Check → Bank Review');
  });

  it('falls back to the raw id when it does not look like a real edge id', () => {
    expect(formatEdgeLabel('not-an-edge-id')).toBe('not-an-edge-id');
    expect(formatEdgeLabel('A__B__C')).toBe('A__B__C');
    expect(formatEdgeLabel('')).toBe('');
  });
});

describe('truncate (board tile story snippet helper)', () => {
  it('returns the string unchanged when shorter than max', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });

  it('appends a Unicode ellipsis when text exceeds max', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcde…');
  });
});

// fb:84da66be — board next-move arrows must match the player panel's choice.
// The board used to fall back to ALL outgoing edges when its validMoves
// snapshot was empty, drawing 4 arrows while the panel offered 2.
describe('computeVisibleEdgeIds (board/panel destination parity)', () => {
  it('draws a next-move edge for each validMove out of the current space', () => {
    const { allowedIds, nextMoveIds } = computeVisibleEdgeIds(
      'REG-DOB-TYPE-SELECT',
      ['REG-TYPE-SELECT', 'CON-INITIATION'],
      [],
    );
    expect(nextMoveIds).toEqual(new Set([
      'REG-DOB-TYPE-SELECT__REG-TYPE-SELECT',
      'REG-DOB-TYPE-SELECT__CON-INITIATION',
    ]));
    // allowedIds == nextMoveIds when there's no prior path.
    expect(allowedIds).toEqual(nextMoveIds);
  });

  it('does NOT add a superset when validMoves is narrowed (the fb:84da66be fix)', () => {
    // The raw MOVEMENT.csv edge set out of this space is 4 wide, but the engine
    // narrowed the legal moves to 2 (pathChoiceMemory / approval). The board
    // must reflect the 2 — never the raw 4.
    const narrowed = ['PM-DECISION-CHECK', 'REG-TYPE-SELECT'];
    const { nextMoveIds } = computeVisibleEdgeIds('REG-FDNY-FEE-REVIEW', narrowed, []);
    expect(nextMoveIds.size).toBe(2);
    expect(nextMoveIds.has('REG-FDNY-FEE-REVIEW__PLAN-EXAM-FDNY')).toBe(false);
    expect(nextMoveIds.has('REG-FDNY-FEE-REVIEW__CON-INITIATION')).toBe(false);
  });

  it('shows NO next-move arrows when validMoves is empty (no all-edges fallback)', () => {
    const { allowedIds, nextMoveIds } = computeVisibleEdgeIds('CON-INITIATION', [], []);
    expect(nextMoveIds.size).toBe(0);
    expect(allowedIds.size).toBe(0);
  });

  it('still includes path-taken edges from the visit log alongside next moves', () => {
    const { allowedIds, nextMoveIds } = computeVisibleEdgeIds(
      'REG-DOB-PLAN-EXAM',
      ['REG-FDNY-FEE-REVIEW'],
      [
        { spaceName: 'OWNER-SCOPE-INITIATION' },
        { spaceName: 'ARCH-INITIATION' },
        { spaceName: 'REG-DOB-PLAN-EXAM' },
      ],
    );
    // Next-move edge present and flagged green.
    expect(nextMoveIds.has('REG-DOB-PLAN-EXAM__REG-FDNY-FEE-REVIEW')).toBe(true);
    // Path-taken edges present in allowedIds but NOT flagged as next moves.
    expect(allowedIds.has('OWNER-SCOPE-INITIATION__ARCH-INITIATION')).toBe(true);
    expect(allowedIds.has('ARCH-INITIATION__REG-DOB-PLAN-EXAM')).toBe(true);
    expect(nextMoveIds.has('OWNER-SCOPE-INITIATION__ARCH-INITIATION')).toBe(false);
  });

  it('skips self-loops in the visit log (no A__A edges)', () => {
    const { allowedIds } = computeVisibleEdgeIds(
      'PM-DECISION-CHECK',
      [],
      [
        { spaceName: 'PM-DECISION-CHECK' },
        { spaceName: 'PM-DECISION-CHECK' },
        { spaceName: 'CON-INITIATION' },
      ],
    );
    expect(allowedIds.has('PM-DECISION-CHECK__PM-DECISION-CHECK')).toBe(false);
    expect(allowedIds.has('PM-DECISION-CHECK__CON-INITIATION')).toBe(true);
  });
});

// G160 (per-edge waypoint redirect, 2026-08-02; multi-bend 2026-08-04) — an
// admin-redirected edge bypasses A* auto-routing entirely and draws as
// straight segments through zero or more stored waypoints.
describe('buildWaypointEdgePath (G160 per-edge waypoint redirect)', () => {
  it('builds a two-segment path through a single waypoint', () => {
    const path = buildWaypointEdgePath(0, 0, [{ x: 50, y: 100 }], 200, 0);
    expect(path).toBe('M0,0 L50,100 L200,0');
  });

  it('handles negative and fractional coordinates the same way (no rounding)', () => {
    const path = buildWaypointEdgePath(-12.5, 4, [{ x: -3.25, y: -7 }], 88.1, 22);
    expect(path).toBe('M-12.5,4 L-3.25,-7 L88.1,22');
  });

  it('degenerates to a straight line when the waypoint sits exactly on source or target', () => {
    // Not a special case in the implementation, but worth pinning: dragging
    // the handle back onto an endpoint should render as a plain line, not
    // throw or produce a malformed path.
    const path = buildWaypointEdgePath(10, 10, [{ x: 10, y: 10 }], 90, 10);
    expect(path).toBe('M10,10 L10,10 L90,10');
  });

  it('chains multiple waypoints in order (multi-bend, 2026-08-04)', () => {
    const path = buildWaypointEdgePath(0, 0, [{ x: 20, y: 40 }, { x: 60, y: -10 }], 200, 0);
    expect(path).toBe('M0,0 L20,40 L60,-10 L200,0');
  });

  it('an empty waypoint list degenerates to a plain source-to-target line', () => {
    const path = buildWaypointEdgePath(0, 0, [], 200, 0);
    expect(path).toBe('M0,0 L200,0');
  });
});

// Multi-bend point cap, magnetic snapping, and manual bundling (2026-08-04).
describe('maxWaypointsForLength', () => {
  it('is always at least 1, even for a very short edge', () => {
    expect(maxWaypointsForLength(0, 0, 10, 0)).toBe(1);
    expect(maxWaypointsForLength(0, 0, 0, 0)).toBe(1);
  });

  it('scales with on-screen length at a 96-flow-unit "inch"', () => {
    expect(maxWaypointsForLength(0, 0, 96, 0)).toBe(1);
    expect(maxWaypointsForLength(0, 0, 192, 0)).toBe(2);
    expect(maxWaypointsForLength(0, 0, 300, 0)).toBe(3);
  });

  it('uses straight-line (Euclidean) distance regardless of axis', () => {
    // A 3-4-5 triangle scaled by 96: length 480 -> 5 inches.
    expect(maxWaypointsForLength(0, 0, 288, 384)).toBe(5);
  });
});

describe('computeSegmentMerges', () => {
  it('reports no merges when no other edge shares any interior segment', () => {
    const merges = computeSegmentMerges('A__B', [{ x: 10, y: 10 }, { x: 20, y: 20 }], {
      'A__B': [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      'C__D': [{ x: 99, y: 99 }, { x: 100, y: 100 }],
    });
    expect(merges).toEqual([[]]);
  });

  it('finds another edge sharing the same interior segment, order-independent', () => {
    const merges = computeSegmentMerges('A__B', [{ x: 10, y: 10 }, { x: 20, y: 20 }], {
      'A__B': [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      'C__D': [{ x: 20, y: 20 }, { x: 10, y: 10 }], // reversed order — still the same shared stretch
    });
    expect(merges).toEqual([['C__D']]);
  });

  it('never checks the first or last segment (those touch source/target, not just other waypoints)', () => {
    // Both edges have 3 waypoints (2 interior segments each); only the
    // middle one is genuinely interior-to-interior on both sides for A__B.
    const merges = computeSegmentMerges('A__B', [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }], {
      'A__B': [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }],
      'C__D': [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 30, y: 30 }],
    });
    // Segment 0 (0,0)-(10,10) is shared, segment 1 (10,10)-(20,20) is not (C__D's is (10,10)-(30,30)).
    expect(merges).toEqual([['C__D'], []]);
  });

  it('reports multiple sharing edges for the same segment', () => {
    const shared = [{ x: 10, y: 10 }, { x: 20, y: 20 }];
    const merges = computeSegmentMerges('A__B', shared, {
      'A__B': shared,
      'C__D': shared,
      'E__F': shared,
      'G__H': [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    });
    expect(merges).toEqual([['C__D', 'E__F']]);
  });

  it('tolerates tiny floating-point differences (sub-pixel) as the same point', () => {
    const merges = computeSegmentMerges('A__B', [{ x: 10, y: 10 }, { x: 20, y: 20 }], {
      'A__B': [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      'C__D': [{ x: 10.2, y: 9.9 }, { x: 20, y: 20 }],
    });
    expect(merges).toEqual([['C__D']]);
  });
});

describe('findSnapTarget', () => {
  it('returns the nearest other edge point within the threshold', () => {
    const target = findSnapTarget({ x: 100, y: 100 }, 'A__B', {
      'A__B': [{ x: 0, y: 0 }],
      'C__D': [{ x: 105, y: 103 }],
    });
    expect(target).toEqual({ x: 105, y: 103 });
  });

  it('returns null when nothing is within the threshold', () => {
    const target = findSnapTarget({ x: 100, y: 100 }, 'A__B', {
      'C__D': [{ x: 500, y: 500 }],
    });
    expect(target).toBeNull();
  });

  it('ignores its own edge\'s points', () => {
    const target = findSnapTarget({ x: 100, y: 100 }, 'A__B', {
      'A__B': [{ x: 101, y: 101 }],
    });
    expect(target).toBeNull();
  });

  it('picks the closest match when multiple are within range', () => {
    const target = findSnapTarget({ x: 100, y: 100 }, 'A__B', {
      'C__D': [{ x: 108, y: 100 }],
      'E__F': [{ x: 103, y: 100 }],
    });
    expect(target).toEqual({ x: 103, y: 100 });
  });
});

describe('computeHandleOffset', () => {
  it('is zero offset when nothing else shares the point', () => {
    expect(computeHandleOffset('A__B', [])).toEqual({ dx: 0, dy: 0 });
  });

  it('spreads siblings deterministically around a small circle', () => {
    const a = computeHandleOffset('A__B', ['C__D']);
    const b = computeHandleOffset('C__D', ['A__B']);
    expect(a).not.toEqual(b);
    // Both at the same radius from center.
    const radiusA = Math.hypot(a.dx, a.dy);
    const radiusB = Math.hypot(b.dx, b.dy);
    expect(radiusA).toBeCloseTo(5, 5);
    expect(radiusB).toBeCloseTo(5, 5);
  });

  it('is stable across calls regardless of argument order (alphabetical, not insertion order)', () => {
    const first = computeHandleOffset('B__B', ['A__A', 'C__C']);
    const second = computeHandleOffset('B__B', ['C__C', 'A__A']);
    expect(first).toEqual(second);
  });
});

describe('findEdgesAtPoint', () => {
  it('finds every other edge with a waypoint at the exact coordinate', () => {
    const found = findEdgesAtPoint({ x: 10, y: 10 }, 'A__B', {
      'A__B': [{ x: 10, y: 10 }],
      'C__D': [{ x: 10, y: 10 }],
      'E__F': [{ x: 99, y: 99 }],
    });
    expect(found).toEqual(['C__D']);
  });

  it('returns [] when no other edge shares the point', () => {
    const found = findEdgesAtPoint({ x: 10, y: 10 }, 'A__B', {
      'A__B': [{ x: 10, y: 10 }],
      'C__D': [{ x: 99, y: 99 }],
    });
    expect(found).toEqual([]);
  });

  it('tolerates tiny floating-point differences within epsilon', () => {
    const found = findEdgesAtPoint({ x: 10, y: 10 }, 'A__B', {
      'C__D': [{ x: 10.3, y: 9.8 }],
    });
    expect(found).toEqual(['C__D']);
  });
});

// Box-side anchor snapping (2026-08-04) — a connector's start/end can be
// pinned to one of a node's 4 side-middle points, instead of the automatic
// floating attach point, deliberately just these 4, not free placement.
describe('computeAnchorPoint', () => {
  const box = { x: 100, y: 200, width: 150, height: 60 };

  it('top is horizontally centered, at the node\'s own y', () => {
    expect(computeAnchorPoint(box.x, box.y, box.width, box.height, 'top')).toEqual({ x: 175, y: 200 });
  });

  it('bottom is horizontally centered, at y + height', () => {
    expect(computeAnchorPoint(box.x, box.y, box.width, box.height, 'bottom')).toEqual({ x: 175, y: 260 });
  });

  it('left is vertically centered, at the node\'s own x', () => {
    expect(computeAnchorPoint(box.x, box.y, box.width, box.height, 'left')).toEqual({ x: 100, y: 230 });
  });

  it('right is vertically centered, at x + width', () => {
    expect(computeAnchorPoint(box.x, box.y, box.width, box.height, 'right')).toEqual({ x: 250, y: 230 });
  });
});

describe('nearestAnchor', () => {
  const box = { x: 100, y: 200, width: 150, height: 60 };

  it('picks top when the point is well above the box', () => {
    const result = nearestAnchor({ x: 175, y: 0 }, box.x, box.y, box.width, box.height);
    expect(result.anchor).toBe('top');
    expect(result.point).toEqual({ x: 175, y: 200 });
  });

  it('picks right when the point is well to the right', () => {
    const result = nearestAnchor({ x: 500, y: 230 }, box.x, box.y, box.width, box.height);
    expect(result.anchor).toBe('right');
  });

  it('picks bottom when the point is well below', () => {
    const result = nearestAnchor({ x: 175, y: 500 }, box.x, box.y, box.width, box.height);
    expect(result.anchor).toBe('bottom');
  });

  it('picks left when the point is well to the left', () => {
    const result = nearestAnchor({ x: -100, y: 230 }, box.x, box.y, box.width, box.height);
    expect(result.anchor).toBe('left');
  });

  it('always resolves to one of the 4 — no "too far" case', () => {
    const result = nearestAnchor({ x: 100000, y: -100000 }, box.x, box.y, box.width, box.height);
    expect(['top', 'right', 'bottom', 'left']).toContain(result.anchor);
  });
});

describe('findEdgesAtAnchor', () => {
  const endpoints = {
    'A__B': { source: 'HUB', target: 'B' },
    'A__C': { source: 'HUB', target: 'C' },
    'A__D': { source: 'HUB', target: 'D' },
    'X__Y': { source: 'X', target: 'Y' },
  };

  it('finds other edges pinned to the same side of the same node', () => {
    const anchors = {
      'A__B': { source: 'top' as const },
      'A__C': { source: 'top' as const },
      'A__D': { source: 'right' as const },
    };
    const found = findEdgesAtAnchor('A__B', 'HUB', 'top', anchors, endpoints);
    expect(found).toEqual(['A__C']);
  });

  it('matches regardless of whether the collision is on the source or target end', () => {
    const anchors = {
      'A__B': { source: 'top' as const },
      'X__Y': { target: 'top' as const }, // X__Y's TARGET happens to also be node HUB
    };
    const endpointsWithSharedHub = { ...endpoints, 'X__Y': { source: 'X', target: 'HUB' } };
    const found = findEdgesAtAnchor('A__B', 'HUB', 'top', anchors, endpointsWithSharedHub);
    expect(found).toEqual(['X__Y']);
  });

  it('does not match a different side of the same node', () => {
    const anchors = {
      'A__B': { source: 'top' as const },
      'A__C': { source: 'bottom' as const },
    };
    const found = findEdgesAtAnchor('A__B', 'HUB', 'top', anchors, endpoints);
    expect(found).toEqual([]);
  });

  it('does not match the same side of a DIFFERENT node', () => {
    const anchors = {
      'A__B': { source: 'top' as const },
      'X__Y': { source: 'top' as const },
    };
    const found = findEdgesAtAnchor('A__B', 'HUB', 'top', anchors, endpoints);
    expect(found).toEqual([]);
  });

  it('returns [] when no anchors exist at all', () => {
    expect(findEdgesAtAnchor('A__B', 'HUB', 'top', {}, endpoints)).toEqual([]);
  });

  // 2026-08-16 — found live-testing the restore-picker/hover-highlight
  // session: unpinned edges land on DEFAULT_ANCHOR_SIDE (every tile's
  // Handle is fixed left/right), so several of them converging on the same
  // hub stacked with zero separation and no way to grab a specific one.
  // The old version only ever scanned edgeAnchors' keys, which skips any
  // edge that had never been pinned — these cases would all have failed
  // before the fix (empty [] instead of the sibling list).
  it('finds other UNPINNED edges that land on the same default side', () => {
    // A__C, A__D carry no anchor entry at all — same as a freshly drawn,
    // never-dragged connector.
    const found = findEdgesAtAnchor('A__B', 'HUB', DEFAULT_ANCHOR_SIDE.source, {}, endpoints);
    expect(found).toEqual(['A__C', 'A__D']);
  });

  it('matches an unpinned edge against one explicitly pinned to the same default side', () => {
    const anchors = { 'A__D': { source: 'right' as const } };
    const found = findEdgesAtAnchor('A__B', 'HUB', 'right', anchors, endpoints);
    expect(found).toEqual(['A__C', 'A__D']);
  });

  it('does not match an unpinned source against an unpinned target on the same node', () => {
    // A__B/A__C/A__D leave HUB (unpinned source, defaults to 'right').
    // Z__HUB arrives at HUB (unpinned target, defaults to 'left') — both
    // ends touch HUB, but on opposite fixed sides, so they must not collide.
    const endpointsWithIncoming = { ...endpoints, 'Z__HUB': { source: 'Z', target: 'HUB' } };
    const found = findEdgesAtAnchor('A__B', 'HUB', DEFAULT_ANCHOR_SIDE.source, {}, endpointsWithIncoming);
    expect(found).not.toContain('Z__HUB');
  });

  it('finds other unpinned edges landing on the default TARGET side too', () => {
    const endpointsIntoHub = {
      'B__A': { source: 'B', target: 'HUB' },
      'C__A': { source: 'C', target: 'HUB' },
      'X__Y': { source: 'X', target: 'Y' },
    };
    const found = findEdgesAtAnchor('B__A', 'HUB', DEFAULT_ANCHOR_SIDE.target, {}, endpointsIntoHub);
    expect(found).toEqual(['C__A']);
  });
});

// fb:0cdd59ba — "next to space name I should see some indicator if we have
// been here before."
describe('computeVisitNumber (revisit indicator)', () => {
  const log = [
    { spaceName: 'OWNER-SCOPE-INITIATION' },
    { spaceName: 'PM-DECISION-CHECK' },
    { spaceName: 'ARCH-INITIATION' },
    { spaceName: 'PM-DECISION-CHECK' },
  ];

  it('returns 0 for a space never visited', () => {
    expect(computeVisitNumber(log, 'CON-INITIATION')).toBe(0);
  });

  it('returns 1 for a space visited once', () => {
    expect(computeVisitNumber(log, 'ARCH-INITIATION')).toBe(1);
  });

  it('counts every arrival at a repeated space', () => {
    expect(computeVisitNumber(log, 'PM-DECISION-CHECK')).toBe(2);
  });

  it('handles an empty log', () => {
    expect(computeVisitNumber([], 'PM-DECISION-CHECK')).toBe(0);
  });
});

describe('formatVisitBadge (panel header revisit label)', () => {
  it('shows no badge on a first visit', () => {
    expect(formatVisitBadge('First', 1)).toBeNull();
  });

  it('shows a numbered badge on a return visit when the count is reliable', () => {
    expect(formatVisitBadge('Subsequent', 2)).toBe('↩ Visit #2');
    expect(formatVisitBadge('Subsequent', 3)).toBe('↩ Visit #3');
  });

  it('falls back to a generic label when Subsequent but the count is not ≥2', () => {
    // Defensive: visitType is authoritative; if the log hasn't caught up we
    // still show a badge rather than contradict the engine.
    expect(formatVisitBadge('Subsequent', 1)).toBe('↩ Return visit');
    expect(formatVisitBadge('Subsequent', 0)).toBe('↩ Return visit');
  });
});

describe('estimateTileMaxIngridHeight (content-aware buffer ghost — fb:a4c50822)', () => {
  it('returns the 130 floor for empty / minimal content', () => {
    expect(estimateTileMaxIngridHeight({})).toBe(BOARD_TILE_MAX_INGRID.h);
    expect(estimateTileMaxIngridHeight({ title: 'Fee Review' })).toBe(BOARD_TILE_MAX_INGRID.h);
  });

  it('grows above the floor for a long story + action (the overlap case)', () => {
    const tall = estimateTileMaxIngridHeight({
      title: 'Plan Exam',
      npcName: 'FDNY Inspector',
      story:
        'I read for what kills people in fires. Sprinkler heads, standpipe risers, ' +
        'egress widths, alarm zones. Sound like you know the code if you want — I actually ' +
        'know it. Objections come back specific.',
      action: "Accept FDNY's verdict, or push back on objections.",
    });
    expect(tall).toBeGreaterThan(BOARD_TILE_MAX_INGRID.h);
  });

  it('a content-heavy tile reserves more room than a sparse one', () => {
    const sparse = estimateTileMaxIngridHeight({ title: 'Inspect', story: 'Quick look.' });
    const heavy = estimateTileMaxIngridHeight({
      title: 'Inspect',
      story: 'Quick look. '.repeat(40),
      action: 'Decide next step. '.repeat(10),
    });
    expect(heavy).toBeGreaterThan(sparse);
  });

  it('counts explicit newlines in authored copy as separate lines', () => {
    const oneLine = estimateTileMaxIngridHeight({ title: 'X', story: 'short' });
    const manyBreaks = estimateTileMaxIngridHeight({ title: 'X', story: 'a\nb\nc\nd\ne\nf\ng\nh' });
    expect(manyBreaks).toBeGreaterThan(oneLine);
  });
});

describe('uniqueDiceDestinations (board edges for dice spaces — fb:35daf1ba)', () => {
  it('returns [] for a missing outcome', () => {
    expect(uniqueDiceDestinations(undefined)).toEqual([]);
  });

  it('includes the FDNY destination CHEAT-BYPASS could only reach via dice', () => {
    // The exact CHEAT-BYPASS DICE_OUTCOMES row — REG-FDNY-FEE-REVIEW was the
    // missing arrow the reporter hit. PM-DECISION-CHECK appears on rolls 5+6.
    const dests = uniqueDiceDestinations({
      roll_1: 'ENG-INITIATION',
      roll_2: 'REG-DOB-FEE-REVIEW',
      roll_3: 'REG-FDNY-FEE-REVIEW',
      roll_4: 'CON-INITIATION',
      roll_5: 'PM-DECISION-CHECK',
      roll_6: 'PM-DECISION-CHECK',
    });
    expect(dests).toContain('REG-FDNY-FEE-REVIEW');
    // Deduped: PM-DECISION-CHECK appears once despite two rolls.
    expect(dests.filter(d => d === 'PM-DECISION-CHECK')).toHaveLength(1);
    expect(dests).toHaveLength(5);
  });

  it('drops blank roll columns', () => {
    expect(uniqueDiceDestinations({ roll_1: 'A', roll_2: '', roll_3: '   ', roll_4: 'B' })).toEqual(['A', 'B']);
  });
});
