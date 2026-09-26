# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 26, 2026 (v3.2.81)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.81 — LIVE.** `/health` → `deaad6d`, checked 2026-09-26 ~20:18 UTC right after Tom's deploy. Trust `/health`, never this line.

## Current sprint
**Onboarding Phase C, teaching a beginner the game** (Tom's 2026-09-19 replan: no new tutorial layer — one help look for the whole game, one recurring mentor, existing wording reused). This session (2026-09-26) brought in the work cloud helpers built the day before: **v3.2.77–79 Job 3** (version badge as a plain colour dot with docs-only counting as up to date; the TV "Adjust screen size" button moved into the header with a first-use pulse; live Bigger/Smaller/Keep with a ~10 s snap-back), **v3.2.80** search-engine basics (`robots.txt`, `sitemap.xml`, a real H1), **v3.2.81** three small wording fixes Tom approved (Architect/Engineer "Take your next step", Owner's Money preview sentence hidden while blank, the 24 Pick Your Path tips switched on). A cloud integrator combined three of the four cloud PRs into one; the Manager re-tested it independently; this session fast-forwarded master, re-ran everything, pushed after Tom's explicit yes, and closed the three superseded PRs. **Remote play (PR #3) was held out on purpose** and waits for Tom's two-real-phones test.

## Health
- **Tests (v3.2.81):** `npm test` **221 files / 3459 tests green**. Ghost gates **11 files / 43 tests green**; smart-bot **49/50 wins, 70.1 avg turns — identical to the v3.2.76 baseline**. Typecheck ✅, build ✅. Lint was not re-run here (the cloud integrator reported 0 errors, 36 old-pattern warnings).
- **Not verified by anyone yet:** the TV behaviour of Job 3 on a real 4K TV (the cloud helper only had headless Chromium, which does not apply a TV's viewport resize).
- **Weekly allowance (read 2026-09-26):** Pro plan, weekly meter ~78%, resets Monday 2026-09-28 ~07:00 EDT; extra-usage is off and its budget is spent. Say the cost before any big step.
- **Nightly robot:** its `TAB_SUFFIX_RE` regex in the Jarvis repo still needs to accept both "tap to compare" and "tap to see the cost" (cosmetic; not this repo).
- **Dashboard:** fb:93449bf2 waits for Tom's eyes on the real TV; fb:ae480630 / fb:11662ac3 need a live look at Lender Review. 9 of 17 open reports are not tracked in TODO/CHANGELOG — run `/start full`.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's real-TV check of Job 3** (checklist in TODO "📺 Active"), then flip fb:93449bf2.
2. **Tom's answers / next builds:** "go" on the "?" placement work; Slice 2 mentor (Ruth + handbook icon — confirmed, not built); the RULES modal body rewrite.
3. **Remote play (PR #3)** — needs the two-phone test, then review + renumber to 3.2.82 + merge.
