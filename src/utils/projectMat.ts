// projectMat - the player's mat that fills up (Manager brief Job 5, "like Wingspan"). Each tile is a
// milestone on the way to a finished project. Which tiles there are, their order and their labels come
// from TROPHIES.csv (`mat` rows); the checks below are the vocabulary a row can pick from.
// Pure: reads the player and the project finances the panel already computed.

import type { Player } from '../types/DataTypes';
import type { ProjectFinances } from './projectFinances';
import { getTrophyRules, MatCheck } from './trophyRules';

export interface MatTileState { id: string; label: string; done: boolean }

function isDone(check: MatCheck, player: Player, fin: Pick<ProjectFinances, 'scopeTotal' | 'fundingGap'>): boolean {
  switch (check) {
    case 'scope_set': return fin.scopeTotal > 0;
    case 'funded': return fin.scopeTotal > 0 && fin.fundingGap === 0;
    case 'architect_paid': return (player.costs?.architectural ?? 0) > 0;
    case 'engineer_paid': return (player.costs?.engineering ?? 0) > 0;
    case 'dob_approved': return player.dobApprovalStatus === 'approved';
    case 'fdny_approved': return player.fdnyApprovalStatus === 'approved';
    case 'builder_hired': return !!player.contractor;
    case 'finished': return player.finishedAtTurn !== undefined;
  }
}

export function computeMat(player: Player, fin: Pick<ProjectFinances, 'scopeTotal' | 'fundingGap'>): MatTileState[] {
  return getTrophyRules().mat.map(t => ({ id: t.id, label: t.label, done: isDone(t.check, player, fin) }));
}
