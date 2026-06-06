# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** June 6, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.68** (code committed `98a6d23` + this /koniec bump; ⚠️ user deployed `98a6d23` which still read 3.0.67 in package.json — re-deploy after this wrap-up to sync the version label)

## Current sprint
Cleared all 8 open dashboard reports from the v3.0.66/67 playtest in three threads. **Life Event modal v2:** reframed the red "major disturbance" pop-up as a tone-aware "📰 THE DAILY PERMIT" newspaper bulletin (good news reads as good news), made it show the realized outcome instead of "roll a die" instructions (SpaceArrivalProcessor now builds receipts on the dice-piggyback path; shared diff extracted to `lifeEventReceipts.ts`), and rewrote 14 leaky L-card descriptions into in-character news. **Board/tile editing:** the editor's top input now renames the actual tile (`display_label_override`) not the story subtitle; the buffer ghost is content-aware so tiles stop overlapping; Button Labels moved to the editor bottom. **Dice-space arrows:** the board edge graph now pulls dice destinations from DICE_OUTCOMES (was MOVEMENT-only, blank for dice spaces) — fixes the missing cheat→FDNY line. Two latent bugs fixed in passing: the broken `E2E-01` happy-path test (stuck on the haptic gate, testing nothing) and a dead "approval revoked" receipt (uppercase/lowercase enum mismatch since v3.0.40).

## Health
- **Tests:** 1623/1623 targeted koniec sweep (components + utils + services) green. 0 pre-existing failures in that sweep.
- **Build / typecheck:** clean.
- **Strict ghost gate:** not re-run this session (data/UI work, not movement-engine). ⚠️ The `try-again-happy` ghost variant remains **pre-existing red** (32/50 wins, overruns its 15-min timeout — NOT a regression). Tracked in TODO → "Ghost win-rate tracking."

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Phase 2.2 — TurnTransaction boundary** — last big parallel-systems merge (state TEMP/REAL + log sessions → one transaction). Closes 5 of 7 audit items. Dedicated-session work.
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + L66) — game-level tutorial; the bigger product lever.
3. **Recalibrate / investigate the `try-again-happy` ghost gate** — stale threshold + timeout, or the regulatory-loop balance issue behind the 32/50.
