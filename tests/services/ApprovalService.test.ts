import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApprovalService,
  ApprovalOutcome,
  DOB_EXAM_SPACE,
  FDNY_EXAM_SPACE,
  DOB_AUDIT_SPACE,
  MISSING_DOB_PENALTY_DAYS,
  MISSING_DOB_PENALTY_FEE,
} from '../../src/services/ApprovalService';
import { Player } from '../../src/types/DataTypes';

describe('ApprovalService', () => {
  let service: ApprovalService;

  beforeEach(() => {
    service = new ApprovalService();
  });

  // Minimal Player factory — only fields the service reads.
  function makePlayer(overrides: Partial<Player> = {}): Player {
    return {
      id: 'p1',
      name: 'Alice',
      currentSpace: 'OWNER-SCOPE-INITIATION',
      visitType: 'First',
      visitedSpaces: [],
      money: 0,
      timeSpent: 0,
      projectScope: 0,
      hand: [],
      activeCards: [],
      ...overrides,
    } as Player;
  }

  describe('resolveDiceOutcome — FDNY First visit', () => {
    it('rolls 1, 2 → approved with full 4-destination list', () => {
      for (const roll of [1, 2]) {
        const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'First', roll)!;
        expect(out.approval).toBe('fdny');
        expect(out.kind).toBe('approved');
        expect(out.destinations).toEqual([
          'CON-INITIATION',
          'REG-DOB-PLAN-EXAM',
          'REG-DOB-AUDIT',
          'PM-DECISION-CHECK',
        ]);
      }
    });

    it('rolls 3, 4 → minor-objection (no destinations)', () => {
      for (const roll of [3, 4]) {
        const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'First', roll)!;
        expect(out.kind).toBe('minor-objection');
        expect(out.destinations).toBeUndefined();
      }
    });

    it('roll 5 → denied (engineer)', () => {
      const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'First', 5)!;
      expect(out.kind).toBe('denied');
    });

    it('roll 6 → denied (architect, harder than engineer)', () => {
      const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'First', 6)!;
      expect(out.kind).toBe('denied');
    });
  });

  describe('resolveDiceOutcome — FDNY Subsequent visit (easier)', () => {
    it('rolls 1, 2, 3 → approved', () => {
      for (const roll of [1, 2, 3]) {
        const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'Subsequent', roll)!;
        expect(out.kind).toBe('approved');
      }
    });

    it('rolls 4, 5 → minor-objection', () => {
      for (const roll of [4, 5]) {
        const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'Subsequent', roll)!;
        expect(out.kind).toBe('minor-objection');
      }
    });

    it('roll 6 → denied', () => {
      const out = service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'Subsequent', 6)!;
      expect(out.kind).toBe('denied');
    });
  });

  describe('resolveDiceOutcome — DOB First visit', () => {
    it('rolls 1, 5, 6 → approved with [REG-FDNY-FEE-REVIEW]', () => {
      for (const roll of [1, 5, 6]) {
        const out = service.resolveDiceOutcome(DOB_EXAM_SPACE, 'First', roll)!;
        expect(out.approval).toBe('dob');
        expect(out.kind).toBe('approved');
        expect(out.destinations).toEqual(['REG-FDNY-FEE-REVIEW']);
      }
    });

    it('roll 2 → minor-objection (loop at DOB)', () => {
      const out = service.resolveDiceOutcome(DOB_EXAM_SPACE, 'First', 2)!;
      expect(out.kind).toBe('minor-objection');
    });

    it('rolls 3, 4 → denied (route to ARCH-INITIATION)', () => {
      for (const roll of [3, 4]) {
        const out = service.resolveDiceOutcome(DOB_EXAM_SPACE, 'First', roll)!;
        expect(out.kind).toBe('denied');
      }
    });
  });

  describe('resolveDiceOutcome — DOB Subsequent visit', () => {
    it('rolls 1, 2, 3, 6 → approved', () => {
      for (const roll of [1, 2, 3, 6]) {
        const out = service.resolveDiceOutcome(DOB_EXAM_SPACE, 'Subsequent', roll)!;
        expect(out.kind).toBe('approved');
      }
    });

    it('roll 4 → minor-objection', () => {
      const out = service.resolveDiceOutcome(DOB_EXAM_SPACE, 'Subsequent', 4)!;
      expect(out.kind).toBe('minor-objection');
    });

    it('roll 5 → denied', () => {
      const out = service.resolveDiceOutcome(DOB_EXAM_SPACE, 'Subsequent', 5)!;
      expect(out.kind).toBe('denied');
    });
  });

  describe('resolveDiceOutcome — DOB AUDIT (revocation only)', () => {
    it('First visit adverse rolls 2, 3 → revoke DOB to minor-objection', () => {
      for (const roll of [2, 3]) {
        const out = service.resolveDiceOutcome(DOB_AUDIT_SPACE, 'First', roll)!;
        expect(out.approval).toBe('dob');
        expect(out.kind).toBe('minor-objection');
      }
    });

    it('Subsequent visit adverse rolls 3, 4 → revoke', () => {
      for (const roll of [3, 4]) {
        const out = service.resolveDiceOutcome(DOB_AUDIT_SPACE, 'Subsequent', roll)!;
        expect(out.kind).toBe('minor-objection');
      }
    });

    it('First non-adverse rolls 1, 4, 5, 6 → null (no change)', () => {
      for (const roll of [1, 4, 5, 6]) {
        expect(service.resolveDiceOutcome(DOB_AUDIT_SPACE, 'First', roll)).toBeNull();
      }
    });

    it('Subsequent non-adverse rolls 1, 2, 5, 6 → null', () => {
      for (const roll of [1, 2, 5, 6]) {
        expect(service.resolveDiceOutcome(DOB_AUDIT_SPACE, 'Subsequent', roll)).toBeNull();
      }
    });
  });

  describe('resolveDiceOutcome — non-regulated spaces', () => {
    it('returns null for unrelated space', () => {
      expect(service.resolveDiceOutcome('OWNER-SCOPE-INITIATION', 'First', 3)).toBeNull();
      expect(service.resolveDiceOutcome('PM-DECISION-CHECK', 'First', 1)).toBeNull();
      expect(service.resolveDiceOutcome('CON-INITIATION', 'Subsequent', 6)).toBeNull();
    });

    it('returns null for out-of-range roll values', () => {
      expect(service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'First', 0)).toBeNull();
      expect(service.resolveDiceOutcome(FDNY_EXAM_SPACE, 'First', 7)).toBeNull();
    });
  });

  describe('applyOutcome', () => {
    it('on approved DOB: sets status + stores destinations', () => {
      const outcome: ApprovalOutcome = {
        approval: 'dob',
        kind: 'approved',
        destinations: ['REG-FDNY-FEE-REVIEW'],
      };
      const update = service.applyOutcome(outcome);
      expect(update.dobApprovalStatus).toBe('approved');
      expect(update.dobApprovedDestinations).toEqual(['REG-FDNY-FEE-REVIEW']);
      // Doesn't touch FDNY fields.
      expect(update.fdnyApprovalStatus).toBeUndefined();
      expect(update.fdnyApprovedDestinations).toBeUndefined();
    });

    it('on approved FDNY: sets FDNY status + 4 destinations', () => {
      const outcome: ApprovalOutcome = {
        approval: 'fdny',
        kind: 'approved',
        destinations: ['A', 'B', 'C', 'D'],
      };
      const update = service.applyOutcome(outcome);
      expect(update.fdnyApprovalStatus).toBe('approved');
      expect(update.fdnyApprovedDestinations).toEqual(['A', 'B', 'C', 'D']);
    });

    it('on minor-objection: clears stored destinations', () => {
      const update = service.applyOutcome({ approval: 'fdny', kind: 'minor-objection' });
      expect(update.fdnyApprovalStatus).toBe('minor-objection');
      expect(update.fdnyApprovedDestinations).toEqual([]);
    });

    it('grantProfCertApproval: grants DOB approval like passing the plan exam (fb:f1bc011b)', () => {
      const update = service.grantProfCertApproval();
      expect(update.dobApprovalStatus).toBe('approved');
      expect(update.dobApprovedDestinations).toEqual(['REG-FDNY-FEE-REVIEW']);
      // DOB-only — never touches FDNY state.
      expect(update.fdnyApprovalStatus).toBeUndefined();
    });

    it('on denied: clears stored destinations', () => {
      const update = service.applyOutcome({ approval: 'dob', kind: 'denied' });
      expect(update.dobApprovalStatus).toBe('denied');
      expect(update.dobApprovedDestinations).toEqual([]);
    });
  });

  describe('revoke', () => {
    it("'dob' clears DOB status to 'none' and empties dobApprovedDestinations", () => {
      const update = service.revoke('dob');
      expect(update.dobApprovalStatus).toBe('none');
      expect(update.dobApprovedDestinations).toEqual([]);
      expect(update.fdnyApprovalStatus).toBeUndefined();
      expect(update.fdnyApprovedDestinations).toBeUndefined();
    });

    it("'fdny' clears FDNY only", () => {
      const update = service.revoke('fdny');
      expect(update.fdnyApprovalStatus).toBe('none');
      expect(update.fdnyApprovedDestinations).toEqual([]);
      expect(update.dobApprovalStatus).toBeUndefined();
      expect(update.dobApprovedDestinations).toBeUndefined();
    });

    it("'both' clears DOB and FDNY together", () => {
      const update = service.revoke('both');
      expect(update.dobApprovalStatus).toBe('none');
      expect(update.dobApprovedDestinations).toEqual([]);
      expect(update.fdnyApprovalStatus).toBe('none');
      expect(update.fdnyApprovedDestinations).toEqual([]);
    });
  });

  describe('getApprovedDestinations', () => {
    it('returns [] when neither approval is approved', () => {
      expect(service.getApprovedDestinations(makePlayer())).toEqual([]);
    });

    it('returns FDNY destinations when only FDNY approved', () => {
      const player = makePlayer({
        fdnyApprovalStatus: 'approved',
        fdnyApprovedDestinations: ['A', 'B'],
      });
      expect(service.getApprovedDestinations(player)).toEqual(['A', 'B']);
    });

    it('returns DOB destinations when only DOB approved', () => {
      const player = makePlayer({
        dobApprovalStatus: 'approved',
        dobApprovedDestinations: ['REG-FDNY-FEE-REVIEW'],
      });
      expect(service.getApprovedDestinations(player)).toEqual(['REG-FDNY-FEE-REVIEW']);
    });

    it('combines both, deduplicated', () => {
      const player = makePlayer({
        fdnyApprovalStatus: 'approved',
        fdnyApprovedDestinations: ['A', 'B', 'REG-FDNY-FEE-REVIEW'],
        dobApprovalStatus: 'approved',
        dobApprovedDestinations: ['REG-FDNY-FEE-REVIEW'],
      });
      expect(service.getApprovedDestinations(player)).toEqual(['A', 'B', 'REG-FDNY-FEE-REVIEW']);
    });

    it('ignores status === minor-objection even with stored destinations', () => {
      const player = makePlayer({
        fdnyApprovalStatus: 'minor-objection',
        fdnyApprovedDestinations: ['A', 'B'],
      });
      expect(service.getApprovedDestinations(player)).toEqual([]);
    });

    it('ignores status === denied', () => {
      const player = makePlayer({
        dobApprovalStatus: 'denied',
        dobApprovedDestinations: ['A'],
      });
      expect(service.getApprovedDestinations(player)).toEqual([]);
    });
  });

  describe('checkFinalReviewGate (Phase 7.4 Stage-1)', () => {
    it('both approved → passed', () => {
      const player = makePlayer({
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'approved',
      });
      const result = service.checkFinalReviewGate(player);
      expect(result.passed).toBe(true);
      expect(result.routeTo).toBeUndefined();
    });

    it('only DOB missing → route to DOB plan exam', () => {
      const player = makePlayer({
        dobApprovalStatus: 'minor-objection',
        fdnyApprovalStatus: 'approved',
      });
      const result = service.checkFinalReviewGate(player);
      expect(result.passed).toBe(false);
      expect(result.missing).toBe('dob');
      expect(result.routeTo).toBe(DOB_EXAM_SPACE);
      expect(result.reason).toMatch(/no DOB approval/i);
    });

    it('only FDNY missing → route to FDNY plan exam', () => {
      const player = makePlayer({
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'denied',
      });
      const result = service.checkFinalReviewGate(player);
      expect(result.passed).toBe(false);
      expect(result.missing).toBe('fdny');
      expect(result.routeTo).toBe(FDNY_EXAM_SPACE);
      expect(result.reason).toMatch(/FDNY/i);
    });

    it('both missing → route to DOB first (per spec)', () => {
      const player = makePlayer(); // both undefined → treated as not 'approved'
      const result = service.checkFinalReviewGate(player);
      expect(result.passed).toBe(false);
      expect(result.missing).toBe('both');
      expect(result.routeTo).toBe(DOB_EXAM_SPACE);
    });

    it('treats undefined approval as not approved (early game player)', () => {
      const player = makePlayer({ dobApprovalStatus: 'approved' });
      const result = service.checkFinalReviewGate(player);
      expect(result.passed).toBe(false);
      expect(result.missing).toBe('fdny');
    });
  });

  describe('computeEndGamePenalty (Phase 7.4)', () => {
    it('returns null when DOB approved (no penalty)', () => {
      const player = makePlayer({ dobApprovalStatus: 'approved', timeSpent: 100, money: 1000000 });
      expect(service.computeEndGamePenalty(player)).toBeNull();
    });

    it('returns +30 days + $50K when DOB status is none', () => {
      const player = makePlayer({ timeSpent: 100, money: 1000000 });
      const penalty = service.computeEndGamePenalty(player)!;
      expect(penalty.days).toBe(MISSING_DOB_PENALTY_DAYS);
      expect(penalty.fee).toBe(MISSING_DOB_PENALTY_FEE);
      expect(penalty.newTimeSpent).toBe(100 + 30);
      expect(penalty.newMoney).toBe(1000000 - 50000);
    });

    it('applies penalty when DOB is minor-objection', () => {
      const player = makePlayer({ dobApprovalStatus: 'minor-objection', timeSpent: 50, money: 500000 });
      const penalty = service.computeEndGamePenalty(player)!;
      expect(penalty).not.toBeNull();
      expect(penalty.newTimeSpent).toBe(80);
      expect(penalty.newMoney).toBe(450000);
    });

    it('applies penalty when DOB is denied', () => {
      const player = makePlayer({ dobApprovalStatus: 'denied', timeSpent: 200, money: 0 });
      const penalty = service.computeEndGamePenalty(player)!;
      expect(penalty.newMoney).toBe(-50000); // can go negative (emergency fee owed)
    });

    it('FDNY status does NOT affect end-game penalty (DOB-only check)', () => {
      // FDNY missing but DOB approved → no penalty
      const player = makePlayer({
        dobApprovalStatus: 'approved',
        fdnyApprovalStatus: 'none',
      });
      expect(service.computeEndGamePenalty(player)).toBeNull();
    });
  });

  describe('narrateOutcome (Phase 7.5)', () => {
    it('DOB approved → cleared to FDNY', () => {
      const narration = service.narrateOutcome(
        { approval: 'dob', kind: 'approved', destinations: ['REG-FDNY-FEE-REVIEW'] },
        DOB_EXAM_SPACE,
        'First'
      );
      expect(narration).toMatch(/DOB/i);
      expect(narration).toMatch(/approved/i);
      expect(narration).toMatch(/FDNY/i);
    });

    it('DOB minor-objection → revise and resubmit', () => {
      const narration = service.narrateOutcome(
        { approval: 'dob', kind: 'minor-objection' },
        DOB_EXAM_SPACE,
        'First'
      );
      expect(narration).toMatch(/minor objection/i);
      expect(narration).toMatch(/resubmit/i);
    });

    it('DOB denied → architect rework', () => {
      const narration = service.narrateOutcome(
        { approval: 'dob', kind: 'denied' },
        DOB_EXAM_SPACE,
        'First'
      );
      expect(narration).toMatch(/rejected/i);
      expect(narration).toMatch(/architect/i);
    });

    it('FDNY approved → pick next stop', () => {
      const narration = service.narrateOutcome(
        { approval: 'fdny', kind: 'approved', destinations: [] },
        FDNY_EXAM_SPACE,
        'Subsequent'
      );
      expect(narration).toMatch(/FDNY/i);
      expect(narration).toMatch(/approved/i);
    });

    it('FDNY denied First → design team (harsher)', () => {
      const narration = service.narrateOutcome(
        { approval: 'fdny', kind: 'denied' },
        FDNY_EXAM_SPACE,
        'First'
      );
      expect(narration).toMatch(/rejected/i);
      expect(narration).toMatch(/design team/i);
    });

    it('FDNY denied Subsequent → engineer (re-submission)', () => {
      const narration = service.narrateOutcome(
        { approval: 'fdny', kind: 'denied' },
        FDNY_EXAM_SPACE,
        'Subsequent'
      );
      expect(narration).toMatch(/rejected/i);
      expect(narration).toMatch(/engineer/i);
    });

    it('AUDIT outcome → audit-specific revocation language', () => {
      const narration = service.narrateOutcome(
        { approval: 'dob', kind: 'minor-objection' },
        DOB_AUDIT_SPACE,
        'First'
      );
      expect(narration).toMatch(/audit/i);
      expect(narration).toMatch(/plan exam/i);
    });
  });
});
