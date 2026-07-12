# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 11, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.111** — **3.0.108 deployed 2026-07-10** (commit `aa11433`, confirmed by maintainer); **v3.0.109–111 built, not yet deployed.**

## Current sprint
**2026-07-10/11 — first real run of the autonomous `/loop /fixloop`, plus a maintainer-directed feature.** The fix loop built last session ran for real: 10 budget-gated iterations landed (dead-subscription cleanup, DiceResultModal restyled to the V2 look, two rounds of "no game language" copy sweeps, a game-setup Share button, and a dead-space/forced-scrollbar/phone-warning fix on the setup screen), plus 2 doc-only closures (a stale CLAUDE.md deploy recipe marked obsolete, a live-vs-master CLEAN files audit confirmed clean). One fixloop iteration was fixed blind against a dashboard report's title alone, misdiagnosed it, and silently regressed an already-fixed bug — caught and corrected next iteration once the actual screenshot was pulled (now standard practice, see CLAUDE.md TACTICAL). Session closed with a maintainer-directed change: "Funding raised" redefined to exclude the owner's own seed money (v3.0.111). Detail in CHANGELOG.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2358/2359 passing, 1 skipped, 0 failures** (654.71s).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.0.108. v3.0.109–111 built and pushed, awaiting the next `deploy.sh` run.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **A parallel session's blind code review (2026-07-11) found a frozen `turn` counter that silently disables 3 real mechanics** — turn-limit game-end never fires, duration cards never expire (stay active + keep counting in scope forever), wrong turn numbers get recorded in 3 places. Root cause: `StateService.advanceTurn` only bumps the deprecated `turn` field in a fallback branch that normal play never hits; `globalTurnCount` is the field actually maintained. Same review also found the missing-DOB end-game penalty is unreachable (only checked in a dead `endTurn()` nothing calls) and expeditor "replace" permanently leaks cards out of the pool (no discard-pile add). 10 findings total, all file:line-cited in TODO.md — none fixed yet, this session only discovered them.
2. **Deploy v3.0.109–111**, then flip the 3 queued dashboard reports (`.claude/fixloop/flip-queue.txt`).
3. **Push-back/Lock-the-scope buttons don't preview cost before pressing** — real feature work (needs a dry-run cost preview for dice-based actions) + a specific UI layout the player requested. fb:feedback-1783080349985-a3dc215f.
