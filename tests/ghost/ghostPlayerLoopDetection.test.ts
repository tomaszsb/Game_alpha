/**
 * Fast, deterministic unit tests for the LOOP classifier (no game runs).
 *
 * Split from the original ghostPlayer.test.ts (2026-07-09) alongside the
 * three heavy batch gates (ghostPlayerStrict/NegotiateCoverage/SmartBot) so
 * this pure-logic suite stays clearly separate and runs in milliseconds
 * regardless of what else is happening in tests/ghost/. Pins the round-3 /
 * v3.0.79 soft-lock detection.
 */

import { describe, it, expect } from 'vitest';
import { detectSpaceLoop, isHardFailure } from './ghostPlayer';

describe('LOOP detection (detectSpaceLoop / isHardFailure)', () => {
  const trailOf = (spaces: string[]): string[] =>
    spaces.map((s, i) => `T${i} ${s}:First hand=0(W=0) $1000`);

  it('flags an exact 2-space cycle repeated at the tail', () => {
    const trail = trailOf(['START', 'A', 'B', 'A', 'B', 'A', 'B']);
    const loop = detectSpaceLoop(trail);
    expect(loop.looped).toBe(true);
    expect(loop.period).toBe(2);
    expect(loop.cycle).toEqual(['A', 'B']);
  });

  it('flags being stuck on a single space (period 1)', () => {
    expect(detectSpaceLoop(trailOf(['X', 'STUCK', 'STUCK', 'STUCK'])).period).toBe(1);
  });

  it('does NOT flag a progressing game that reaches new spaces', () => {
    const trail = trailOf(['START', 'A', 'B', 'C', 'D', 'E', 'F', 'FINISH']);
    expect(detectSpaceLoop(trail).looped).toBe(false);
  });

  it('does NOT flag a brief revisit that is not a sustained cycle', () => {
    // A→B→A once, then moves on — only one repeat, below minRepeats.
    const trail = trailOf(['A', 'B', 'A', 'C', 'D', 'E']);
    expect(detectSpaceLoop(trail).looped).toBe(false);
  });

  it('ignores non-turn trail lines when extracting the sequence', () => {
    const trail = [
      ...trailOf(['HUB', 'SPOKE']).slice(0, 1),
      '  rolled(3) fx=2 → hand=4',
      'T1 SPOKE:First hand=0(W=0) $1',
      '  triggered(draw) → hand=5',
      'T2 HUB:First hand=0(W=0) $1',
      'T3 SPOKE:First hand=0(W=0) $1',
      'T4 HUB:First hand=0(W=0) $1',
      'T5 SPOKE:First hand=0(W=0) $1',
    ];
    expect(detectSpaceLoop(trail)).toMatchObject({ looped: true, period: 2 });
  });

  it('isHardFailure treats LOOP as hard, TURN_CAP as soft', () => {
    const base = { success: false, turns: 300, finalSpace: 'X', trail: [] };
    expect(isHardFailure({ ...base, reason: 'LOOP' })).toBe(true);
    expect(isHardFailure({ ...base, reason: 'EXCEPTION' })).toBe(true);
    expect(isHardFailure({ ...base, reason: 'INVARIANT_VIOLATION' })).toBe(true);
    expect(isHardFailure({ ...base, reason: 'TURN_CAP' })).toBe(false);
    expect(isHardFailure({ ...base, reason: 'WIN', success: true })).toBe(false);
  });
});
