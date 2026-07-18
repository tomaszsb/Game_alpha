# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 18, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.10** — **deployed, confirmed live** 2026-07-18 (live bundle embeds `3.1.10` + commit `2adf193`, the pushed HEAD). v3.1.9: the orphaned classic-panel dead-code cluster deleted (−2,839 lines — CardModal/CardActions/CardContent/CardsSection/PlayerActionService/showCardModal + the `activeModal` state field). v3.1.10: latent N×N card-effect fan-out on the manual `playCard` path fixed (Kid E guard extended to all paths, red-green regression test).

## Current sprint
**2026-07-18 — dead-code cleanup + the latent bug it uncovered.** Executed the audited deletion from the parking lot; migrating the E2E card-play drivers off the deleted `PlayerActionService` onto the live paths surfaced that manual `cardService.playCard` of a Global-scope no-duration card double-fanned effects (parser fans per player, engine re-fans per target — N×N). Fixed same-day. Also closed the fb:66bb0bda design call by maintainer decision: `canPlayCard` stays type-agnostic (reskin flexibility + future card functionality); the hand-playable gate moves into card data if a second playable family ever appears (recorded in TODO "Resolved 2026-07-18"). A D&D-style reskin was discussed as a future direction — the five card families (W/B/E/L/I) are wired through the engine, so a reskin that keeps their behaviors is cheap, one that changes them is surgery.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2386/2388 passing, 1 skipped, 1 failure** (802s) — the 1 failure is `E2E-AllPaths.test.ts`'s pre-existing documented scheduling flake (passes 10/10 in isolation, 6s). Net −41 tests vs v3.1.8 from deleting the dead cluster's test files; +1 new N×N regression pin.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = **v3.1.10**, confirmed 2026-07-18 via version + commit embedded in the live bundle.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; needs a glance on the physical TV.
2. **Dark/light mode coverage beyond `PlayerPanelV2`** — board, `TVDisplay`, `ChoiceModal` still light-only (`CardModal`, the other dark-unaware modal, was deleted in v3.1.9 — scope shrank).
3. **Playtester acquisition + dashboard `version`/`gitCommit` display** — the standing actives from TODO.
