// tests/regression/FdnyReviewNeeded.test.ts
//
// Tom, 2026-10-08: a project the fire department never needs to review must not be held back at the
// final review for its sign-off ("the DOB clerk at the finish space does not let me pass"), and the FDNY
// tag should look different when the review is needed and when it is not.
import { describe, it, expect } from 'vitest';
import { ApprovalService } from '../../src/services/ApprovalService';
import { bootstrapHeadlessServices } from '../ghost/bootstrapServices';

const player = (over: any = {}): any => ({
  id: 'p', dobApprovalStatus: 'approved', fdnyApprovalStatus: 'none', visitedSpaces: ['REG-DOB-PROF-CERT'], hand: [], ...over,
});

describe('isFdnyReviewNeeded', () => {
  it('is needed when no fire-protection check is registered (legacy behaviour)', () => {
    expect(new ApprovalService().isFdnyReviewNeeded(player())).toBe(true);
  });

  it('is not needed for a project with no fire protection that DOB never sent on', () => {
    const svc = new ApprovalService();
    svc.setFireProtectionCheck(() => false);
    expect(svc.isFdnyReviewNeeded(player())).toBe(false);
  });

  it('is needed when the work includes fire protection', () => {
    const svc = new ApprovalService();
    svc.setFireProtectionCheck(() => true);
    expect(svc.isFdnyReviewNeeded(player())).toBe(true);
  });

  it('is needed once the player has been through the DOB plan exam (DOB sends them on) or the FDNY exam, or holds any FDNY status', () => {
    const svc = new ApprovalService();
    svc.setFireProtectionCheck(() => false);
    expect(svc.isFdnyReviewNeeded(player({ visitedSpaces: ['REG-DOB-PLAN-EXAM'] }))).toBe(true);
    expect(svc.isFdnyReviewNeeded(player({ visitedSpaces: ['REG-FDNY-PLAN-EXAM'] }))).toBe(true);
    expect(svc.isFdnyReviewNeeded(player({ fdnyApprovalStatus: 'denied' }))).toBe(true);
  });
});

describe('the final review gate', () => {
  it('lets a DOB-approved project through when FDNY was never needed', () => {
    const svc = new ApprovalService();
    svc.setFireProtectionCheck(() => false);
    expect(svc.checkFinalReviewGate(player()).passed).toBe(true);
  });

  it('still sends a project that needs FDNY back to the plan examiner', () => {
    const svc = new ApprovalService();
    svc.setFireProtectionCheck(() => true);
    const gate = svc.checkFinalReviewGate(player());
    expect(gate).toMatchObject({ passed: false, missing: 'fdny', routeTo: 'REG-FDNY-PLAN-EXAM' });
  });

  it('still needs DOB, whether or not FDNY is needed', () => {
    const svc = new ApprovalService();
    svc.setFireProtectionCheck(() => false);
    expect(svc.checkFinalReviewGate(player({ dobApprovalStatus: 'none' }))).toMatchObject({ passed: false, missing: 'dob' });
  });
});

describe('in the real game', () => {
  it('the movement service registers what counts as fire protection', async () => {
    const s: any = await bootstrapHeadlessServices();
    const { stateService } = s;
    stateService.addPlayer('T');
    const id = stateService.getAllPlayers()[0].id;
    // an ordinary job (no sprinklers etc.), DOB approved by professional certification
    stateService.updatePlayer({ id, hand: ['W001'], dobApprovalStatus: 'approved', visitedSpaces: ['REG-DOB-PROF-CERT'] } as any);
    const p = stateService.getPlayer(id);
    const svc = (s.movementService as any).approvalService;
    expect(svc.isFdnyReviewNeeded(p)).toBe(false);
    expect(svc.checkFinalReviewGate(p).passed).toBe(true);
  });
});
