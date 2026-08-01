# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 1, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.86** in the repo. **v3.1.85 confirmed live** (bundle-verified: the served `index-*.js` embeds commit `562f9d1`, this session's own work, though the label still reads "3.1.85" since the bump to 3.1.86 landed in the commit right after that deploy — zero player-visible difference, nothing this session touched is runtime code). v3.1.86 is pushed; next deploy will pick up the correct label.

## Current sprint
**2026-08-01 — an audit-then-fix session, not a feature sprint.** A prior session left 5 AI-generated analysis reports uncommitted at the repo root, never actioned. Rather than trust them, every claim was spot-checked against real evidence first — about half held up, about half didn't. What was real and got fixed: `tests/scripts/run-tests-batch-fixed.sh` had 16 dead paths from the classic-panel→V2 migration, silently hard-failing 5 of its 23 batches on every run; repaired and verified 22/22 green. Four docs (`ARCHITECTURE.md`, `TESTING_GUIDE.md`, `USER_MANUAL.md` — 3 months stale; `API_REFERENCE.md` — less stale but wrong in specifics) got real content refreshes against current source, not just date bumps — the biggest single find was `USER_MANUAL.md` still describing the deleted classic 5-tab player panel. What wasn't real: the cleanup report's claim that `vitest.config.ts` was redundant (it's the real default config), and one doc-staleness finding that was already fixed by the time the report was written. Also archived 2 confirmed-dead source files, fixed a `.gitignore` gap that had let an empty file get tracked, and cleaned ~11.5MB of confirmed-safe local disk clutter.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2549 passed / 1 skipped / 0 failed** (172 files) — re-verified this session, zero regressions. Ghost gates: running as part of this session's `/koniec` pre-flight, see NEXT_SESSION.md for the result.
- **Lint:** ✅ 0 errors, 35 warnings (unchanged baseline).
- **E2E determinism:** decks are seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds.
- **Deploy:** live bundle confirmed at commit `562f9d1` (mid-session, bundle-grepped, not assumed) — see "Current Version" above.
- **Dashboard feedback:** 7 open as of the last check (2026-07-31), all tracked in TODO.md — unchanged this session (no code shipped that closes any open report).
- **Dictionary-scraper (separate repo/deploy):** unchanged this session — see prior sprint note in CHANGELOG for the 2026-07-31 fix.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **`API_REFERENCE.md`'s REST API table only documents ~13 of ~55 real routes** — accounts/login, Teacher Layer instances, admin, and playtest tracking are entirely undocumented. Real work (each route needs its handler read), not a quick fix.
2. **`.swcrc` + `@swc/core` look like dead Jest-era leftovers** — unconfirmed, touches a real dependency, ~10-15 min investigation when picked up.
3. **Recruit 3–5 external players for structured UAT** — the funnel/QR infrastructure has been ready since April; this is outreach, not code.
