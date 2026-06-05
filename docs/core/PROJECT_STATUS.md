# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 5, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.67** (deployed 2026-06-05, commit `c455813`)

## Current sprint
Fixed the Final Review "Accept does nothing" crash: v3.0.66's resolver merge (Phase 2.1) reintroduced the v3.0.61 crash by deleting v3.0.62's inline Stage-1 gate override, assuming `validateMove` would "agree by construction" — it doesn't for the `moveIntent` path (intent set at roll-time, validated at END-TURN against changed approval state). `MovementExecutor` now reconciles a stale `moveIntent` against the live resolver before moving. Same release fixed the bug reporter silently dropping console logs (a `useCallback` stale-closure on the opt-in flag; box now defaults on + the toast confirms attachment).

## Health
- **Tests:** 1602/1602 canonical sweep (1663/1663 broad). 0 pre-existing failures in those sweeps.
- **Build / typecheck:** clean.
- **Strict ghost gate:** passing. ⚠️ The `try-again-happy` ghost variant is **pre-existing red** (32/50 wins, overruns its 15-min timeout — verified identical on v3.0.66 baseline, NOT a regression). Tracked in TODO → "Ghost win-rate tracking."

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Phase 2.2 — TurnTransaction boundary** — last big parallel-systems merge (state TEMP/REAL + log sessions → one transaction). Closes 5 of 7 audit items. Dedicated-session work.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66) — game-level tutorial; the bigger product lever.
3. **Recalibrate / investigate the `try-again-happy` ghost gate** — stale threshold + timeout, or the regulatory-loop balance issue behind the 32/50.
