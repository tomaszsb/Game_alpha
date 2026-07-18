// src/services/ApprovalService.ts
//
// Workstream 7 — Plan Approval Mechanic (see docs/core/BETA_PLAN_V3.md).
//
// Pure-logic service that decides how a dice roll at a regulated examiner space
// (DOB plan exam, FDNY plan exam, DOB audit) translates into an approval state
// change on the player. It does not mutate state directly — callers apply the
// returned PlayerUpdateData via StateService.updatePlayer.

import { ApprovalStatus, Player, VisitType } from '../types/DataTypes';
import { PlayerUpdateData } from '../types/StateTypes';
import { ApprovalRevokedEvent, ApprovalOutcomeDeterminedEvent } from '../types/GameEvents';

/**
 * Which approval is being affected by an outcome.
 */
export type ApprovalKey = 'dob' | 'fdny';

/**
 * The outcome of resolving a dice roll at a regulated examiner space.
 * `null` means the (space, roll) combination is not a regulated examiner outcome
 * and no approval state change should occur.
 */
export interface ApprovalOutcome {
  approval: ApprovalKey;
  kind: ApprovalStatus; // 'approved' | 'minor-objection' | 'denied'
  /**
   * Destinations to store when `kind === 'approved'`. Used by PM-DECISION-CHECK
   * resume hub to offer "continue from where you left off". Empty/omitted for
   * minor-objection and denied.
   */
  destinations?: string[];
}

/**
 * Space that grants DOB approval on successful roll. Default for the stock
 * DOB-permitting game; a reskin CSV can move this role to a differently-named
 * space via `approval_role=dob_exam` in GAME_CONFIG — see
 * `configureApprovalSpaces` below, called once at app startup.
 */
export let DOB_EXAM_SPACE = 'REG-DOB-PLAN-EXAM';
/**
 * Space that grants FDNY approval on successful roll. Reskin hook: CSV
 * `approval_role=fdny_exam` — see `configureApprovalSpaces`.
 */
export let FDNY_EXAM_SPACE = 'REG-FDNY-PLAN-EXAM';
/**
 * Audit space — adverse rolls revoke DOB approval (route back to plan exam).
 * Reskin hook: CSV `approval_role=dob_audit` — see `configureApprovalSpaces`.
 */
export let DOB_AUDIT_SPACE = 'REG-DOB-AUDIT';
/**
 * DOB clerk's final review (Phase 7.4). Two-stage:
 *   Stage 1 — logic gate on DOB + FDNY approval. Missing approvals bounce.
 *   Stage 2 — existing dice (other paperwork: insurance, structural, energy).
 * Kept for narration/logging only — the actual gate check is already
 * CSV-driven via `DataService.hasFinalReviewGate` (see DiceRollProcessor),
 * so this constant doesn't need a reskin hook of its own.
 */
export const DOB_FINAL_REVIEW_SPACE = 'REG-DOB-FINAL-REVIEW';

/**
 * 2026-07-16: CSV-portability lift — reskin hook for the DOB/FDNY approval-gate
 * roles. Call once at app startup (after GAME_CONFIG loads) so a reskin CSV can
 * assign the exam/audit roles to differently-named spaces without touching this
 * file. Any role left unclaimed in CSV (null) keeps today's default — this only
 * overrides roles the CSV actually assigns via `approval_role`.
 */
export function configureApprovalSpaces(overrides: {
  dobExam?: string | null;
  fdnyExam?: string | null;
  dobAudit?: string | null;
}): void {
  if (overrides.dobExam) DOB_EXAM_SPACE = overrides.dobExam;
  if (overrides.fdnyExam) FDNY_EXAM_SPACE = overrides.fdnyExam;
  if (overrides.dobAudit) DOB_AUDIT_SPACE = overrides.dobAudit;
}

/**
 * Phase 7.4 — end-game penalty applied when FINISH is reached without DOB
 * sign-off. Numbers locked per spec; tune via playtest if balance shifts.
 */
export const MISSING_DOB_PENALTY_DAYS = 30;
export const MISSING_DOB_PENALTY_FEE = 50000;

