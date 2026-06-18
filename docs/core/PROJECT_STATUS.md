# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 18, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.80** — **PENDING RE-DEPLOY** (live still serves v3.0.78; v3.0.79/80 not yet deployed). Active dev on branch **`phase-4a-card-insertion`** (NOT merged/pushed/deployed).

## Current sprint
**2026-06-18 — verified Phase 4a (teacher-authored spaces) in the running game before building 4b, per the maintainer's call.** Walking the real teacher flow exposed **four real bugs the build-only tests had missed**, all now fixed (commit `af3e5f6`): (1) lowercase authored ids soft-locked the game — every space-name parser is uppercase-only, so the source space's movement collapsed to `none`; (2) the resolver's clone-and-blank leaked the source space's *behavioral* columns (a story beat after a funding space acted like a funding space); (3) authored tiles inherited the source's exact position → rendered invisibly stacked → now auto-placed at the spliced edge midpoint; (4) label confirmed OK. Routing + tile render verified end-to-end. 4a is now genuinely usable. **4b is sliced** (user call): fork-splice → card-draws → dice-outcomes → percentage-fees; fork-splice is next.

## Health
- **Tests:** **227 server + 1658 component/util/service — all green** (this session). Typecheck + build clean.
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** ⚠️ **v3.0.80 NOT deployed** — live still runs v3.0.78. Phase 4a *cannot* go live until the `deploy.sh` instances-wipe is fixed (TODO "Deploy infrastructure"). Never `docker compose up`; NPM routes domain → 3080; cf-cache is DYNAMIC. **Local-dev:** verify per-instance boards via Express (localhost:3001), not Vite (3000) — see CLAUDE.md.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **4b slice 1 — fork-splice** (splice authored stops onto choice/dice edges). Plan in `.claude/plans/replicated-baking-hoare.md`. Plain choice edges already work; the new work is the dice case.
2. **`deploy.sh` instances-wipe** — hard blocker for any teacher-layer customization (incl. Phase 4a) going live. Plus v3.0.79/80 still need deploying.
3. **UI redesign — player panel + scoreboard** (deploy-independent; design-team handoff ready) + the mobile board-bleed-through bug.
