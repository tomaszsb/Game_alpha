// The robot banker's rule table and its one decision function. Pure: no services, no state.
//
// Every number and every sentence lives in BANKER.csv (kind,key,value,text), read through
// DataService and handed to configureBankerRules. DEFAULT_BANKER_ROWS below is the same table, used
// when the file is missing (and by tests); a test pins that the two stay identical.
//
// The banker has two goals, weighted by `safe_weight` / `profit_weight` (Tom: 50/50):
//   safe   = how likely the project is to finish on schedule (the schedule fixed at the moment of the loan)
//   profit = what the bank earns on the loan (interest + filing fee), against a reference amount
// decide(offer, situation) answers approve / counter / refuse. A human banker seat can return the same object.

export interface BankerRow { kind: string; key: string; value: string; text: string }

export interface BankerOffer {
  /** Dollars the card offers (already capped at the funding gap). */
  amount: number;
  /** Interest in percent (5, 10, 15). */
  rate: number;
}

export interface BankerSituation {
  /** Everything the project must pay for (scope + design + filings + contingency). */
  costToFinish: number;
  cash: number;
  daysUsed: number;
  plannedDays: number;
  pushBacks: number;
  hasBuilderBid: boolean;
  hasExpeditor: boolean;
  /** True only when this bank has already lent to this project. */
  bankLentBefore: boolean;
  /** How many times this bank has refused this player so far. */
  refusals: number;
}

export type BankerAnswer = 'approve' | 'counter' | 'refuse';

export interface BankerDecision {
  answer: BankerAnswer;
  /** Amount the bank will lend (0 on a refusal). */
  amount: number;
  rate: number;
  /** The banker's sentences, most telling first. The pop-up shows the top two. */
  reasons: string[];
  score: number;
  safe: number;
  profit: number;
  /** True when this refusal is the last one: the bank declines for good and the student goes to the investor. */
  final: boolean;
}

