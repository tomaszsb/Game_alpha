/**
 * Simple template interpolation for modal config text.
 * Replaces {token} placeholders with values from the context object.
 * Unknown tokens are left as-is.
 *
 * Available tokens: {count}, {cardType}, {amount}, {spaceName}, {playerName}
 *
 * Example: "You receive {count} {cardType} cards" → "You receive 3 W cards"
 */
export function interpolateTemplate(template: string, context: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = context[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Resolves the {fundingAmount} token in a space's story text to the actual
 * dollar figure from the player's money sources — the same lookup
 * PlayerPanelV2/ActionCenterPanel use for their on-panel story text, so a
 * modal quoting the same story shows the real number instead of the raw
 * "{fundingAmount}" placeholder (v3.0.99 — that gap was fixed for the
 * panels in v3.0.98 but never for the DiceResultModal paths that also
 * render this story: DiceRollProcessor.buildTurnEffectResult and
 * TurnService.triggerManualEffectWithFeedback/handleAutomaticFunding).
 * Empty string (not "$0") when nothing's been granted yet, matching the
 * panels' behavior on a First-visit read before funding lands.
 */
export function resolveFundingAmountToken(
  story: string,
  player: { moneySources?: { ownerFunding: number; bankLoans: number; investmentDeals: number; other: number } },
  fundingSource: 'owner' | 'bank' | 'investor' | ''
): string {
  const moneySources = player.moneySources || { ownerFunding: 0, bankLoans: 0, investmentDeals: 0, other: 0 };
  let fundingSourceAmount = 0;
  if (fundingSource === 'owner') fundingSourceAmount = moneySources.ownerFunding;
  else if (fundingSource === 'bank') fundingSourceAmount = moneySources.bankLoans;
  else if (fundingSource === 'investor') fundingSourceAmount = moneySources.investmentDeals;
  const fundingAmount = fundingSourceAmount > 0 ? `$${fundingSourceAmount.toLocaleString()}` : '';
  return interpolateTemplate(story, { fundingAmount });
}