/**
 * Destinations granted when DOB approval is given. Per spec: DOB approval means
 * "next stage is FDNY", so the single forward destination is FDNY-FEE-REVIEW.
 */
const DOB_APPROVED_DESTINATIONS: string[] = ['REG-FDNY-FEE-REVIEW'];

/**
 * Destinations granted when FDNY approval is given. Mirrors the dice cell
 * 'CON-INITIATION or REG-DOB-PLAN-EXAM or REG-DOB-AUDIT or PM-DECISION-CHECK'.
 */
const FDNY_APPROVED_DESTINATIONS: string[] = [
  'CON-INITIATION',
  'REG-DOB-PLAN-EXAM',
  'REG-DOB-AUDIT',
  'PM-DECISION-CHECK',
];

/**
 * Which approval(s) a revoke targets. 'both' clears DOB and FDNY together.
 * Empty/undefined means no revoke.
 */
export type RevokeTarget = 'dob' | 'fdny' | 'both';

/**
 * Result of the REG-DOB-FINAL-REVIEW Stage-1 gate. `passed` means both DOB and
 * FDNY are 'approved' and the player can roll for paperwork (Stage 2). `passed:
 * false` carries the destination the player should be forced to instead — the
 * missing examiner (DOB first if both missing).
 */
export interface FinalReviewGateResult {
  passed: boolean;
  missing?: RevokeTarget;
  routeTo?: string;
  reason?: string;
}

// Domain-event stage 4: revoke() now owns the "was there something to
// revoke" gating check and the announcement message — the caller no longer
// re-derives either. `event` is null when the revoke was a genuine no-op
// (nothing was actually 'approved' for the target), so the caller emits
// nothing.
export interface RevokeResult {
  update: PlayerUpdateData;
  event: ApprovalRevokedEvent | null;
}

// Domain-event stage 4: grantProfCertApproval() now owns its own
// announcement text too, instead of the caller (DiceRollProcessor)
// hardcoding it inline.
export interface ProfCertGrantResult {
  update: PlayerUpdateData;
  event: ApprovalOutcomeDeterminedEvent;
}

export interface IApprovalService {
  /**
   * Translate a dice roll at a regulated examiner space into an approval outcome.
   * Returns null for any (space, roll) that does not affect approval state.
   */
  resolveDiceOutcome(space: string, visitType: VisitType, roll: number): ApprovalOutcome | null;

  /**
   * Convert an outcome into a PlayerUpdateData partial. Caller applies via StateService.
   */
  applyOutcome(outcome: ApprovalOutcome): PlayerUpdateData;

  /**
   * Prof Cert self-certification grants DOB approval — same effect as passing
   * the plan exam (next stop FDNY). The caller invokes this ONLY on a "pass"
   * roll (one routing the player onward, not into the DOB audit); an audited
   * filing isn't approved until the audit clears. fb:f1bc011b.
   *
   * Domain-event stage 4: also returns the announcement event (message
   * owned here, not hardcoded by the caller).
   */
  grantProfCertApproval(playerId: string, player: Player): ProfCertGrantResult;

  /**
   * Build a PlayerUpdateData that revokes the specified approval(s) to 'none'
   * and clears their stored destinations. Used for non-dice revoke triggers:
   * scope changes (W-card adds), L-card narrative triggers, etc.
   *
   * The returned update is always safe to apply (idempotent — sets status to
   * 'none' and empties the destinations array even if already so).
   *
   * Domain-event stage 4: also decides + builds the `approval_revoked`
   * announcement (the "was there something to revoke" gating check and the
   * message text used to live in the caller, duplicated across 2 call
   * sites) — `event` is null when the target had nothing 'approved' to lose.
   */
  revoke(
    player: Player,
    target: RevokeTarget,
    context: { spaceName: string; cardName?: string; reason: 'scope_change' | 'card_effect' }
  ): RevokeResult;

  /**
   * REG-DOB-FINAL-REVIEW Stage-1 gate (Phase 7.4). Verify that BOTH DOB and
   * FDNY are 'approved' before the player can roll for other paperwork. If
   * either is missing, returns a forced-route to the missing examiner.
   *
   * Routing precedence: DOB before FDNY (per spec — "DOB first if both missing").
   */
  checkFinalReviewGate(player: Player): FinalReviewGateResult;

