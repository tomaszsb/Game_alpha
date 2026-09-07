/**
 * Which manual space effects are OPTIONAL (skippable) rather than required.
 *
 * The expeditor replace/return/give actions are offered but never demanded:
 * `StateService.calculateRequiredActions` deliberately leaves them OUT of
 * `requiredActions` (counting them made backing out of the modal a dead-end —
 * Move stayed disabled with no Skip), and `ManualActionProcessor` lets them
 * complete without affecting a card when the player declines.
 *
 * This predicate exists because that rule was written out by hand in three
 * places and then MISSED in a fourth. PlayerPanelV2 built its "what is blocking
 * you" label from every uncompleted manual action, skippable ones included, so
 * on PM-DECISION-CHECK the commit spine read *Finish "Swap one helper for
 * another" above first* when the only outstanding requirement was picking a
 * destination — naming an optional action that could never satisfy the gate.
 * The 2026-09-06 and 2026-09-07 robot playtests abandoned all 12 games there,
 * clicking a control that had told them to do the wrong thing.
 *
 * Accepts either a bare effect action (`replace_e`) or the compound key the
 * panel builds (`cards:replace_e`), because both forms are in circulation.
 */
export function isSkippableEffectAction(action: string | undefined | null): boolean {
  if (!action) return false;
  const colon = action.lastIndexOf(':');
  const bare = (colon >= 0 ? action.slice(colon + 1) : action).trim();
  return /^(replace_|return_|give_)/i.test(bare);
}
