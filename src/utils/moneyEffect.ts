// moneyEffect - a card's `money_effect` is normally a whole-dollar delta ("-8000", "2000"). A value written as a percent
// ("10%") means that share of the player's current project scope, paid to them (E067 "Tax Incentive Research": reduce
// project costs by 10%). Every reader of `money_effect` goes through here so "10%" is never misread as "$10".

/** The percent in a "10%"-style money_effect, or null for an ordinary dollar value. */
export function moneyEffectPercent(raw: string | undefined | null): number | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*%\s*$/.exec(raw ?? '');
  return m ? parseFloat(m[1]) : null;
}

/** Whole dollars a money_effect comes to for a project of `scopeTotal` dollars (a percent is rounded to the dollar). */
export function moneyEffectDollars(raw: string | undefined | null, scopeTotal: number): number {
  const pct = moneyEffectPercent(raw);
  if (pct !== null) return Math.round((Math.max(0, scopeTotal) * pct) / 100);
  const n = parseInt(raw ?? '', 10);
  return Number.isNaN(n) ? 0 : n;
}
