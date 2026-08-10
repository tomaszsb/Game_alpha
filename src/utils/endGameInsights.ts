// src/utils/endGameInsights.ts
//
// v3.0.13 — Project Debrief: turn the end-game stats into plain-English
// observations the player can actually act on next game. v3.0.11 shipped the
// data layer (buildEndGameStats); this is the wisdom layer.
//
// Design notes:
//   - Three tones: 'win' (positive, celebrate), 'observe' (neutral, factual),
//     'lesson' (constructive, "next time…"). No paternalistic scolding —
//     observations are factual, lessons are gentle suggestions tied to specific
//     numbers the player can see.
//   - Each rule is a pure (stats, player) → Observation | null. Caller runs all
//     and picks the top N by priority so the panel doesn't overwhelm.
//   - Every insight ties to a concrete number. "You spent 45 days in regulatory
//     review" beats "you spent too long in regulatory review."

import { Player } from '../types/DataTypes';
import { EndGameStats } from './endGameStats';
import { getDobLabel, getFdnyLabel } from '../services/ApprovalService';

export type InsightTone = 'win' | 'observe' | 'lesson';

export interface Insight {
  tone: InsightTone;
  /** Short headline (≤80 chars). Renders on the chip. */
  headline: string;
  /** Optional second-line elaboration. */
  detail?: string;
  /** Priority (higher = shown first). Used for the cap-to-N sort. */
  priority: number;
  /** Rule id for tests / debugging. */
  id: string;
}

const REG_PREFIXES = ['REG-DOB-', 'REG-FDNY-'];

function isRegSpace(spaceName: string): boolean {
  return REG_PREFIXES.some(p => spaceName.startsWith(p));
}

// === Rules ===
// Each returns a single Insight or null. Order in the array is not significant
// — caller sorts by priority. Rule ids are kebab-case for grep-ability in
// tests and logs.

type Rule = (stats: EndGameStats, player: Player) => Insight | null;