export const DEFAULT_BANKER_ROWS: BankerRow[] = [
  { kind: 'param', key: 'safe_weight', value: '0.5', text: 'Half of the banker\'s goal: be repaid on time (finish on schedule).' },
  { kind: 'param', key: 'profit_weight', value: '0.5', text: 'Half of the banker\'s goal: earn the most.' },
  { kind: 'param', key: 'approve_first', value: '0.70', text: 'First visit: score at or above this and the bank lends what the card says.' },
  { kind: 'param', key: 'counter_first', value: '0.50', text: 'First visit: score at or above this (and below the line above) and the bank counters.' },
  { kind: 'param', key: 'approve_return', value: '0.60', text: 'Return visit, only when the bank already lent to this project.' },
  { kind: 'param', key: 'counter_return', value: '0.40', text: 'Return visit, only when the bank already lent to this project.' },
  { kind: 'param', key: 'counter_safe', value: '0.60', text: 'A smaller counter-offer must reach this safe score.' },
  { kind: 'param', key: 'profit_ref', value: '18', text: 'Interest rate plus filing fee, in percent, that counts as profit 1.0 (what the bank earns on each dollar lent).' },
  { kind: 'param', key: 'max_refusals', value: '2', text: 'After this many refusals the bank declines for good.' },
  { kind: 'param', key: 'rate_step', value: '5', text: 'A rate counter goes up by this many percent.' },
  { kind: 'param', key: 'rate_max', value: '15', text: 'The bank never charges more than this percent.' },
  { kind: 'param', key: 'pushback_penalty', value: '0.08', text: 'Safe score lost for each push-back so far.' },
  { kind: 'param', key: 'builder_bonus', value: '0.08', text: 'Safe score gained when a builder is already chosen.' },
  { kind: 'param', key: 'expeditor_bonus', value: '0.05', text: 'Safe score gained when the student holds an expeditor.' },
  // pace: days used / days planned at the moment of the loan -> safe score
  { kind: 'pace', key: '0.25', value: '1', text: 'Up to a quarter of the planned days used.' },
  { kind: 'pace', key: '0.5', value: '0.85', text: 'Up to half.' },
  { kind: 'pace', key: '0.75', value: '0.65', text: 'Up to three quarters.' },
  { kind: 'pace', key: '1', value: '0.4', text: 'Up to the whole plan.' },
  { kind: 'pace', key: '99', value: '0.15', text: 'Already past the plan.' },
  // share: loan / cost to finish -> safe score
  { kind: 'share', key: '0.1', value: '1', text: 'Loan up to 10% of the cost.' },
  { kind: 'share', key: '0.2', value: '0.8', text: 'Up to 20%.' },
  { kind: 'share', key: '0.3', value: '0.55', text: 'Up to 30%.' },
  { kind: 'share', key: '0.4', value: '0.3', text: 'Up to 40%.' },
  { kind: 'share', key: '99', value: '0.1', text: 'More than 40%.' },
  // fee: filing fee percent by loan size (the bank's own fee row)
  { kind: 'fee', key: '1400000', value: '1', text: 'Up to $1.4M' },
  { kind: 'fee', key: '2750000', value: '2', text: 'Up to $2.75M' },
  { kind: 'fee', key: '999999999', value: '3', text: 'Above' },
  // settle: paid or given back when the project finishes (percent of the loan; early = share of interest returned)
  { kind: 'settle', key: 'early_within_pct', value: '10', text: 'Finished this many percent early or more: the bank gives back part of its interest.' },
  { kind: 'settle', key: 'early_refund_share', value: '25', text: 'Percent of the interest given back on an early finish.' },
  { kind: 'settle', key: 'ontime_within_pct', value: '10', text: 'Within this many percent either way: nothing.' },
  { kind: 'settle', key: 'late_to_50', value: '0.5', text: 'Percent of the loan paid when 11 to 50 percent late.' },
  { kind: 'settle', key: 'late_to_100', value: '1', text: 'Percent of the loan paid when 51 to 100 percent late.' },
  { kind: 'settle', key: 'late_over_100', value: '2', text: 'Percent of the loan paid when more than twice the plan.' },
  // reasons: the banker's voice. value = priority (higher is shown first). {amount} {rate} {share} {asked} are filled in.
  { kind: 'reason', key: 'approve_clean', value: '5', text: 'The numbers hold together. I will lend you {amount} at {rate} percent.' },
  { kind: 'reason', key: 'share_high', value: '9', text: 'You are asking me for {share} percent of what this job costs. That is a lot of my money on one project.' },
  { kind: 'reason', key: 'share_low', value: '4', text: 'This is a small part of what the job costs, so I am comfortable with it.' },
  { kind: 'reason', key: 'pace_late', value: '9', text: 'You have already used more of your schedule than I like for a project that still has to be built.' },
  { kind: 'reason', key: 'pace_good', value: '4', text: 'You are well inside your schedule, and I lend to projects that finish on time.' },
  { kind: 'reason', key: 'pushbacks', value: '6', text: 'You have pushed back more than once. Every round costs days, and days are what I worry about.' },
  { kind: 'reason', key: 'builder', value: '5', text: 'You have a builder lined up. That tells me the work can start.' },
  { kind: 'reason', key: 'expeditor', value: '3', text: 'Having an expeditor on your side helps the permits move.' },
  { kind: 'reason', key: 'counter_smaller', value: '8', text: 'I will not lend {asked}. I will lend you {amount} at {rate} percent, which I can stand behind.' },
  { kind: 'reason', key: 'counter_rate', value: '8', text: 'I will lend you {amount}, but at {rate} percent. The rate pays me for the risk.' },
  { kind: 'reason', key: 'refuse_first', value: '10', text: 'I cannot lend on this project as it stands. Look at the investor, or at what you can trim.' },
  { kind: 'reason', key: 'refuse_final', value: '10', text: 'I have looked twice now and my answer is no. The investor is your next stop.' },
  { kind: 'reason', key: 'return_trust', value: '7', text: 'You have borrowed from us before and the file is in good order, so I will look at this more kindly.' },
  { kind: 'reason', key: 'first_visit', value: '2', text: 'This is your first time at our desk, so I look closely.' },
];

export interface BankerRules {
  params: Record<string, number>;
  pace: Array<{ max: number; score: number }>;
  share: Array<{ max: number; score: number }>;
  fee: Array<{ max: number; pct: number }>;
  settle: Record<string, number>;
  reasons: Record<string, { priority: number; text: string }>;
}

export function buildBankerRules(rows: BankerRow[]): BankerRules {
  const rules: BankerRules = { params: {}, pace: [], share: [], fee: [], settle: {}, reasons: {} };
  for (const r of rows) {
    const v = parseFloat(r.value);
    if (r.kind === 'param' && !isNaN(v)) rules.params[r.key] = v;
    else if (r.kind === 'pace' && !isNaN(v)) rules.pace.push({ max: parseFloat(r.key), score: v });
    else if (r.kind === 'share' && !isNaN(v)) rules.share.push({ max: parseFloat(r.key), score: v });
    else if (r.kind === 'fee' && !isNaN(v)) rules.fee.push({ max: parseFloat(r.key), pct: v });
    else if (r.kind === 'settle' && !isNaN(v)) rules.settle[r.key] = v;
    else if (r.kind === 'reason') rules.reasons[r.key] = { priority: isNaN(v) ? 0 : v, text: r.text };
  }
  rules.pace.sort((a, b) => a.max - b.max);
  rules.share.sort((a, b) => a.max - b.max);
  rules.fee.sort((a, b) => a.max - b.max);
  return rules;
}

