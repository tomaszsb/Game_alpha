# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 7, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.98** — **pending deploy** (v3.0.97 is what's live; this session's work is committed + pushed but not yet on production).

## Current sprint
**2026-07-07 — live-playtest verification + design/content polish pass.** Played a real 2-player game as both players to verify the new-panel-as-default experience shipped last session, and found 4 real bugs the earlier pre-deploy verification missed: the `{fundingAmount}` template never rendered in the new panel, NPC portraits/badges never existed there at all (the feature was simply never built for this panel, not a suppression bug), "What's affecting you" wasn't collapsible, and inactive players' mini-bars sat above the active player's panel (a "rolodex" ordering fix). Then worked through the user's design backlog directly: closed the maintainer's Action/Outcome question (fb:f6e100b7 — restored as a collapsed disclosure, plus fixed one genuinely missing data row), modal chrome polish ("Why this matters" now leads, single close path), movement destinations collapsed behind one "Move" toggle, a 30-card Life Event narration rewrite, board tiles now show discipline (not just phase), and the board editor got real drag-overlap prevention. Full detail + file links in CHANGELOG v3.0.98.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite hit the known Windows ghost-test hang after `tests/ghost/coverage.test.ts` passed (675s) — fell back to the documented targeted sweep (`tests/components/ tests/utils/ tests/services/`): **1806/1806 passing** across 108 files. No new failures found.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.98 NOT yet deployed** — committed + pushed to master, awaiting `bash deploy.sh` from a Windows terminal (never `docker compose up`). Last verified-live version is v3.0.97 (2026-07-06).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.98** — code is on master, needs `bash deploy.sh` run by the user.
2. **Bank/Investor/Lender have no character entry** — 6 board spaces (Bank, Investor, Lender, PM's own decision point, Cheat/Bypass, Finish) still show phase-only labels since the game has never defined an NPC for them. User is deciding whether to invent names/colors for these.
3. **Board-editor drag-overlap fix needs a real mouse-drag confirmation** — verified via 6 unit tests + code review only; synthetic pointer events don't register with React Flow's drag system in this session's browser automation, so nobody has watched it happen live yet.
