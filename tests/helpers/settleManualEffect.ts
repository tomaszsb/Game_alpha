// tests/helpers/settleManualEffect.ts
//
// Fixes the long-standing "E2E tests intermittently time out" flake
// (TODO.md, logged 2026-07-13 through 2026-07-28).
//
// The three E2E files that drive manual space effects all had this shape:
//
//     const promise = turnService.triggerManualEffect(playerId, key);
//     await new Promise(r => setTimeout(r, 10));   // hope the choice appeared
//     const choice = stateService.getGameState().awaitingChoice;
//     if (choice && choice.type !== 'MOVEMENT') {
//       choiceService.resolveChoice(choice.id, choice.options[0].id);
//     }
//     await promise;                               // hangs forever if we missed it
//
// Some manual effects raise a choice that only the test can answer, and
// `triggerManualEffect`'s promise does not settle until it is answered. The
// fixed 10ms sleep was a bet that the effect would reach that point in time.
// On an idle machine it always did. Under full-suite load it sometimes did
// not — the test then saw `awaitingChoice === null`, resolved nothing, and
// awaited a promise that nobody would ever settle, burning the entire test
// budget (measured: a test whose real work takes 626ms sitting at exactly
// 90,018ms). That is why the failure moved between files and between
// sub-tests on every run, always as a timeout and never an assertion, and why
// it vanished in isolation. It is also why raising the budgets 30s → 60s →
// 90s never helped: a permanent hang does not care how long you wait.
//
// This helper polls for the choice instead of guessing, and races that poll
// against the promise so effects that raise no choice cost nothing. If the
// effect neither settles nor raises a choice, it fails fast with a message
// naming the cause rather than an opaque "Test timed out".

type ChoiceLike = {
  id: string;
  type: string;
  options: { id: string }[];
};

type StateLike = {
  getGameState(): { awaitingChoice?: ChoiceLike | null };
};

type ChoiceResolverLike = {
  resolveChoice(choiceId: string, optionId: string): unknown;
};

/**
 * Await a `triggerManualEffect()` promise, answering the choice it raises (if
 * any) as soon as that choice appears.
 *
 * @param promise       the in-flight `triggerManualEffect()` call
 * @param stateService  read `awaitingChoice` from here
 * @param choiceService used to answer the choice
 * @param timeoutMs     bound on "no choice AND not settled" before failing loudly.
 *                      Deliberately well under the callers' 30–90s test budgets
 *                      so a real hang surfaces as this explanatory error rather
 *                      than a bare vitest timeout.
 * @param minSettleMs   floor on how long to wait before returning, preserving
 *                      the original `setTimeout(r, 10)`'s incidental delay.
 *                      Returning the instant the promise settled turned out to
 *                      be observably different: some callers depend on other
 *                      async work that the old unconditional 10ms sleep let
 *                      finish, and dropping it produced "Cannot end turn
 *                      outside of PLAY phase". This helper is therefore a
 *                      strict superset of the code it replaced — same minimum
 *                      wait, plus the polling.
 */
export async function settleManualEffect(
  promise: Promise<unknown>,
  stateService: StateLike,
  choiceService: ChoiceResolverLike,
  timeoutMs = 15000,
  minSettleMs = 10,
): Promise<void> {
  let settled = false;
  const tracked = promise.then(
    (value) => { settled = true; return value; },
    (error) => { settled = true; throw error; },
  );
  // Keep the rejection handled while we poll; the await at the end re-throws
  // it so the test still sees the real failure.
  tracked.catch(() => { /* surfaced by the await below */ });

  const started = Date.now();
  const deadline = started + timeoutMs;

  for (;;) {
    const choice = stateService.getGameState().awaitingChoice;
    if (choice && choice.type !== 'MOVEMENT') {
      choiceService.resolveChoice(choice.id, choice.options[0].id);
      break;
    }
    if (settled && Date.now() - started >= minSettleMs) break;
    if (Date.now() > deadline) {
      throw new Error(
        `settleManualEffect: the manual effect neither settled nor raised a ` +
        `choice within ${timeoutMs}ms. Previously this hung until the test's ` +
        `own timeout with no explanation. See tests/helpers/settleManualEffect.ts.`,
      );
    }
    await new Promise((r) => setTimeout(r, 5));
  }

  await tracked;
}
