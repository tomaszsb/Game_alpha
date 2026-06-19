# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 20, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.80** — **deployed + live** (confirmed by maintainer 2026-06-20, `bbbd984`). Active dev on branch **`phase-4a-card-insertion`** (all of Phase 4 — NOT merged/pushed/deployed; on-branch by standing decision).

## Current sprint
**2026-06-20 — Phase 4b complete on the branch: the full teacher-authored-space capability set.** Built across four slices (after 2026-06-18's 4a in-app verification): (1) **fork-splice** — an authored space can sit on any edge, including dice; (2) **card-draws** — it deals W/B/I/L/E cards on arrival; (3) **dice-outcomes** — it can itself be a dice roll with per-face destinations; (4) **fees** — flat, % of the player's loans (bank-style), or % of project scope (architect-style, but *not* tied to the 20% game-over cap, so teachers can't author an instant-loss space). Each slice re-validated against the full ghost gate. Phase 4c/4d remain CUT (engine authoring, out of scope). Remaining loose end: the authored-insertion **ghost fixture** (bot can't yet stress-test instance boards for unwinnable loops).

## Health
- **Tests:** full suite green at the last run — **~2166 passing / 1 skipped**, modulo 3 confirmed-flaky env failures (Windows `rmdir` race on a bake test + 2 E2E timeouts under load), all green re-run in isolation. Typecheck + build clean (a JSDoc typecheck slip in `3d4bae1` was caught at koniec pre-flight, fixed in `4921d69`).
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** v3.0.80 is live. **Phase 4 still cannot go live** until the `deploy.sh` instances-wipe is fixed (TODO "Deploy infrastructure") — teacher customization won't survive a deploy. Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev:** verify per-instance boards via Express (localhost:3001), not Vite (3000) — see CLAUDE.md.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **`deploy.sh` instances-wipe** — hard blocker for any teacher-layer customization (incl. all of Phase 4) going live.
2. **Merge decision (user)** — `phase-4a-card-insertion` (now all of 4a + 4b) → master, when ready.
3. **UI redesign — player panel + scoreboard** (deploy-independent; design-team handoff ready) + the mobile board-bleed-through bug. Plus the deferred authored-insertion ghost fixture.