const rules: Rule[] = [
  // === PACING ===
  (stats) => {
    if (stats.turnsTaken > 0 && stats.turnsTaken <= 10) {
      return { id: 'fast-finish', tone: 'win', priority: 60, headline: `Wrapped in ${stats.turnsTaken} turns — well under typical.` };
    }
    return null;
  },
  (stats) => {
    if (stats.turnsTaken >= 20) {
      return {
        id: 'long-finish', tone: 'observe', priority: 40,
        headline: `${stats.turnsTaken} turns is a marathon.`,
        detail: 'Most projects clear in 12–16. Watch for repeat visits to the same space — that\'s where games stretch.',
      };
    }
    return null;
  },

  // === BUDGET ===
  (stats, player) => {
    const totalFunds = stats.fundingMix.total;
    if (totalFunds > 0 && player.money > 0 && player.money < totalFunds * 0.05) {
      return {
        id: 'squeaked-by', tone: 'win', priority: 70,
        headline: `Squeaked through with $${player.money.toLocaleString()} left.`,
        detail: 'Tight budget management — risk paid off.',
      };
    }
    return null;
  },
  (stats, player) => {
    const totalFunds = stats.fundingMix.total;
    if (totalFunds > 0 && player.money > totalFunds * 0.3) {
      const pct = Math.round((player.money / totalFunds) * 100);
      return {
        id: 'loose-budget', tone: 'observe', priority: 35,
        headline: `Finished with ~${pct}% of funding unspent.`,
        detail: 'Room to take on more scope or pay for premium contractors next time.',
      };
    }
    return null;
  },

  // === EXPEDITORS ===
  (stats) => {
    if (stats.cardCounts.E === 0) {
      return {
        id: 'no-expeditors', tone: 'lesson', priority: 55,
        headline: 'You never hired an expeditor.',
        detail: 'Expeditors shave days in regulatory review — worth experimenting with next game.',
      };
    }
    return null;
  },
  (stats) => {
    if (stats.cardCounts.E >= 4) {
      return {
        id: 'expeditor-heavy', tone: 'win', priority: 50,
        headline: `${stats.cardCounts.E} expeditors hired — aggressive use of accelerants.`,
      };
    }
    return null;
  },

  // === APPROVALS ===
  (stats) => {
    if (stats.approvals.dob === 'approved' && stats.approvals.fdny === 'approved') {
      return {
        id: 'all-approved', tone: 'win', priority: 80,
        headline: `Both ${getDobLabel()} and ${getFdnyLabel()} signed off cleanly.`,
        detail: 'Solid documentation and prep — that\'s the gold-standard ending.',
      };
    }
    return null;
  },
  (stats) => {
    if (stats.approvals.dob === 'none') {
      return {
        id: 'dob-missing', tone: 'lesson', priority: 90,
        headline: `${getDobLabel()} never weighed in on the project.`,
        detail: `That's the path that triggers the late-CO emergency-processing penalty. Push for ${getDobLabel()} plan exam earlier.`,
      };
    }
    return null;
  },
  (stats) => {
    if (stats.approvals.dob === 'denied' || stats.approvals.fdny === 'denied') {
      const denied = [
        stats.approvals.dob === 'denied' ? getDobLabel() : null,
        stats.approvals.fdny === 'denied' ? getFdnyLabel() : null,
      ].filter(Boolean).join(' and ');
      return {
        id: 'approval-denied', tone: 'lesson', priority: 85,
        headline: `${denied} denied approval.`,
        detail: 'Higher Fit score (more design diligence before submitting) reduces denial odds.',
      };
    }
    return null;
  },
  (stats) => {
    if (stats.approvals.dob === 'minor-objection' || stats.approvals.fdny === 'minor-objection') {
      return {
        id: 'minor-objection', tone: 'observe', priority: 45,
        headline: 'Cleared with a minor objection.',
        detail: 'Approved with caveats — usually means one round of revision in real life.',
      };
    }
    return null;
  },

  // === FUNDING MIX ===
  (stats) => {
    const total = stats.fundingMix.total;
    if (total <= 0) return null;
    if (stats.fundingMix.owner / total >= 0.7) {
      return {
        id: 'self-funded', tone: 'win', priority: 55,
        headline: 'Mostly self-funded — no debt service to drag the budget.',
      };
    }
    return null;
  },
  (stats) => {
    const total = stats.fundingMix.total;
    if (total <= 0) return null;
    if (stats.fundingMix.bank / total >= 0.6) {
      const pct = Math.round((stats.fundingMix.bank / total) * 100);
      return {
        id: 'bank-heavy', tone: 'observe', priority: 40,
        headline: `Bank loans funded ~${pct}% of the project.`,
        detail: 'Loans carry interest — try mixing in investor money to reduce repayment pressure.',
      };
    }
    return null;
  },
  (stats) => {
    const total = stats.fundingMix.total;
    if (total <= 0) return null;
    if (stats.fundingMix.investor / total >= 0.6) {
      const pct = Math.round((stats.fundingMix.investor / total) * 100);
      return {
        id: 'investor-heavy', tone: 'observe', priority: 40,
        headline: `Investors funded ~${pct}% of the project.`,
        detail: 'Heavy investor reliance means investment fees ate into the budget — bank loans are sometimes cheaper.',
      };
    }
    return null;
  },

  // === CONTRACTOR ===
  (stats) => {
    if (stats.construction.contractorQuality === 'HIGH') {
      return {
        id: 'high-contractor', tone: 'win', priority: 50,
        headline: 'HIGH-quality contractor — paid premium for clean construction.',
      };
    }
    return null;
  },
  (stats) => {
    if (stats.construction.contractorQuality === 'LOW') {
      return {
        id: 'low-contractor', tone: 'observe', priority: 45,
        headline: 'LOW-quality contractor — cheaper upfront, but expect rework days.',
      };
    }
    return null;
  },

  // === REGULATORY TIME ===
  (stats) => {
    if (stats.daysTotal <= 0 || stats.journey.length === 0) return null;
    const regDays = stats.journey
      .filter(step => isRegSpace(step.spaceName))
      .reduce((sum, step) => sum + step.daysSpent, 0);
    if (regDays > 0 && regDays / stats.daysTotal >= 0.4) {
      const pct = Math.round((regDays / stats.daysTotal) * 100);
      return {
        id: 'regulatory-heavy', tone: 'observe', priority: 50,
        headline: `~${pct}% of your days went to regulatory review.`,
        detail: 'Expeditors and a higher Fit score before submission both cut this down.',
      };
    }
    return null;
  },

  // === REVISITS ===
  (stats) => {
    if (stats.journey.length < 5) return null;
    const unique = new Set(stats.journey.map(s => s.spaceName)).size;
    const ratio = unique / stats.journey.length;
    if (ratio < 0.7) {
      const revisits = stats.journey.length - unique;
      return {
        id: 'revisits', tone: 'observe', priority: 35,
        headline: `${revisits} repeat visit${revisits === 1 ? '' : 's'} across the project.`,
        detail: 'Circling back happens — usually denied approvals or scope changes triggering rework.',
      };
    }
    return null;
  },

  // === LIFE EVENTS ===
  (stats) => {
    if (stats.cardCounts.L >= 3) {
      return {
        id: 'life-event-heavy', tone: 'observe', priority: 40,
        headline: `${stats.cardCounts.L} life events hit during the project.`,
        detail: 'Bad luck or risky path? Life events fire on specific dice faces — different routes have different exposure.',
      };
    }
    return null;
  },

  // === FEES ===
  (stats) => {
    if (stats.projectScope <= 0) return null;
    const ratio = stats.feesBreakdown.totalFees / stats.projectScope;
    if (ratio < 0.1 && stats.feesBreakdown.totalFees > 0) {
      const pct = Math.round(ratio * 100);
      return {
        id: 'fee-efficient', tone: 'win', priority: 55,
        headline: `Fees came in at ~${pct}% of scope — efficient routing.`,
      };
    }
    return null;
  },
  (stats) => {
    if (stats.projectScope <= 0) return null;
    const ratio = stats.feesBreakdown.totalFees / stats.projectScope;
    if (ratio >= 0.25) {
      const pct = Math.round(ratio * 100);
      return {
        id: 'fee-overload', tone: 'observe', priority: 45,
        headline: `Fees ate ~${pct}% of project scope.`,
        detail: 'Heavy regulatory load or repeat reviews. Approvals on first try cut this dramatically.',
      };
    }
    return null;
  },

  // === SCOPE SIZE ===
  (stats) => {
    if (stats.projectScope >= 2_000_000) {
      return {
        id: 'big-project', tone: 'win', priority: 65,
        headline: `$${(stats.projectScope / 1_000_000).toFixed(1)}M project completed — major build.`,
      };
    }
    return null;
  },
];

/**
 * Run every rule and return the top N insights, sorted by priority (highest
 * first). Default cap = 5 so the panel doesn't overwhelm the celebration.
 */
export function buildEndGameInsights(
  stats: EndGameStats,
  player: Player,
  opts: { maxInsights?: number } = {},
): Insight[] {
  const max = opts.maxInsights ?? 5;
  const all: Insight[] = [];
  for (const rule of rules) {
    const insight = rule(stats, player);
    if (insight) all.push(insight);
  }
  // Sort by priority descending; stable order is fine since each rule emits at
  // most one insight and priority numbers don't fully collide in practice.
  all.sort((a, b) => b.priority - a.priority);
  return all.slice(0, max);
}

// Exported for tests so a regression can pin the rule list.
export const _testOnly = { rules };