  /**
   * Phase 7.5 — one-line NPC-voiced narration of an approval outcome, suitable
   * for appending to the modal's Summary block. Speaker is implied by the
   * source space (DOB clerk at REG-DOB-PLAN-EXAM, FDNY inspector at
   * REG-FDNY-PLAN-EXAM, auditor at REG-DOB-AUDIT). The First/Subsequent visit
   * type changes flavor slightly (denial language is harsher on First).
   *
   * Returns undefined when the outcome doesn't warrant a banner — e.g. AUDIT
   * non-revocation rolls return null outcomes upstream and never reach here.
   */
  narrateOutcome(outcome: ApprovalOutcome, sourceSpace: string, visitType: VisitType): string;

  /**
   * Phase 7.4 — when the player reaches FINISH without DOB sign-off (status
   * !== 'approved'), apply the end-game penalty (+30 days, +$50K fee). Returns
   * a PlayerUpdateData that the caller applies via StateService.updatePlayer.
   * Returns null if no penalty is owed.
   *
   * Note: time is ADDITIVE in the underlying state (timeSpent += days), so the
   * returned timeSpent value must be the existing value + days. Callers should
   * pass the player's current timeSpent to compute the new total.
   */
  computeEndGamePenalty(player: Player): { dobMissing: boolean; days: number; fee: number; newTimeSpent: number; newMoney: number } | null;

  /**
   * All currently-approved destinations across DOB and FDNY (deduplicated).
   * Returns [] if neither approval is currently 'approved'.
   */
  getApprovedDestinations(player: Player): string[];
}

export class ApprovalService implements IApprovalService {
  resolveDiceOutcome(space: string, visitType: VisitType, roll: number): ApprovalOutcome | null {
    if (space === FDNY_EXAM_SPACE) {
      return this.resolveFdny(visitType, roll);
    }
    if (space === DOB_EXAM_SPACE) {
      return this.resolveDob(visitType, roll);
    }
    if (space === DOB_AUDIT_SPACE) {
      return this.resolveAudit(visitType, roll);
    }
    return null;
  }

  applyOutcome(outcome: ApprovalOutcome): PlayerUpdateData {
    const update: PlayerUpdateData = {};
    if (outcome.approval === 'dob') {
      update.dobApprovalStatus = outcome.kind;
      // On approval, store granted destinations. On objection or denial, clear them
      // so the resume hub doesn't keep offering stale moves.
      update.dobApprovedDestinations = outcome.kind === 'approved' ? (outcome.destinations || []) : [];
    } else {
      update.fdnyApprovalStatus = outcome.kind;
      update.fdnyApprovedDestinations = outcome.kind === 'approved' ? (outcome.destinations || []) : [];
    }
    return update;
  }

  grantProfCertApproval(playerId: string, player: Player): ProfCertGrantResult {
    // Same approval an examiner 'approved' DOB outcome produces — the player
    // self-certified successfully, so the next stop is FDNY.
    const update = this.applyOutcome({ approval: 'dob', kind: 'approved', destinations: DOB_APPROVED_DESTINATIONS });
    return {
      update,
      event: {
        type: 'approval_outcome_determined',
        playerId,
        playerName: player.name,
        spaceName: player.currentSpace,
        approval: 'dob',
        kind: 'approved',
        source: 'prof_cert_self_certify',
        message: '🧾 Your professional certification is accepted — DOB approval granted.',
      },
    };
  }

