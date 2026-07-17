# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 17, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.4** — **shipped, deployed, confirmed live** (commit `695aef0`, verified via the live JS bundle's embedded version string).

## Current sprint
**2026-07-17 — PlayerSetup.tsx decomposition.** Closed the architecture parking-lot item flagged in the prior two sessions: the 2166-line setup-screen monolith (mixing player CRUD, PC/TV/Remote mode, join-by-code + picker, admin/teacher login, the admin Game Manager, game settings, a mobile per-player view, and ~250 lines of styles) is now a 673-line orchestrator plus 8 new focused files under `src/components/setup/`, following the folder's existing one-concern-per-file convention. Planned via `EnterPlanMode` + a `Plan` subagent design review; executed as 9 independently-verified extraction steps, each checked with typecheck + build + a live browser click-through (admin login/lock, the 5s game-list poll starting/stopping on mount/unmount, PC/TV/Remote toggling, join-by-code both with and without an existing roster, modal wiring, and a full Start Game click into the live PLAY phase). Full detail in CHANGELOG v3.1.4.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2375/2380 passing, 1 skipped, 4 failures — all confirmed non-regressions** (746s). 3 are the pre-existing `E2E-AllPaths.test.ts` intermittent timeout under load (tracked in TODO.md's parking lot since 2026-07-13); the 4th is a performance-benchmark miss (`gameLogic.test.ts`) that passed cleanly when re-run alone. Neither failing file has any connection to this session's changes.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.1.4, confirmed 2026-07-17. No pending deploy.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding from two sessions ago; this repo's embedded browser can't play animated camera transitions at all (throttles animation frames), so it was verified via unit tests + state instrumentation, not a watched animation. A glance on the maintainer's real TV is the honest final check.
2. **Domain event architecture** — the most interesting long-term direction (per the 2026-07-14 external review), needs a dedicated design pass before any engineering. See TODO.md's Architecture/code-health parking lot for the full framing.
3. **Nothing blocking** — pick from TODO.md's other Active sections (playtester acquisition screenshot carousel/demo video, dark/light mode coverage beyond `PlayerPanelV2`, dashboard `version`/`gitCommit` display) or the parking lot.