let current: BankerRules = buildBankerRules(DEFAULT_BANKER_ROWS);

/** Called once at load with BANKER.csv rows. Anything the file leaves out keeps its built-in value. */
export function configureBankerRules(rows: BankerRow[]): void {
  const merged = new Map<string, BankerRow>();
  for (const r of DEFAULT_BANKER_ROWS) merged.set(`${r.kind}|${r.key}`, r);
  // A file that names a band table replaces the whole table, so a retuned band list cannot mix with old bands.
  const fileKinds = new Set(rows.filter(r => r.kind === 'pace' || r.kind === 'share' || r.kind === 'fee').map(r => r.kind));
  for (const k of [...merged.keys()]) {
    const [kind] = k.split('|');
    if (fileKinds.has(kind)) merged.delete(k);
  }
  for (const r of rows) merged.set(`${r.kind}|${r.key}`, r);
  current = buildBankerRules([...merged.values()]);
}

export function getBankerRules(): BankerRules {
  return current;
}

export function resetBankerRules(): void {
  current = buildBankerRules(DEFAULT_BANKER_ROWS);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function band(bands: Array<{ max: number; score: number }>, x: number): number {
  for (const b of bands) if (x <= b.max) return b.score;
  return bands.length ? bands[bands.length - 1].score : 0;
}

/** The bank's earnings on a loan: interest plus the filing fee. */
export function bankEarnings(amount: number, rate: number, rules: BankerRules = current): number {
  const tier = rules.fee.find(f => amount <= f.max) ?? rules.fee[rules.fee.length - 1];
  return amount * (rate / 100) + amount * ((tier?.pct ?? 0) / 100);
}

/** safe = the likelihood the project finishes on its schedule, 0 to 1. */
export function safeScore(amount: number, s: BankerSituation, rules: BankerRules = current): number {
  const p = rules.params;
  const paceRatio = s.plannedDays > 0 ? s.daysUsed / s.plannedDays : 1;
  const shareRatio = s.costToFinish > 0 ? amount / s.costToFinish : 1;
  let safe = (band(rules.pace, paceRatio) + band(rules.share, shareRatio)) / 2;
  if (s.hasBuilderBid) safe += p.builder_bonus ?? 0;
  if (s.hasExpeditor) safe += p.expeditor_bonus ?? 0;
  safe -= (p.pushback_penalty ?? 0) * s.pushBacks;
  return clamp01(safe);
}

export function profitScore(amount: number, rate: number, rules: BankerRules = current): number {
  // Profit is what the bank earns on each dollar it lends (rate plus filing fee), so a small project is not
  // marked down just for being small.
  const ref = rules.params.profit_ref || 1;
  const earnedPct = amount > 0 ? (bankEarnings(amount, rate, rules) / amount) * 100 : 0;
  return clamp01(earnedPct / ref);
}

export function bankerScore(amount: number, rate: number, s: BankerSituation, rules: BankerRules = current) {
  const p = rules.params;
  const safe = safeScore(amount, s, rules);
  const profit = profitScore(amount, rate, rules);
  const wSafe = p.safe_weight ?? 0.5;
  const wProfit = p.profit_weight ?? 0.5;
  const total = wSafe + wProfit || 1;
  return { safe, profit, score: (wSafe * safe + wProfit * profit) / total };
}

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/**
 * The banker's answer to one offer. First visit is judged strictly; a return visit is judged more
 * kindly ONLY when the bank has already lent to this project. After `max_refusals` refusals the bank
 * declines for good (final = true).
 */
export function decide(offer: BankerOffer, s: BankerSituation, rules: BankerRules = current): BankerDecision {
  const p = rules.params;
  const kind = s.bankLentBefore ? 'return' : 'first';
  const approveAt = p[`approve_${kind}`] ?? 0.6;
  const counterAt = p[`counter_${kind}`] ?? 0.35;
  const maxRefusals = p.max_refusals ?? 2;
  const base = bankerScore(offer.amount, offer.rate, s, rules);

  const shareRatio = s.costToFinish > 0 ? offer.amount / s.costToFinish : 1;
  const paceRatio = s.plannedDays > 0 ? s.daysUsed / s.plannedDays : 1;
  const vars = {
    amount: money(offer.amount), asked: money(offer.amount), rate: String(offer.rate),
    share: String(Math.round(shareRatio * 100)),
  };

  const tags = (extra: string[]): string[] => {
    const t = [...extra];
    if (shareRatio > (rules.share[2]?.max ?? 0.3)) t.push('share_high');
    else if (shareRatio <= (rules.share[0]?.max ?? 0.1)) t.push('share_low');
    if (paceRatio > (rules.pace[2]?.max ?? 0.75)) t.push('pace_late');
    else if (paceRatio <= (rules.pace[1]?.max ?? 0.5)) t.push('pace_good');
    if (s.pushBacks >= 2) t.push('pushbacks');
    if (s.hasBuilderBid) t.push('builder');
    if (s.hasExpeditor) t.push('expeditor');
    t.push(s.bankLentBefore ? 'return_trust' : 'first_visit');
    return t;
  };
  const sentences = (keys: string[], v: Record<string, string>): string[] =>
    [...new Set(keys)]
      .map(k => rules.reasons[k])
      .filter((r): r is { priority: number; text: string } => !!r && !!r.text)
      .sort((a, b) => b.priority - a.priority)
      .map(r => fill(r.text, v));

  const lockedOut = s.refusals >= maxRefusals;

  if (!lockedOut && base.score >= approveAt) {
    return { answer: 'approve', amount: offer.amount, rate: offer.rate, score: base.score, safe: base.safe, profit: base.profit, final: false,
      reasons: sentences(tags(['approve_clean']), vars) };
  }

  if (!lockedOut && base.score >= counterAt) {
    // Option A: the biggest smaller amount (steps of 10% down) that keeps safe high enough, same rate.
    let smaller: { amount: number; score: number } | null = null;
    for (let pct = 90; pct >= 30; pct -= 10) {
      const amt = Math.floor((offer.amount * pct) / 100 / 10000) * 10000;
      if (amt < 10000) break;
      const b = bankerScore(amt, offer.rate, s, rules);
      if (b.safe >= (p.counter_safe ?? 0.6)) { smaller = { amount: amt, score: b.score }; break; }
    }
    // Option B: the same amount at the next rate up.
    const nextRate = Math.min(p.rate_max ?? 15, offer.rate + (p.rate_step ?? 5));
    const higher = nextRate > offer.rate ? { rate: nextRate, ...bankerScore(offer.amount, nextRate, s, rules) } : null;
    const higherOk = higher && higher.score >= approveAt;
    if (higherOk && (!smaller || higher.score >= smaller.score)) {
      const v = { ...vars, rate: String(higher.rate) };
      return { answer: 'counter', amount: offer.amount, rate: higher.rate, score: higher.score, safe: higher.safe, profit: higher.profit, final: false,
        reasons: sentences(tags(['counter_rate']), v) };
    }
    if (smaller) {
      const b = bankerScore(smaller.amount, offer.rate, s, rules);
      return { answer: 'counter', amount: smaller.amount, rate: offer.rate, score: b.score, safe: b.safe, profit: b.profit, final: false,
        reasons: sentences(tags(['counter_smaller']), { ...vars, amount: money(smaller.amount) }) };
    }
  }

  const final = s.refusals + 1 >= maxRefusals;
  return { answer: 'refuse', amount: 0, rate: offer.rate, score: base.score, safe: base.safe, profit: base.profit, final,
    reasons: sentences(tags([final ? 'refuse_final' : 'refuse_first']), vars) };
}

/**
 * What the bank settles when the project finishes. daysUsed vs the plan fixed at the moment of the loan.
 * Positive = the student pays the bank; negative = the bank gives money back.
 */
export function settlementAmount(
  loanTotal: number, interestTotal: number, plannedDays: number, daysUsed: number, rules: BankerRules = current,
): number {
  if (loanTotal <= 0 || plannedDays <= 0) return 0;
  const st = rules.settle;
  const diffPct = ((daysUsed - plannedDays) / plannedDays) * 100;
  if (diffPct <= -(st.early_within_pct ?? 10)) return -Math.round(interestTotal * ((st.early_refund_share ?? 25) / 100));
  if (diffPct <= (st.ontime_within_pct ?? 10)) return 0;
  const latePct = diffPct <= 50 ? st.late_to_50 : diffPct <= 100 ? st.late_to_100 : st.late_over_100;
  return Math.round(loanTotal * ((latePct ?? 0) / 100));
}
