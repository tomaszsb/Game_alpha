import { describe, it, expect } from 'vitest';
import { computeTileVisualState, shortName, truncate, computeVisibleEdgeIds } from '../../src/utils/boardCommon';

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
