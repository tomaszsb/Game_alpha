# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 8, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.70** (built + committed 2026-06-08, **pending deploy**)

## Current sprint
An internal-hardening session on top of the deployed v3.0.69 — no player-facing behavior change. **Phase 2.2 — TurnTransaction boundary:** the last "parallel systems" merge. The turn's two books (TEMP/REAL state + exploration-session log) are now opened/committed/discarded through one set of `TurnService` methods (`begin/commit/discardTurnTransaction`) so they can't drift apart — the trap behind the v3.0.63 ghost-log bug. **Smart-bot calibration → 90% goal MET:** the v3.0.69 placeholder floor was finalized, and the calibration revealed the win-rate goal was already met and *hidden by a test timeout* — the 30s/game cap was aborting grindy games and counting them as losses. Made the per-game timeout opt-in + raised it for the smart-bot test so games finish naturally: **47/50 (94%)**, deterministic, floor set to ≥43. Added `.claude/ghost-history.jsonl` logging so a passing test's count is never lost again. **Cheat-space report (fb:89d9f101 b):** audited, found already-fixed by v2.70.x, locked the untested movement-button-suppression rule with a pure helper + 4 tests, closed the stale TODO. **Type tidy:** 3 safe `any` narrowings.

## Health
- **Tests:** 1628/1628 koniec sweep (components + utils + services) green, 0 failures. Smart-bot ghost gate deterministic at 47/50 (floor ≥43); negotiate-coverage + strict gates unchanged (no engine behavior change).
- **Build / typecheck:** clean.
- **Deploy:** v3.0.70 committed + pushed but **NOT yet deployed** — run the deploy command (see NEXT_SESSION) and confirm the build log reads `3.0.70`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.70** — committed + pushed, not yet live. Internal-only changes, low risk; spot-check a turn + a Try Again after.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66) — game-level tutorial; the biggest remaining product lever (recurring "overwhelming for newcomers" feedback theme).
3. **Game length watch** — smart-bot avgTurns=149; not urgent (bot turns ≠ human minutes; under the ~40-min class-period budget). Trigger to trim mechanics/space requirements: when a *real* playtest game runs past ~40 min.
