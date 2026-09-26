# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 26, 2026 (v3.2.82)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.82 — LIVE.** `/health` → `50fb329`, checked 2026-09-26 21:03 UTC. Trust `/health`, never this line: equal to HEAD ⇒ deployed; a docs-only HEAD ahead of it means nothing to deploy.

## Current sprint
**Onboarding Phase C, teaching a beginner the game** (Tom's 2026-09-19 replan: no new tutorial layer — one help look for the whole game, one recurring mentor, existing wording reused). This session (2026-09-26) brought in all the work the cloud helpers built: **v3.2.77–79 Job 3** (colour-dot version badge; TV "Adjust screen size" button in the header with a first-use pulse; live Bigger/Smaller/Keep with ~10 s snap-back), **v3.2.80** search-engine basics, **v3.2.81** three approved wording fixes — deployed — and then, at Tom's "go", **v3.2.82 Remote play mode** (a real third way to play: separate places, every device its own board + panel). Reading the Remote play diff found one real defect the cloud author and reviewer had both called harmless: a plain wrapper stopped the phone panel scrolling outside Remote mode. Proven in a real Chromium, fixed in one line, pinned by a new test that fails on the bad version.

## Health
- **Tests (v3.2.82):** `npm test` **223 files / 3484 tests green**. Ghost gates **11 files / 43 tests green**; smart-bot **49/50 wins, 70.1 avg turns — identical to baseline**. Typecheck ✅, build ✅. Lint not re-run here.
- **Not verified by anyone yet:** Job 3 on a real 4K TV (deployed, unseen), and Remote play on two real phones on different networks (headless Chromium only, host + second tab).
- **Weekly allowance (read 2026-09-26):** Pro plan, ~78–80% used, resets Monday 2026-09-28 ~07:00 EDT; extra-usage is off and its budget is spent. Say the cost before any big step.
- **Nightly robot:** its `TAB_SUFFIX_RE` regex in the Jarvis repo still needs to accept both "tap to compare" and "tap to see the cost" (cosmetic; not this repo).
- **Dashboard:** fb:93449bf2 waits for Tom's eyes on the real TV; fb:ae480630 / fb:11662ac3 need a live look at Lender Review. 9 of 17 open reports are not tracked in TODO/CHANGELOG — run `/start full`.
- **GitHub:** all four cloud PRs are handled (#5 and #3 merged, #1/#2/#4 closed as superseded); none open.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's two real-device checks (all deployed):** Job 3 on the 4K TV (checklist in TODO "📺 Active"; then flip fb:93449bf2) and Remote play on two phones on different networks (script in TODO "📱 Active").
2. **Slice 2 mentor** (Ruth + handbook icon — confirmed, not built), the RULES modal body rewrite, and Tom's "go" on the "?" placement work.
3. Read `pushBacks.foreign` once real players exist.
