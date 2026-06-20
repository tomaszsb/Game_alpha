# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 20, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.80** — **deployed + live, commit `9666140`** (maintainer confirmed start-screen badge `9666140 ✓`). All of Phase 4 (4a + 4b) **merged → master, pushed, and live.** No package version bump (Phase 4 is invisible until a teacher authors a space).

## Current sprint
**2026-06-20 — Phase 4b built, verified, merged, and DEPLOYED LIVE: the full teacher-authored-space capability set.** Built across four slices (after 2026-06-18's 4a in-app verification): (1) **fork-splice** — an authored space can sit on any edge, including dice; (2) **card-draws** — it deals W/B/I/L/E cards on arrival; (3) **dice-outcomes** — it can itself be a dice roll with per-face destinations; (4) **fees** — flat, % of the player's loans (bank-style), or % of project scope (architect-style, but *not* tied to the 20% game-over cap, so teachers can't author an instant-loss space). Each slice re-validated against the full ghost gate; the bake re-verified against **real stock** (19/19, covering all four 4a bug classes); merged fast-forward → master, pushed, deployed (deploy preserved `game-data`). Phase 4c/4d remain CUT (engine authoring, out of scope). Remaining loose end: the authored-insertion **ghost fixture** (bot can't yet stress-test instance boards for unwinnable loops).

**2026-06-20 (follow-up) — Phase 4b verified in a LOCAL running app.** Authored "City Inspection Roulette" (card draw + 10%-of-scope fee + 6-face dice) on the `FUND→PM` edge, baked, and walked it via Express (localhost:3001): splice routing, auto card-deal, `SCOPE_PERCENTAGE` fee (~$277K), and dice routing (rolled 6 → LEND-SCOPE-CHECK) all confirmed end-to-end. **Only the live-prod walk remains** (user driving). One bug surfaced (tracked in TODO): `validateInsertions` detects dice sources via `requires_dice_roll` while the engine uses `die_roll='Next Step'`, so splicing onto the fixed edge of a card/time/fee-rolling space is wrongly rejected — low severity, has a workaround.

## Health
- **Tests:** full suite green at the last run — **~2166 passing / 1 skipped**, modulo 3 confirmed-flaky env failures (Windows `rmdir` race on a bake test + 2 E2E timeouts under load), all green re-run in isolation. Typecheck + build clean (a JSDoc typecheck slip in `3d4bae1` was caught at koniec pre-flight, fixed in `4921d69`).
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** Phase 4 is **live** (commit `9666140`). The deploy **preserved `game-data`** — the v3.0.77 `deploy.sh` fix is confirmed real, so teacher customization (incl. authored spaces) survives deploys by construction (the old "wipe blocker" is resolved/stale — do not re-flag). Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev:** verify per-instance boards via Express (localhost:3001), not Vite (3000) — see CLAUDE.md.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Live post-deploy verification** — local running-app walk PASSED 2026-06-20; only the **live-prod** walk remains (user driving). Plus the validator-vs-engine `requires_dice_roll`/`die_roll` fix found during it (TODO).
2. **UI redesign — player panel + scoreboard** (deploy-independent; design-team handoff ready) + the mobile board-bleed-through bug.
3. **Authored-insertion ghost fixture** (deferred) — bot can't yet stress-test instance boards for unwinnable loops.
