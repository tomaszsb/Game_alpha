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

/**
 * Solo-safe replacement text for cards whose AUTHORED description references
 * "other players" in a way that reads as nonsensical in a 1-player game.
 * Keyed by card_id. This is deliberately a small, hand-authored lookup — NOT
 * a general CSV-schema mechanism — for known-bad copy caught in playtesting
 * (playtest finding, 2026-07-24: L021 "High-Profile Client" says "pushing
 * everyone else back a step... all other players' current filing time
 * increases by 1 day" verbatim in solo games, where there is no one else).
 *
 * Update (2026-07-26): the "+1 day to other players" clause is now
 * mechanically implemented in multiplayer (see CardService.
 * applyOtherPlayersTickModifier / DataTypes.ts other_players_tick_modifier).
 * In solo play it correctly still does nothing — the mechanic targets "every
 * other player," which is an empty set when you're the only one — so this
 * override remains necessary and correct: it ONLY trims the DISPLAY text to
 * match what solo players actually experience; the mechanic itself already
 * naturally no-ops with zero other players and needs no solo-specific code.
 *
 * Add an entry here only for a card actually confirmed to show
 * multiplayer-only language in solo play — don't pre-emptively rewrite every
 * L-card description "just in case."
 */
const SOLO_SAFE_DESCRIPTION_OVERRIDES: Record<string, string> = {
  L021: "Your client's name opens doors — the permit office bumps your filing to the front of the line. The current filing time is reduced by 4 days.",
};

/**
 * Returns the description to display for a card, swapping in a solo-safe
 * variant when the game has exactly one player AND this card has a known
 * multiplayer-only clause (see SOLO_SAFE_DESCRIPTION_OVERRIDES). Every other
 * case — 2+ players, or a card with no override — returns `card.description`
 * untouched.
 */
export function getCardDescriptionForPlayerCount(
  card: { card_id?: string; description?: string },
  playerCount: number
): string | undefined {
  if (playerCount === 1) {
    const override = card.card_id ? SOLO_SAFE_DESCRIPTION_OVERRIDES[card.card_id] : undefined;
    if (override !== undefined) return override;
  }
  return card.description;
}
