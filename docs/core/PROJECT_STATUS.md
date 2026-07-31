# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 31, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.85** in the repo. **v3.1.84 confirmed live** (the setup screen's version badge read `v3.1.84 · 4eb984c` when screenshotted from production this session, after the user deployed). **v3.1.85 is pushed but not yet deployed** — it's screenshot-carousel assets only (`/challenge` marketing page), no gameplay-code change, so low urgency, but the live carousel is stale until it ships.

## Current sprint
**2026-07-31 — shipped the Homeowner Violation mechanic (v3.1.84), then closed two gaps found reviewing it, then finished the playtester screenshot carousel (v3.1.85), then fixed an AI-generated-label gap in the separate dictionary-scraper dashboard.** The violation mechanic: two new life-event cards (L050 flat, L051 daily-accrual) draw a corrective Work Package and start a 180-day Affidavit-of-Correction countdown; the civil penalty scales with the added work and whether it's filed on time. Self-review caught two real gaps before calling it done: `EndGameModal` didn't show an unresolved violation at game end (fixed — new `endGameViolationPenalty` state field + UI section), and `TurnTransitionHandler` had no dedicated test file at all (fixed — 13 new tests, plus 3 more for a previously-uncovered `TurnService` win-check branch). Screenshot carousel: reached into the live app's real `gameServices` via a React fiber walk to force won/lost/mid-game states for screenshots — a technique now documented in CLAUDE.md TACTICAL, reusable beyond screenshots. Along the way, deploying the dictionary-scraper fix surfaced that Unraid's live deployment carries real backend functionality (glossary auto-sync, Purgatory filtering, feedback-token auth) that was never committed to git — caught before a blind file overwrite would have deleted it; see TODO.md and memory.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2549 passed / 1 skipped / 0 failed** (172 files), ghost gates **33/33** (10 files, 641s). Both green.
- **Lint:** ✅ 0 errors, 35 warnings (unchanged baseline — 19 pre-existing `no-explicit-any` + 16 `set-state-in-effect`, both fully accounted for in `eslint.config.js`). Still not in CI: this repo has no `.github/workflows/` at all.
- **E2E determinism:** decks are seeded (`tests/helpers/seededRandom.ts`, default `20260728`, override `E2E_SEED=<n>`); `scripts/sweep-e2e-seeds.sh` hunts bad seeds.
- **Deploy:** live = v3.1.80 per the last bundle check; v3.1.81–v3.1.85 (security key rotation, live-verification docs, trading, Homeowner Violation, screenshot carousel) are pushed but not yet confirmed deployed — re-check the live bundle before trusting this line stays accurate.
- **Dashboard feedback:** 7 open as of the last check (2026-07-31), all tracked in TODO.md.
- **Dictionary-scraper (separate repo/deploy):** AI-generated-label fix shipped and deployed live 2026-07-31 (commit `f253e64`, frontend container rebuilt on Unraid, confirmed via live API). Found along the way: the server's git checkout has substantial live-only uncommitted backend code (glossary auto-sync, Purgatory filtering, feedback-token auth) — not broken, just at risk if that container is ever rebuilt from a stale image. See TODO.md's dictionary-scraper section.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.1.85 (screenshot carousel) whenever convenient** — pushed, not yet on the live game bundle. Low urgency (marketing-page assets only, no gameplay code).
2. **Player-to-player trading, Homeowner Violation mechanic — both built and shipped.** Nothing structurally left; normal playtest feedback is the only remaining input.
3. **Recruit 3–5 external players for structured UAT** — the funnel/QR infrastructure has been ready since April; this is outreach, not code.
