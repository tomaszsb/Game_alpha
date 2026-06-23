import { describe, it, expect } from 'vitest';
import { playerLifecyclePosition } from '../../src/utils/lifecycleProgress';

const phaseOf: Record<string, string> = {
  'FUND-A': 'FUNDING',
  'DESIGN-A': 'DESIGN',
  'REG-A': 'REGULATORY',
  'CON-A': 'CONSTRUCTION',
};

const ds: any = {
  getPhaseOrder: () => ['FUNDING', 'DESIGN', 'REGULATORY', 'CONSTRUCTION'],
  getGameConfigBySpace: (s: string) => (phaseOf[s] ? { phase: phaseOf[s] } : null),
};

describe('playerLifecyclePosition', () => {
  it('reports the furthest phase reached and its progress', () => {
    const player: any = { currentSpace: 'DESIGN-A', visitedSpaces: ['FUND-A', 'DESIGN-A'] };
    expect(playerLifecyclePosition(player, ds)).toEqual({ phase: 'DESIGN', phaseIndex: 1, progress: 50 });
  });

  it('never regresses — a later current space does not lower the furthest phase', () => {
    const player: any = { currentSpace: 'FUND-A', visitedSpaces: ['DESIGN-A'] };
    expect(playerLifecyclePosition(player, ds).phaseIndex).toBe(1); // still DESIGN, not FUNDING
  });

  it('returns UNKNOWN when no space resolves to a phase', () => {
    const player: any = { currentSpace: 'NOWHERE', visitedSpaces: [] };
    expect(playerLifecyclePosition(player, ds)).toEqual({ phase: 'UNKNOWN', phaseIndex: -1, progress: 0 });
  });

  it('ignores spaces whose config has no phase (does not throw)', () => {
    const dsNoPhase: any = {
      getPhaseOrder: () => ['FUNDING', 'DESIGN'],
      getGameConfigBySpace: () => ({ phase: undefined }),
    };
    const player: any = { currentSpace: 'AUTH-X', visitedSpaces: [] };
    expect(() => playerLifecyclePosition(player, dsNoPhase)).not.toThrow();
    expect(playerLifecyclePosition(player, dsNoPhase).phaseIndex).toBe(-1);
  });
});
