/**
 * Cost-preview breakdowns for the two turn-control buttons in PlayerPanelV2's
 * footer (End Turn / Try Again — CSV labels vary per space, e.g. "Lock the
 * scope" / "Push back"), rendered via `TurnCommitControl`. See TODO
 * fb:feedback-1783080349985-a3dc215f.
 *
 * Two entry points:
 *   - getEndTurnCostPreview  — the space's own SPACE_EFFECTS.csv rows for the
 *     current visit type, translated into a friendly 5-row breakdown. This is
 *     the space's declared "base cost, paid once."
 *   - getTryAgainCostPreview — a DIFFERENT breakdown: the real committed spend
 *     this turn (TurnCostLedger.moneySpent — stays spent, not refunded), the
 *     same CSV time-add total (also applied on Try Again — see
 *     TurnService.tryAgainOnSpace), and the space's Work/Expediting/Labor
 *     categories relabeled as "will be re-drawn" (Try Again discards TEMP
 *     card draws so they happen again on the next attempt).
 *
 * Both sides key off which entry point is called (end_turn vs try_again),
 * never off the CSV label text — labels are per-space copy, not a trigger
 * condition.
 *
 * Voice rule (docs/core/CLAUDE.md "no game language"): never surface a raw
 * die number, 🎲, or the word "card". Canonical card-type nouns: W → "Work
 * Package", B → "Bank Loan", E → "Expeditor", I → "Investment". Dice-driven
 * amounts that can't be known ahead of a roll are shown as "Varies", not a
 * number.
 */

import { IServiceContainer } from '../types/ServiceContracts';
import { SpaceEffect, VisitType } from '../types/DataTypes';
import { FormatUtils } from './FormatUtils';
import { extractPercentage, parseFeeFromDescription, determineFeeType } from './parseUtils';

export type CostPreviewRowKey = 'labor' | 'work' | 'expediting' | 'money' | 'time';

export interface CostPreviewRow {
  key: CostPreviewRowKey;
  icon: string;
  label: string;
  value: string;
}

/** Same shape as PlayerPanelV2Props.completedActions / GameState.completedActions
 * — not re-imported from either (both are inline object types, not a named
 * export) but structurally identical, so any real completedActions value from
 * either source satisfies this. */
export interface CompletedActions {
  diceRoll?: string;
  manualActions: { [effectType: string]: string };
}

/**
 * Whether a manual-trigger SpaceEffect has already been resolved this turn.
 * Mirrors the completed-action matching PlayerPanelV2 uses for its own
 * pending-actions button list (see the `mapped` derivation there) — kept here
 * as the single source so the two views can never disagree about what's
 * already done. Only meaningful for `trigger_type === 'manual'` effects;
 * auto-trigger effects (e.g. a space's flat time cost) always apply and have
 * no "completed" state of their own.
 */
export function isManualEffectCompleted(effect: SpaceEffect, completedActions: CompletedActions): boolean {
  if (effect.effect_type === 'dice') {
    return completedActions.diceRoll !== undefined;
  }
  const effectKey = effect.effect_action ? `${effect.effect_type}:${effect.effect_action}` : effect.effect_type;
  const completedKeys = Object.keys(completedActions.manualActions);
  return completedKeys.some(
    (key) =>
      key === effectKey ||
      (!!effect.effect_action && key === effect.effect_action) ||
      key.toLowerCase() === effectKey.toLowerCase() ||
      (!!effect.effect_action && key.toLowerCase() === effect.effect_action.toLowerCase()),
  );
}

const ROW_META: Record<CostPreviewRowKey, { icon: string; label: string }> = {
  // 🏗️ matches ProjectLedger's "Contractor" category icon — Labor covers the
  // contractor Quality/Multiplier roll (CON-INITIATION), the closest thing
  // this data model has to a labor line item.
  labor: { icon: '🏗️', label: 'Labor' },
  // 📐 matches buttonFormatting.ts's canonical W-card icon.
  work: { icon: '📐', label: 'Work' },
  // ⚡ matches buttonFormatting.ts's canonical E-card icon.
  expediting: { icon: '⚡', label: 'Expediting' },
  money: { icon: '💰', label: 'Money' },
  // ⏱️ matches TimeSection's ExpandableSection icon.
  time: { icon: '⏱️', label: 'Time' },
};

