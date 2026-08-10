// tests/regression/ReskinAgencyLabels.test.ts

/**
 * Regression test: hardcoded "DOB"/"FDNY" narration copy (2026-08-09).
 *
 * Workstream 6 CSV-only-reskin audit (2026-08-03, see TODO.md "Moderate"
 * finding) found 5 files with the literal strings "DOB"/"FDNY" baked into
 * narration/UI copy, bypassing the existing npc_speaker/approval_role
 * CSV-portability hooks: ApprovalService.ts, DiceRollProcessor.ts,
 * EndGameModal.tsx, ScoreboardV2.tsx (src/components/player), and
 * endGameInsights.ts.
 *
 * Fix: ApprovalService now exports getDobLabel()/getFdnyLabel(), which
 * resolve through the same override chain as character names/portraits
 * (characters.ts's getNpcCharacterInfo, driven by GAME_CONFIG's
 * `npc_speaker` column keyed off the `approval_role` space lookup) — see
 * characters.ts's new `shortLabel` field on CharacterInfo. All 5 files now
 * call these instead of hardcoding the literal.
 *
 * This test verifies the shared resolver's three behaviors (default /
 * CSV-override / missing-value fallback) directly, plus one representative
 * consumer in each of the two non-UI layers (ApprovalService itself, and
 * endGameInsights.ts) to prove the wiring actually propagates. The other 3
 * call sites (DiceRollProcessor.ts, EndGameModal.tsx, ScoreboardV2.tsx) are
 * single-line callers of these exact same two functions, already covered by
 * `npm run typecheck` plus their own component test suites, which keep
 * passing unchanged because the default output is byte-identical to before.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as characters from '../../src/constants/characters';
import {
  getDobLabel,
  getFdnyLabel,
  DOB_EXAM_SPACE,
  FDNY_EXAM_SPACE,
  DOB_AUDIT_SPACE,
  ApprovalService,
} from '../../src/services/ApprovalService';
import { buildEndGameInsights } from '../../src/utils/endGameInsights';
import { EndGameStats } from '../../src/utils/endGameStats';
import { Player } from '../../src/types/DataTypes';

function makeStats(overrides: Partial<EndGameStats> = {}): EndGameStats {
  return {
    projectScope: 0,
    totalSpent: 0,
    daysTotal: 0,
    turnsTaken: 15,
    rounds: 1,
    finalScore: 0,
    fundingMix: { owner: 0, bank: 0, investor: 0, other: 0, total: 0 },
    feesBreakdown: {
      architectural: 0, engineering: 0, regulatory: 0, expeditor: 0,
      investmentFee: 0, miscellaneous: 0, totalFees: 0,
    },
    construction: { workCardCount: 0, constructionScope: 0 },
    approvals: { dob: 'approved', fdny: 'approved' },
    journey: [],
    cardCounts: { W: 0, B: 0, E: 0, L: 0, I: 0 },
    ...overrides,
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1', name: 'P1', currentSpace: 'FINISH', visitType: 'First',
    visitedSpaces: [], spaceVisitLog: [],
    money: 0, timeSpent: 0, projectScope: 0,
    hand: [], activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [], loans: [], score: 0,
    moneySources: { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 },
    expenditures: { design: 0, fees: 0, construction: 0 },
    costHistory: [], fundingHistory: [],
    costs: { bank: 0, investor: 0, expeditor: 0, architectural: 0, engineering: 0, regulatory: 0, investmentFee: 0, miscellaneous: 0, total: 0 },
    ...overrides,
  } as Player;
}

describe('reskin-safe DOB/FDNY agency labels (getDobLabel/getFdnyLabel)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(a) with current CSV values (no override configured), output matches the current literal exactly', () => {
    // No spy — exercises the real getNpcCharacterInfo. GAME_CONFIG.csv ships
    // npc_speaker empty for REG-DOB-PLAN-EXAM/REG-FDNY-PLAN-EXAM, so this hits
    // the real CHARACTER_MAP default ('DOB'/'FDNY'), not the ??-fallback.
    expect(getDobLabel()).toBe('DOB');
    expect(getFdnyLabel()).toBe('FDNY');
  });

  it('(b) with a mocked CSV override, narration uses the new label instead of the literal', () => {
    vi.spyOn(characters, 'getNpcCharacterInfo').mockImplementation((spaceName: string) => {
      if (spaceName === DOB_EXAM_SPACE) {
        return { emoji: '🐉', name: 'Dungeon Master', phase: 'Regulatory', color: '#111111', imageRoles: [], shortLabel: 'Dungeon Master' };
      }
      if (spaceName === FDNY_EXAM_SPACE) {
        return { emoji: '🔥', name: 'Fire Marshal', phase: 'Regulatory', color: '#222222', imageRoles: [], shortLabel: 'Fire Marshal' };
      }
      return undefined;
    });

    expect(getDobLabel()).toBe('Dungeon Master');
    expect(getFdnyLabel()).toBe('Fire Marshal');

    // Consumer 1: ApprovalService.narrateOutcome (was ApprovalService.ts:333 area).
    const service = new ApprovalService();
    const narration = service.narrateOutcome(
      { approval: 'dob', kind: 'approved', destinations: [] },
      DOB_EXAM_SPACE,
      'First'
    );
    expect(narration).toContain('Dungeon Master Plan Examiner');
    expect(narration).toContain('Take it to Fire Marshal next');
    expect(narration).not.toContain('DOB');
    expect(narration).not.toContain('FDNY');

    // Consumer 2: endGameInsights 'all-approved' rule.
    const stats = makeStats({ approvals: { dob: 'approved', fdny: 'approved' } });
    const insights = buildEndGameInsights(stats, makePlayer());
    const allApproved = insights.find(i => i.id === 'all-approved');
    expect(allApproved?.headline).toBe('Both Dungeon Master and Fire Marshal signed off cleanly.');
  });

  it('(c) with the CSV value missing (no CHARACTER_MAP match / no override), falls back to the literal', () => {
    vi.spyOn(characters, 'getNpcCharacterInfo').mockImplementation(() => undefined);

    expect(getDobLabel()).toBe('DOB');
    expect(getFdnyLabel()).toBe('FDNY');

    const service = new ApprovalService();
    const revokeResult = service.revoke(
      makePlayer({ dobApprovalStatus: 'approved', fdnyApprovalStatus: 'approved' }),
      'both',
      { spaceName: DOB_AUDIT_SPACE, cardName: 'Zoning Change', reason: 'card_effect' }
    );
    expect(revokeResult.event?.message).toContain('DOB and FDNY approval');

    const stats = makeStats({ approvals: { dob: 'none', fdny: 'approved' } });
    const insights = buildEndGameInsights(stats, makePlayer());
    const dobMissing = insights.find(i => i.id === 'dob-missing');
    expect(dobMissing?.headline).toBe('DOB never weighed in on the project.');
  });
});
