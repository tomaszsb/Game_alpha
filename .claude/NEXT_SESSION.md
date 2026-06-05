# Next session starter — written 2026-06-04 by /koniec

## State at handoff
- **Version:** v3.0.66 (deployed 2026-06-04, user-confirmed live, commit `a5518f3` pushed). Spot-checked through 4 spaces of live play — clean.
- **Branch:** master, clean apart from `.claude/NEXT_SESSION.md` + `.claude/settings.local.json` (gitignored-but-tracked noise as usual).
- **Last shipped:** Phase 1 + Phase 2.1 of the parallel-systems audit catalogued at end of v3.0.64. v3.0.65 = visitType invariant test + log-display filter helper. v3.0.66 = movement resolver merge (one `getValidMoves({ diceRoll })`, killed inline gate override in MovementExecutor) + 435-line dead-code cleanup of `PlayerActionService.rollDice`/`endTurn` (superseded by `DiceRollProcessor.rollDiceWithFeedback` + `TurnService.endTurnWithMovement`).
- **Test suite:** targeted sweep **1657/1657 green**. **Build + typecheck clean.** Ghost strict gate passed 50/50 (~13 min, exit 0).

## Top 3 open items
1. **Phase 2.2 — TurnTransaction boundary.** The last big merge in the seven-debt audit. Unify `StateService.discardTempState` + `LoggingService.discardCurrentSession` (and the create/commit pair) into one transaction call site. Closes the v3.0.63 family. TODO calls it 1–2 sessions of dedicated work — same dedicated-session bar as Phase 2.1 was. Touches `StateService`, `LoggingService`, `TurnService`, integration test suite. After this, 5 of 7 audit items closed.
2. **Onboarding package — `fb:0aa9660c` + `fb:8ad42b52` + L66.** Unchanged from prior handoffs. Game-level tutorial mode, design work. User identified these three as "must be researched and designed as a one look feel." The bigger product lever. Pick up when there's head-space.
3. **Phase 2.2 alternatives (if not ready for the big merge):** smaller candidates in TODO's parallel-systems audit list — (5) notification + logging event bus, (6) money/moneySources denormalization, (7) three effect pipelines. Lower-impact, higher-risk surface each — TODO itself flags them as deferred. Pick one only if Phase 2.2 isn't appetizing yet.

## Test failures to address
(None — 1657/1657 green.)

## Decisions waiting on the user
- **Phase 2.2 timing.** Same shape as Phase 2.1 — dedicated-session work, "DO NOT do casually." When to schedule the block is the open question.
- **Top-3 #2 (onboarding package)** — still the bigger product lever. Unchanged from prior handoffs.

## Suggested first move
Ask user: "Anything off from the v3.0.66 playtest, or ready to tackle Phase 2.2 (TurnTransaction merge — the last big architectural item in the seven-debt audit)?" If clean, choose between Phase 2.2 (architectural) or the onboarding package (product). Both are real forward levers; everything else on the dashboard is design-blocked.

## Reminders
- Deploy command runs from **Windows PowerShell**: `ssh root@192.168.86.57 "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- **`package.json` must be bumped before tagging vN.M.X.** Three places: `package.json` + both `version` entries in `package-lock.json`.
- **Push before deploy** — `git log origin/master..master` should return empty before handing the user the deploy command.
- Full `npm test` hangs on Windows; targeted sweep is `tests/components/ tests/utils/ tests/services/ tests/integration/ tests/server/` (~15s, 1657 tests).
- **NEW pattern this session (CLAUDE.md v3.30) — audit-before-refactor:** when a TODO frames structural debt as "two systems doing the same thing," READ both code paths before code-changing. The "visitType drift trap" framing was wrong — the two functions answered different questions. Saved a code-golf cleanup. Apply this when interpreting future audit-derived TODOs.
- Also new in v3.30: grep ALL callers when refactoring a service boundary (Phase 2.1 found a 3rd dead caller in `PlayerActionService` that surfaced 435 lines for deletion in the same commit); `describe.skip` is NOT TypeScript-safe — delete dead test blocks directly via node fs script for >100 line ranges.
- Ghost strict gate (50 games, ~13 min) is the right confirmation gate for any change touching `MovementService` / `TurnService` / `ApprovalService` / approval-state writes. v3.0.66 was last run green.
