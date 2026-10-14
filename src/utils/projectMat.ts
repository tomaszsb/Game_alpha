// projectMat - the player's mat that fills up (Manager brief Job 5, "like Wingspan"). Each tile is a
// milestone on the way to a finished project. Which tiles there are, their order and their labels come
// from TROPHIES.csv (`mat` rows); the checks below are the vocabulary a row can pick from.
// Pure: reads the player and the project finances the panel already computed.

import type { Player } from '../types/DataTypes';
import type { ProjectFinances } from './projectFinances';
import { getTrophyRules, MatCheck } from './trophyRules';

export interface MatTileState {
  id: string;
  label: string;
  done: boolean;
  /** Whole percent (1-99) of the way there, for a tile that can be part done (funding); absent otherwise. */
  percent?: number;
  /** An approval step the examiner turned down ('denied') or raised an objection on: the tile says so instead of just "not yet". */
  trouble?: 'denied' | 'objection';
}

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

/**
 * How far funding has got, from the same numbers that decide "Funded": what the player has raised against what the
 * project commits them to (fb:5617effb). Never 0 or 100: nothing raised is "not yet", everything raised is "done".
 */
function fundingPercent(fin: Pick<ProjectFinances, 'scopeTotal' | 'fundingGap'> & { commitments?: number }): number | undefined {
  const total = fin.commitments ?? 0;
  if (fin.scopeTotal <= 0 || fin.fundingGap <= 0 || total <= 0) return undefined;
  const pct = Math.floor(((total - fin.fundingGap) / total) * 100);
  return pct >= 1 ? Math.min(99, pct) : undefined;
}

export function computeMat(player: Player, fin: Pick<ProjectFinances, 'scopeTotal' | 'fundingGap'> & { commitments?: number }): MatTileState[] {
  return getTrophyRules().mat.map(t => {
    const done = isDone(t.check, player, fin);
    const percent = t.check === 'funded' && !done ? fundingPercent(fin) : undefined;
    const status = t.check === 'dob_approved' ? player.dobApprovalStatus : t.check === 'fdny_approved' ? player.fdnyApprovalStatus : undefined;
    const trouble = status === 'denied' ? 'denied' : status === 'minor-objection' ? 'objection' : undefined;
    return { id: t.id, label: t.label, done, ...(percent === undefined ? {} : { percent }), ...(trouble ? { trouble } : {}) };
  });
}
