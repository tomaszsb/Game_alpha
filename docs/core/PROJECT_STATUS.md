# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 7, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.69** (package.json bumped this session; **pending deploy** — v3.0.68 was deployed overnight, v3.0.69 ships next deploy)

## Current sprint
A housekeeping + test-health + bug-fix session on top of the deployed v3.0.68. **Dashboard housekeeping:** flipped the 8 v3.0.68-fixed reports to resolved. **Ghost test redesign:** the `try-again-happy` gate had been pre-existing red; investigated and found the regulatory-loop losses are a *bot artifact* (the bot blindly hits Try Again on examiner spaces, reverting approval it just earned, and the Stage-1 gate routes it back) — not a game-balance bug (0 hard failures throughout). Split the one gate into a blind **`negotiate-coverage`** test (sole job: 0 crashes/state-leaks) and a new **`smart-bot`** win-rate test (a rational bot that won't undo a turn it just earned approval on). **Two Life-card fixes:** the receipt off-by-one on the non-dice draw path (spurious "lost 1 resource"), and fb:931a55de (6 more L-cards de-jargoned + a hidden L049 bug where a bare `draw_cards=1` drew a Work Package instead of the Expeditor its text promised — fixed to `1 E`, guarded by a new by-ID integrity pin).

## Health
- **Tests:** 1634/1634 targeted koniec sweep (components + utils + services + card-integrity) green. 0 pre-existing failures in that sweep. (Regression I introduced mid-session — an unconditional `getGameState()` in the card-draw path — was caught by the sweep and fixed.)
- **Build / typecheck:** clean.
- **Ghost gate:** `negotiate-coverage` confirmed 0 hard failures (32/50 blind wins). ⚠️ The new **`smart-bot` win floor is a placeholder (≥32)** — the calibration run was interrupted by machine sleep. Re-run + finalize next session (smart ≥ blind, so the placeholder is safe). Strict gate not re-run (no movement-engine change).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Finalize the smart-bot win floor** — re-run the ~17-min `smart-bot` calibration, set floor = measured − ~4, fill the two `<!-- CALIBRATE -->` markers (CHANGELOG + ghost test). Quick once the run lands.
2. **Phase 2.2 — TurnTransaction boundary** — last big parallel-systems merge (state TEMP/REAL + log sessions → one transaction). Closes 5 of 7 audit items. Dedicated-session work.
3. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66) — game-level tutorial; the bigger product lever.