  revoke(
    player: Player,
    target: RevokeTarget,
    context: { spaceName: string; cardName?: string; reason: 'scope_change' | 'card_effect' }
  ): RevokeResult {
    const hadDob = (target === 'dob' || target === 'both') && player.dobApprovalStatus === 'approved';
    const hadFdny = (target === 'fdny' || target === 'both') && player.fdnyApprovalStatus === 'approved';

    const update: PlayerUpdateData = {};
    if (target === 'dob' || target === 'both') {
      update.dobApprovalStatus = 'none';
      update.dobApprovedDestinations = [];
    }
    if (target === 'fdny' || target === 'both') {
      update.fdnyApprovalStatus = 'none';
      update.fdnyApprovedDestinations = [];
    }

    if (!hadDob && !hadFdny) {
      return { update, event: null };
    }

    const revokedLabel = hadDob && hadFdny ? 'DOB and FDNY approval' : hadDob ? 'DOB approval' : 'FDNY approval';
    const message = context.reason === 'scope_change'
      ? '⚠️ Your DOB approval is on hold — the scope just changed, so it needs a fresh look before you can move on.'
      : `⚠️ ${context.cardName}: your ${revokedLabel} needs to be re-obtained.`;

    return {
      update,
      event: {
        type: 'approval_revoked',
        playerId: player.id,
        playerName: player.name,
        spaceName: context.spaceName,
        cardName: context.cardName,
        message,
      },
    };
  }

  getApprovedDestinations(player: Player): string[] {
    const dests: string[] = [];
    if (player.fdnyApprovalStatus === 'approved' && player.fdnyApprovedDestinations) {
      dests.push(...player.fdnyApprovedDestinations);
    }
    if (player.dobApprovalStatus === 'approved' && player.dobApprovedDestinations) {
      dests.push(...player.dobApprovedDestinations);
    }
    // Dedupe, preserving order.
    return Array.from(new Set(dests));
  }

  checkFinalReviewGate(player: Player): FinalReviewGateResult {
    const dobOk = player.dobApprovalStatus === 'approved';
    const fdnyOk = player.fdnyApprovalStatus === 'approved';

    if (dobOk && fdnyOk) {
      return { passed: true };
    }

    // Both missing → DOB first (spec: "DOB first if both missing").
    if (!dobOk && !fdnyOk) {
      return {
        passed: false,
        missing: 'both',
        routeTo: DOB_EXAM_SPACE,
        reason: 'The clerk reviewed your file and found no DOB approval and no FDNY approval. Sending you back to DOB plan exam first.',
      };
    }

    if (!dobOk) {
      return {
        passed: false,
        missing: 'dob',
        routeTo: DOB_EXAM_SPACE,
        reason: 'The clerk reviewed your file and found no DOB approval. Sending you back to plan exam.',
      };
    }

    // Only FDNY missing.
    return {
      passed: false,
      missing: 'fdny',
      routeTo: FDNY_EXAM_SPACE,
      reason: 'The clerk reviewed your file and found no FDNY sign-off. Sending you to FDNY plan exam.',
    };
  }

  computeEndGamePenalty(player: Player): { dobMissing: boolean; days: number; fee: number; newTimeSpent: number; newMoney: number } | null {
    if (player.dobApprovalStatus === 'approved') {
      return null;
    }
    return {
      dobMissing: true,
      days: MISSING_DOB_PENALTY_DAYS,
      fee: MISSING_DOB_PENALTY_FEE,
      newTimeSpent: (player.timeSpent ?? 0) + MISSING_DOB_PENALTY_DAYS,
      newMoney: (player.money ?? 0) - MISSING_DOB_PENALTY_FEE,
    };
  }

  narrateOutcome(outcome: ApprovalOutcome, sourceSpace: string, visitType: VisitType): string {
    // AUDIT outcomes are always revocation-only (status='minor-objection' on DOB).
    if (sourceSpace === DOB_AUDIT_SPACE) {
      return '⚠️ Audit found issues. DOB approval is on hold — head back to plan exam to clear it up.';
    }

    if (outcome.approval === 'dob') {
      if (outcome.kind === 'approved') {
        return '✅ DOB Plan Examiner: approved. Take it to FDNY next.';
      }
      if (outcome.kind === 'minor-objection') {
        return '⚠️ DOB Plan Examiner: minor objection. Revise and resubmit on the next turn.';
      }
      // denied — DOB sends to architect
      return '❌ DOB Plan Examiner: rejected. Your architect needs to revise the plans before you can come back.';
    }

    // FDNY
    if (outcome.kind === 'approved') {
      return '✅ FDNY Plan Examiner: approved. Pick your next stop.';
    }
    if (outcome.kind === 'minor-objection') {
      return '⚠️ FDNY Plan Examiner: minor objection. Revise and resubmit on the next turn.';
    }
    // FDNY denied — First visit can route to architect (harder); Subsequent always engineer.
    // We can't tell the destination from the outcome alone, so soften the
    // language to cover both cases.
    if (visitType === 'First') {
      return '❌ FDNY Plan Examiner: rejected. Substantial issues — back to the design team to address them.';
    }
    return '❌ FDNY Plan Examiner: rejected. Your engineer needs to fix the issues before you can come back.';
  }

