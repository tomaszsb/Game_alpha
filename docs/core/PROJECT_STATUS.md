# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 13, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.127** — **3.0.115 deployed 2026-07-12** (commit `b46cb30`, confirmed by maintainer); **v3.0.116–127 built and pushed, not yet confirmed deployed.**

## Current sprint
**2026-07-12/13 — autonomous `/loop /fixloop` session, 7 versions shipped.** Built the cost-preview toggle for the Push back / Lock the scope buttons (spec locked the prior session) — first attempt landed in the deprecated classic panel with a hover interaction, redirected mid-build to a tap-based toggle in `PlayerPanelV2` since the game is played primarily on phones. Polling the live dashboard-feedback API each iteration (not just at session start) surfaced 5 new reports that reshaped scope in real time: Join-by-Code got a "which player are you?" picker so a crashed/rejoining player can reclaim their seat instead of landing in spectator view, then a takeover-warning follow-up so claiming an actively-connected player requires confirmation; the maintainer's owner-alert email was moved from firing on mere homepage visits to firing on actual game start, which also surfaced a dead `gamePhase === 'PLAYING'` comparison that meant the intended detector had silently never fired; the deploy-countdown banner shipped once rejoin was no longer ambiguous; the cost-preview toggle's own stale-"Varies"-after-roll-resolves bug was fixed; and (v3.0.127) an NPC speaker badge that hardcoded light-mode colors in dark-mode modals was fixed. Full detail in CHANGELOG v3.0.121–127, two new CLAUDE.md TACTICAL entries.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2382/2384 passing, 1 skipped, 1 failure** as of the last full run (728s), all 5 ghost simulation gates green. The 1 failure is confirmed pre-existing resource-contention flakiness in `E2E-AllPaths.test.ts` (a different sub-test times out on each run), not a regression — see TODO.md Parking lot. v3.0.127's targeted + modals-suite tests (155 total) also passed; full suite not re-run after that fix.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.0.115 (last maintainer-confirmed). v3.0.116–127 built and pushed, awaiting the next `deploy.sh` run and confirmation.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.116–127**, then run the dashboard PATCH sweep for reports closed in that range (`.claude/fixloop/flip-queue.txt` has the list).
2. **Try Again button vs. cost-preview toggle look inconsistent + interaction idea** — maintainer proposed short-tap=switch/long-press=commit; needs a design decision before building (fb:f453b1f3).
3. **CSV-portability lift** (ApprovalService.ts + characters.ts + theme.ts) — scoped 2026-07-12, ~half a day; blocks the maintainer's long-term content-only reskin goal. Not touched this session.

*(2026-07-13: budget-meter recalibrated mid-session from 55% → 82% against the maintainer's official `/usage` reading — local receipts had drifted significantly behind reality on a long session with multiple concurrent agents running elsewhere. Weekly budget adjusted 1398.33 → 1183.05 accordingly.)*