const ROW_ORDER: CostPreviewRowKey[] = ['labor', 'work', 'expediting', 'money', 'time'];

/**
 * Sum of the space's own "time add" effects for this visit type — the exact
 * same calculation TurnService.tryAgainOnSpace uses to compute its time
 * penalty (kept here as the single source so the preview can never drift
 * from what pressing the button actually does).
 */
export function calculateSpaceTimeAddTotal(effects: SpaceEffect[]): number {
  return effects
    .filter(e => e.effect_type === 'time' && e.effect_action === 'add')
    .reduce((total, e) => total + Number(e.effect_value || 0), 0);
}

/** Strict numeric parse — only trusts a value that IS a number, never a
 * substring pulled out of narrative text (a paragraph mentioning "20% design
 * fee" must not be misread as a count of 20). */
function parseExactCount(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const trimmed = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function cardNoun(cardType: string, count: number): string {
  const plural = count !== 1;
  switch (cardType) {
    case 'W': return plural ? 'Work Packages' : 'Work Package';
    case 'B': return plural ? 'Bank Loans' : 'Bank Loan';
    case 'I': return plural ? 'Investments' : 'Investment';
    case 'E': return plural ? 'Expeditors' : 'Expeditor';
    default: return cardType;
  }
}

/** Classify one `cards` SpaceEffect row into a bucket + short fragment.
 * Exported so getTryAgainCostPreview can classify the space's own `cards`
 * effects directly (see its money-fragment collection below) rather than
 * re-deriving this from getEndTurnCostPreview's collapsed row output, which
 * can't distinguish a card draw from a fee once both land in the 'money'
 * bucket. */
export function classifyCardEffect(effect: SpaceEffect): { bucket: CostPreviewRowKey; fragment: string } | null {
  const action = (effect.effect_action || '').toLowerCase();
  let verb: 'draw' | 'replace' | 'give' | 'return' | 'transfer';
  let cardType: string;
  if (action.startsWith('draw_')) { verb = 'draw'; cardType = action.slice(5).toUpperCase(); }
  else if (action.startsWith('replace_')) { verb = 'replace'; cardType = action.slice(8).toUpperCase(); }
  else if (action.startsWith('give_')) { verb = 'give'; cardType = action.slice(5).toUpperCase(); }
  else if (action.startsWith('return_')) { verb = 'return'; cardType = action.slice(7).toUpperCase(); }
  else if (action === 'transfer') { verb = 'transfer'; cardType = 'E'; }
  else return null;

  // Life Events aren't part of the 5-row cost schema — they're random
  // narrative events, not a declared cost of taking this action.
  if (cardType === 'L') return null;

  let bucket: CostPreviewRowKey;
  if (cardType === 'W') bucket = 'work';
  else if (cardType === 'E') bucket = 'expediting';
  else if (cardType === 'B' || cardType === 'I') bucket = 'money';
  else return null;

  const parsedCount = parseExactCount(effect.effect_value);
  const count = parsedCount !== null && parsedCount > 0 ? Math.round(parsedCount) : 1;
  const noun = cardNoun(cardType, count);

  let fragment: string;
  switch (verb) {
    case 'draw': fragment = `+${count} ${noun}`; break;
    case 'give': fragment = `-${count} ${noun}`; break;
    case 'return': fragment = `-${count} ${noun}`; break;
    case 'replace': fragment = `Replace ${count} ${noun}`; break;
    case 'transfer': fragment = 'Expeditor reassigned'; break;
  }
  return { bucket, fragment };
}

/** Classify one `dice` SpaceEffect row. The outcome is unknowable ahead of
 * the roll, so the value is always the plain word "Varies" — never a
 * simulated/guessed number, and never the die face itself.
 *
 * `kind` distinguishes the two flavors that share the 'money' bucket: a
 * dice-drawn Bank Loan/Investment card ('draw', an inflow this turn — TEMP
 * rollback discards and re-rolls it on Try Again) vs a dice-determined fee
 * ('fee', an outflow only charged on commit — never applies on Try Again).
 * Both render identically ("Varies") on the End Turn side; `kind` only
 * matters to getTryAgainCostPreview, which must include the former and
 * exclude the latter. Exported for that reuse — see its money-fragment
 * collection below. */
export function classifyDiceEffect(effect: SpaceEffect): { bucket: CostPreviewRowKey; fragment: string; kind: 'draw' | 'fee' } | null {
  const cat = String(effect.effect_value || '').trim().toLowerCase();
  if (cat === 'w cards' || cat === 'w card') return { bucket: 'work', fragment: 'Varies', kind: 'draw' };
  if (cat === 'e cards' || cat === 'e card') return { bucket: 'expediting', fragment: 'Varies', kind: 'draw' };
  if (cat === 'i cards' || cat === 'i card' || cat === 'b cards' || cat === 'b card') return { bucket: 'money', fragment: 'Varies', kind: 'draw' };
  if (cat === 'quality' || cat === 'multiplier') return { bucket: 'labor', fragment: 'Varies', kind: 'draw' };
  if (cat === 'time outcomes' || cat === 'time') return { bucket: 'time', fragment: 'Varies', kind: 'draw' };
  if (cat === 'fee paid' || cat === 'fees paid') return { bucket: 'money', fragment: 'Varies', kind: 'fee' };
  // 'l cards', 'next step', and anything else fall outside the 5-row schema.
  return null;
}

/** Best-effort friendly text for a `fee` SpaceEffect row. Fixed fees resolve
 * to an exact dollar figure; percentage-of-scope fees resolve exactly since
 * scope is already known; loan-percentage and dice-based fees can't be
 * pinned to a dollar amount ahead of time (the loan/roll hasn't happened),
 * so they surface the percentage or "Varies" instead of guessing. */
function classifyFeeEffect(
  effect: SpaceEffect,
  gameServices: IServiceContainer,
  playerId: string
): string | null {
  const desc = String(effect.effect_value || '');
  const feeType = effect.fee_type || determineFeeType(desc);

  if (feeType === 'FIXED') {
    const parsed = parseFeeFromDescription(desc);
    if (parsed && parsed.type === 'fixed' && parsed.value > 0) {
      return `-${FormatUtils.formatMoney(parsed.value, { compact: false })}`;
    }
    return null; // unparseable/narrative-only fee text — nothing concrete to show
  }

  if (feeType === 'SCOPE_PERCENTAGE') {
    const pct = extractPercentage(desc);
    if (pct === null || pct <= 0) return 'Varies';
    const scope = gameServices.gameRulesService.calculateProjectScope(playerId);
    const amount = Math.round(scope * (pct / 100));
    return amount > 0 ? `-${FormatUtils.formatMoney(amount, { compact: false })}` : `${pct}% of your project scope`;
  }

  if (feeType === 'LOAN_PERCENTAGE' || feeType === 'LOAN_TIERED') {
    const percents = Array.from(desc.matchAll(/(\d+(?:\.\d+)?)%/g)).map(m => parseFloat(m[1]));
    if (percents.length > 1) return `Up to ${Math.max(...percents)}% of your loan`;
    if (percents.length === 1) return `${percents[0]}% of your loan`;
    return 'Varies';
  }

  // DICE_BASED or unrecognized — genuinely not knowable ahead of time.
  return 'Varies';
}

const DICE_DRAW_CARD_TYPE: Record<string, string> = {
  'w cards': 'W', 'w card': 'W',
  'e cards': 'E', 'e card': 'E',
  'i cards': 'I', 'i card': 'I',
  'b cards': 'B', 'b card': 'B',
};

/**
 * Real outcome of a dice-triggered card draw, once it's actually happened
 * this turn — read from the action log, the only place the real drawn
 * count (and, for Work Packages, the scope delta) live; TurnCostLedger only
 * tracks outflows, not draws. Mirrors formatActionDescription's card_draw
 * case (actionLogFormatting.ts) so the two surfaces never disagree about
 * what a draw is worth. Returns null if the roll hasn't resolved yet or the
 * dice category isn't a recognized card-draw kind.
 *
 * Deliberately does NOT use getDisplayableLogEntries — its isCommitted
 * filter is right for the post-hoc Chronicle/Log (only show finalized
 * history) but wrong here: a card drawn earlier THIS turn is still
 * uncommitted TEMP state (only promoted to real/committed history once End
 * Turn actually resolves it), so requiring isCommitted would always find
 * nothing for the one turn this function needs to see. Confirmed live
 * 2026-08-19: a real drawn card's log entry had isCommitted: false.
 */
function findTurnCardDrawFragment(
  gameServices: IServiceContainer,
  playerId: string,
  diceCategory: string,
): string | null {
  const cardType = DICE_DRAW_CARD_TYPE[diceCategory.trim().toLowerCase()];
  if (!cardType) return null;
  const state = gameServices.stateService.getGameState();
  // LoggingService stamps globalTurnNumber as `globalTurnCount || 1` — on
  // the game's very first turn globalTurnCount is still 0 (not yet
  // incremented by advanceTurn), so entries logged this turn carry
  // globalTurnNumber 1, not 0. Match that same fallback here or every
  // first-turn draw silently misses (confirmed live 2026-08-19).
  const currentTurn = state.globalTurnCount || 1;
  const entries = (state.globalActionLog || []).filter(
    (e) =>
      e.type === 'card_draw' &&
      e.playerId === playerId &&
      e.visibility === 'player' &&
      e.globalTurnNumber === currentTurn &&
      e.details?.cardType === cardType,
  );
  if (entries.length === 0) return null;

  let count = 0;
  let scopeDelta = 0;
  for (const e of entries) {
    count += Number(e.details?.count ?? e.details?.cardCount ?? 0);
    scopeDelta += Number(e.details?.scopeDelta ?? 0);
  }
  if (count <= 0) return null;

  let fragment = `+${count} ${cardNoun(cardType, count)}`;
  if (cardType === 'W' && scopeDelta > 0) fragment += ` (+$${scopeDelta.toLocaleString()})`;
  return fragment;
}

function pushFragment(buckets: Partial<Record<CostPreviewRowKey, string[]>>, bucket: CostPreviewRowKey, fragment: string | null): void {
  if (!fragment) return;
  (buckets[bucket] ??= []).push(fragment);
}

function bucketsToRows(buckets: Partial<Record<CostPreviewRowKey, string[]>>): CostPreviewRow[] {
  return ROW_ORDER
    .filter(key => (buckets[key]?.length ?? 0) > 0)
    .map(key => ({
      key,
      icon: ROW_META[key].icon,
      label: ROW_META[key].label,
      value: buckets[key]!.join(' + '),
    }));
}

/**
 * Expands a populated-only row list (the default from getEndTurnCostPreview /
 * getTryAgainCostPreview) into all 5 categories in fixed order, filling any
 * missing one with `emptyValue`. For `TurnCommitControl` (dark-mode A/B
 * variant, fb:f453b1f3 follow-up): the player asked for all 5 rows to always
 * show so only the VALUE column changes between spaces, rather than rows
 * appearing/disappearing. Kept as a separate helper (not a change to the two
 * exported preview functions) so the light-mode `TurnCostToggle` keeps its
 * original populated-only + "Nothing to report" behavior untouched.
 */
export function toFullRowSet(rows: CostPreviewRow[], emptyValue: string = '—'): CostPreviewRow[] {
  return ROW_ORDER.map((key) => {
    const existing = rows.find((r) => r.key === key);
    if (existing) return existing;
    return { key, icon: ROW_META[key].icon, label: ROW_META[key].label, value: emptyValue };
  });
}

/**
 * "Lock the scope" / End Turn preview — the space's own declared cost for
 * this visit, read straight from SPACE_EFFECTS.csv (via DataService, already
 * loaded). Paid once, kept.
 */
export function getEndTurnCostPreview(
  gameServices: IServiceContainer,
  spaceName: string,
  visitType: VisitType,
  playerId: string,
  completedActions: CompletedActions = { manualActions: {} }
): CostPreviewRow[] {
  const effects = gameServices.dataService.getSpaceEffects(spaceName, visitType) || [];
  const buckets: Partial<Record<CostPreviewRowKey, string[]>> = {};

  const timeDays = calculateSpaceTimeAddTotal(effects);
  if (timeDays !== 0) {
    pushFragment(buckets, 'time', `+${timeDays} day${Math.abs(timeDays) === 1 ? '' : 's'}`);
  }

  for (const effect of effects) {
    // An already-completed manual action (e.g. the player already pressed
    // "Get Work Packages" and it resolved to 3 cards) is no longer a
    // remaining cost of pressing End Turn — the CSV row is a static
    // per-visit declaration, not a per-turn one, so without this check it
    // would keep showing "Varies" for something that already happened
    // (fb:feedback-1783922070233-49395e17). But going blank ("—") once it's
    // done isn't right either (maintainer feedback 2026-08-18): show what
    // actually happened instead — "+3 Work Packages", "-$34,000", etc. —
    // not nothing.
    if (effect.trigger_type === 'manual' && isManualEffectCompleted(effect, completedActions)) {
      if (effect.effect_type === 'cards') {
        // A fixed-count CSV row (not a dice roll) — the "pre-action"
        // fragment already IS the real outcome, since the count was never
        // random. Keep showing it rather than dropping it once it's done.
        const result = classifyCardEffect(effect);
        if (result) pushFragment(buckets, result.bucket, result.fragment);
      } else if (effect.effect_type === 'dice') {
        const classified = classifyDiceEffect(effect);
        if (classified?.kind === 'fee') {
          // Rolling turns "Varies" into a concrete, known dollar figure —
          // and a button literally labeled "Pay the fee" is about to lock
          // it in. Surface what was actually charged (this turn's outflow
          // ledger) instead of just skipping.
          const ledger = gameServices.stateService.getTurnOutflow(playerId);
          if (ledger.moneySpent > 0) {
            pushFragment(buckets, 'money', `${FormatUtils.formatMoney(ledger.moneySpent, { compact: false })} paid`);
          }
        } else if (classified?.kind === 'draw') {
          // The card type/count wasn't knowable before the roll; now it's
          // in the action log — read the real result from there instead of
          // leaving "Varies" or dropping the row. Only recognizes W/E/I/B
          // card-draw categories (findTurnCardDrawFragment returns null for
          // anything else); 'quality'/'multiplier' (labor) and 'time
          // outcomes' dice kinds have no card-draw or ledger-backed real
          // outcome available here yet, so they still drop to "—" rather
          // than guess.
          const drawn = findTurnCardDrawFragment(gameServices, playerId, String(effect.effect_value || ''));
          if (drawn) pushFragment(buckets, classified.bucket, drawn);
        }
      } else if (effect.effect_type === 'fee' && effect.effect_action === 'deduct') {
        // Same reasoning as the dice-fee case above, generalized to a flat
        // (non-dice) fee — it's paid the moment it completes either way.
        const ledger = gameServices.stateService.getTurnOutflow(playerId);
        if (ledger.moneySpent > 0) {
          pushFragment(buckets, 'money', `${FormatUtils.formatMoney(ledger.moneySpent, { compact: false })} paid`);
        }
      }
      continue;
    }
    if (effect.effect_type === 'cards') {
      const result = classifyCardEffect(effect);
      if (result) pushFragment(buckets, result.bucket, result.fragment);
    } else if (effect.effect_type === 'dice') {
      const result = classifyDiceEffect(effect);
      if (result) pushFragment(buckets, result.bucket, result.fragment);
    } else if (effect.effect_type === 'fee' && effect.effect_action === 'deduct') {
      pushFragment(buckets, 'money', classifyFeeEffect(effect, gameServices, playerId));
    }
  }

  // OWNER-FUND-INITIATION auto-applies "owner seed money" (80–120% of
  // project scope, ManualActionProcessor.handleAutomaticFunding) the moment
  // the player arrives, before they can act at all — it's not a
  // SPACE_EFFECTS.csv row, so nothing above has any way to see it. Surface
  // the actual amount already offered (moneySources.ownerFunding, the
  // single source of truth for this) so "Take the check" doesn't show
  // nothing for the exact figure the space's own narrative just quoted.
  if (gameServices.dataService.shouldAutoApplyFunding(spaceName)) {
    const player = gameServices.stateService.getPlayer(playerId);
    const offered = player?.moneySources?.ownerFunding ?? 0;
    if (offered > 0) {
      pushFragment(buckets, 'money', `+${FormatUtils.formatMoney(offered, { compact: false })} offered`);
    }
  }

  return bucketsToRows(buckets);
}

/**
 * "Push back" / Try Again preview — DIFFERENT numbers from End Turn:
 *   - Time: the same CSV time-add total (also applied by tryAgainOnSpace).
 *   - Money: the real TurnCostLedger.moneySpent for this turn — stays spent,
 *     is NOT refunded (tryAgainOnSpace deducts it from REAL money).
 *   - Work / Expediting / Labor: whichever of those categories this space
 *     declares, relabeled — the draws get discarded (TEMP rollback) and
 *     redone on the next attempt, not kept and not refunded as cards.
 */
export function getTryAgainCostPreview(
  gameServices: IServiceContainer,
  playerId: string
): CostPreviewRow[] {
  const player = gameServices.stateService.getPlayer(playerId);
  if (!player) return [];

  const effects = gameServices.dataService.getSpaceEffects(player.currentSpace, player.visitType) || [];
  const rows: CostPreviewRow[] = [];

  const timeDays = calculateSpaceTimeAddTotal(effects);
  if (timeDays !== 0) {
    rows.push({
      key: 'time',
      icon: ROW_META.time.icon,
      label: ROW_META.time.label,
      value: `+${timeDays} day${Math.abs(timeDays) === 1 ? '' : 's'}`,
    });
  }

  // ---- money: real spend (sticks) vs drawn loans/investments/seed money
  // (revert) — two different fates that must not be conflated into one
  // check, since getEndTurnCostPreview's own 'money' bucket mixes them with
  // FEE text that must NEVER appear here (a fee is only charged on commit).
  const moneyFragments: string[] = [];
  const ledger = gameServices.stateService.getTurnOutflow(playerId);
  if (ledger.moneySpent > 0) {
    moneyFragments.push(`${FormatUtils.formatMoney(ledger.moneySpent, { compact: false })} stays spent`);
  }
  // Bank Loan / Investment draws (via a `cards` row, or a `dice` row like
  // INVESTOR-FUND-REVIEW's "I cards" outcome) are inflows the space
  // declares — like Work/Expediting/Labor below, TEMP rollback discards
  // them and the next attempt re-draws. Classified directly from the
  // space's own effects (not from getEndTurnCostPreview's collapsed money
  // bucket) so a fee fragment can never leak in here alongside them.
  let hasMoneyDraw = effects.some((effect) => {
    if (effect.effect_type === 'cards') return classifyCardEffect(effect)?.bucket === 'money';
    if (effect.effect_type === 'dice') {
      const result = classifyDiceEffect(effect);
      return result?.bucket === 'money' && result.kind === 'draw';
    }
    return false;
  });
  // Owner seed money (OWNER-FUND-INITIATION) isn't a SPACE_EFFECTS row at
  // all — see getEndTurnCostPreview's comment — but it's the same shape of
  // "inflow that reverts": a fresh random amount gets rolled again on the
  // next attempt.
  if (gameServices.dataService.shouldAutoApplyFunding(player.currentSpace)) hasMoneyDraw = true;
  if (hasMoneyDraw) {
    moneyFragments.push('Will be re-drawn next turn');
  }
  if (moneyFragments.length > 0) {
    rows.push({
      key: 'money',
      icon: ROW_META.money.icon,
      label: ROW_META.money.label,
      value: moneyFragments.join(' + '),
    });
  }

  // Deliberately NOT threading completedActions through here (unlike the End
  // Turn preview above) — Try Again rolls TEMP state back to REAL
  // (TurnService.tryAgainOnSpace), which discards card draws AND dice
  // outcomes from this attempt regardless of whether they already resolved.
  // So even an already-completed Work/Expediting/Labor action is genuinely
  // "will be re-drawn next turn" — filtering it out here would hide a row
  // that's still an accurate consequence of pressing this button.
  const baseCost = getEndTurnCostPreview(gameServices, player.currentSpace, player.visitType, playerId);
  for (const row of baseCost) {
    if (row.key === 'work' || row.key === 'expediting' || row.key === 'labor') {
      rows.push({ ...row, value: 'Will be re-drawn next turn' });
    }
  }

  return ROW_ORDER.map(key => rows.find(r => r.key === key)).filter((r): r is CostPreviewRow => !!r);
}
