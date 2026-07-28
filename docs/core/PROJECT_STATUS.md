# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 28, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.74** — **deployed and verified live** 2026-07-28 (live bundle embeds `"3.1.74"`).

## Current sprint
**2026-07-28 — a lint burn-down that turned into closing a test flake open since 2026-07-13.** Lint went **257 → 113 warnings** with **ten rules promoted from `warn` to hard `error`** (from two that morning), each proven blocking with an `eslint --stdin` probe rather than assumed. Three finds were real defects rather than style: `PullToRefresh` read a ref during render (correct only by luck), `ProjectProgress` declared a component inside render, and `csvExport` held three invisible U+FEFF characters inside BOM-stripping regexes. 215 lines of verified-dead `CardService` methods were deleted rather than patched. Player-facing copy moved to typographic quotes on the maintainer's call, rewritten from ESLint's own reported positions so neighbouring JSX expressions couldn't be corrupted. Then the E2E flake was **root-caused and fixed**: `endTurnWithMovement()` could raise a `CARD_DISCARD` choice no test ever answered — a permanent hang, not the slowness that two earlier theories (stale servers, worker starvation) had assumed. Both wrong theories are corrected in CHANGELOG rather than quietly dropped.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2493/2494** (1 pre-existing skip, zero failures), ghost gates **33/33** (530.10s).
- **Lint:** ✅ 0 errors, **113 warnings** (was 257). Ten rules held at zero as hard errors. What remains is all judgment work — 41 dead bindings, 34 `set-state-in-effect`, 28 intentional `any`, 10 `exhaustive-deps`. No cheap wins left. Still not in CI: this repo has no `.github/workflows/` at all.
- **E2E determinism:** decks are now seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds. `npm test` is now *consistent* — which is not the same as *proven correct*.
- **Deploy:** live = **v3.1.74**, verified 2026-07-28 by reading the version string out of the served bundle (the `/health` endpoint's own version field is a separate, unreliable "dev" placeholder — don't use it).
- **Dashboard feedback:** **8 open** (not the 7 carried in prior handoffs — one report, `fb:2948cf19`, arrived 2026-07-27 after the last `/koniec` and had never been triaged; now staged in TODO).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Lint burn-down: the cheap wins are gone.** 113 warnings remain across four rules that all need per-site judgment — `no-unused-vars` 41 (dead bindings), `set-state-in-effect` 34 and `exhaustive-deps` 10 (can hide *and* cause real bugs; don't batch-fix), `no-explicit-any` 28 (Bucket E, documented intentional).
2. **Homeowner violation mechanic — needs a real spec before engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process) but confirmed it as advanced/multi-session work — a design conversation, not code.
3. **fb:ae480630 (next-action highlight) is open by choice.** v3.1.63 fixed a real notify gap that is a well-evidenced probable cause, but the symptom was never reproduced — left open so a recurrence tells us it was something else.