  // --- private resolvers ---

  /**
   * FDNY mapping per spec §3.
   *
   * First visit (harder):
   *   1, 2     → approved
   *   3, 4     → minor objection
   *   5        → engineer denial
   *   6        → architect denial (harder than engineer)
   *
   * Subsequent visit (easier re-submission):
   *   1, 2, 3  → approved
   *   4, 5     → minor objection
   *   6        → engineer denial
   *
   * Both denials are still 'denied' status — the difference is the destination
   * the player gets forced to, which is encoded in the existing dice table and
   * routed by MovementService (we don't override movement here).
   */
  private resolveFdny(visitType: VisitType, roll: number): ApprovalOutcome | null {
    if (roll < 1 || roll > 6) return null;
    if (visitType === 'First') {
      if (roll === 1 || roll === 2) {
        return { approval: 'fdny', kind: 'approved', destinations: FDNY_APPROVED_DESTINATIONS };
      }
      if (roll === 3 || roll === 4) return { approval: 'fdny', kind: 'minor-objection' };
      // roll === 5 (engineer denial) or roll === 6 (architect denial)
      return { approval: 'fdny', kind: 'denied' };
    }
    // Subsequent
    if (roll === 1 || roll === 2 || roll === 3) {
      return { approval: 'fdny', kind: 'approved', destinations: FDNY_APPROVED_DESTINATIONS };
    }
    if (roll === 4 || roll === 5) return { approval: 'fdny', kind: 'minor-objection' };
    // roll === 6
    return { approval: 'fdny', kind: 'denied' };
  }

  /**
   * DOB mapping per spec §3 — derived from the existing dice table.
   *
   * First visit:
   *   1, 5, 6  → approved   (route to REG-FDNY-FEE-REVIEW)
   *   2        → minor objection (loop at DOB)
   *   3, 4     → denied      (route to ARCH-INITIATION)
   *
   * Subsequent visit:
   *   1, 2, 3, 6 → approved
   *   4          → minor objection (loop at DOB)
   *   5          → denied         (route to ARCH-INITIATION)
   */
  private resolveDob(visitType: VisitType, roll: number): ApprovalOutcome | null {
    if (roll < 1 || roll > 6) return null;
    if (visitType === 'First') {
      if (roll === 1 || roll === 5 || roll === 6) {
        return { approval: 'dob', kind: 'approved', destinations: DOB_APPROVED_DESTINATIONS };
      }
      if (roll === 2) return { approval: 'dob', kind: 'minor-objection' };
      // roll 3 or 4
      return { approval: 'dob', kind: 'denied' };
    }
    // Subsequent
    if (roll === 1 || roll === 2 || roll === 3 || roll === 6) {
      return { approval: 'dob', kind: 'approved', destinations: DOB_APPROVED_DESTINATIONS };
    }
    if (roll === 4) return { approval: 'dob', kind: 'minor-objection' };
    // roll 5
    return { approval: 'dob', kind: 'denied' };
  }

  /**
   * Audit mapping per spec §3 — revocation only.
   *
   * Adverse rolls (those that route the audit BACK to REG-DOB-PLAN-EXAM) revoke
   * DOB approval to 'minor-objection'. Other audit destinations leave approval intact.
   *
   * First visit adverse rolls: 2, 3      (route to REG-DOB-PLAN-EXAM in existing data)
   * Subsequent adverse rolls: 3, 4
   *
   * Non-adverse rolls return null (no approval change).
   */
  private resolveAudit(visitType: VisitType, roll: number): ApprovalOutcome | null {
    if (roll < 1 || roll > 6) return null;
    const adverseRolls = visitType === 'First' ? [2, 3] : [3, 4];
    if (adverseRolls.includes(roll)) {
      return { approval: 'dob', kind: 'minor-objection' };
    }
    return null;
  }
}
