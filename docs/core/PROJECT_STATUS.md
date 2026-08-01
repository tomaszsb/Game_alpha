# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 1, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.87** in the repo, pushed, not yet deployed — this session changed zero player-visible gameplay (docs, dependency cleanup, dead-code removal, test tooling, a server-side version-reporting fix). Last confirmed-live version is v3.1.85 (2026-08-01, earlier session); not re-verified this session since nothing here needed a deploy to check.

## Current sprint
**2026-08-01 (continued) — a backlog-clearing session, not a feature sprint.** Closed the handoff's top-3 (API_REFERENCE.md's REST endpoint gap, now fully documented 55/55; confirmed `.swcrc`/`@swc/core` genuinely dead and removed them; UAT recruiting stays open — it's outreach, not code). Then worked through TODO.md's Parking lot picking off small, ungated, verified cleanups one at a time: 2 meaningless wall-clock tests deleted, 5 dead `notificationService` constructor params removed (rippled to 24 files once traced through `TurnService`), a real `/health` version-reporting bug fixed in the Dockerfile, a 2-session-old "modal won't dismiss in the test harness" mystery definitively root-caused (not a game bug — a `AnimatePresence`/non-compositing-pane interaction), `/koniec` itself improved (new step 4a auto-flips confirmed-deployed feedback before the handoff overwrites the evidence), a misleading "deep copies" claim in `StateService` corrected, and a dead duplicate validation method deleted after confirming (not assuming) that the real check already lives elsewhere in production.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2543 passed / 1 skipped / 0 failed** (172 files — down from 2549 baseline, 6 tests deliberately deleted alongside the dead code/tests they tested, not regressions). Ghost gates **33/33** (10 files, ~639s), unchanged.
- **Lint:** ✅ 0 errors, 35 warnings (unchanged baseline; a genuine 16-error regression from an earlier session's uncovered `eslint.config.js` glob gap was found and fixed this session).
- **E2E determinism:** decks are seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds.
- **Deploy:** not touched this session (nothing shipped needs one urgently — see Current Version above).
- **Dashboard feedback:** 7 open as of the last live check (2026-07-31), unchanged this session (no player-facing fix shipped).
- **Dictionary-scraper (separate repo/deploy):** unchanged this session.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Recruit 3–5 external players for structured UAT** — the funnel/QR infrastructure has been ready since April; this is outreach, not code.
2. **`CardService.discardCards` silently drops its `source`/`reason` args** — wiring them into the audit-trail log changes player- and teacher-visible text, so it needs your call before it's just done as a drive-by.
3. **Demo video** — script + storyboard drafted; needs footage, then wire the "Watch demo" button.
