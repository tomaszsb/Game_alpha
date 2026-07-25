# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 25, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.31** — pushed to `origin/master`, **pending deploy**. Live/deployed is v3.1.29 (`1c2130a`, confirmed live 2026-07-24). 8 commits/2 versions ahead of what's deployed.

## Current sprint
**2026-07-24/25 — CHANGELOG reconciliation + `/loop /fixloop` clean-up sweep of the 2026-07-21 playtest batch.** Session opened by discovering a prior session had shipped 9 real commits (including 3 security fixes) without ever running `/koniec` — `CHANGELOG.md`/`package.json` were stale relative to `git log`. Reconciled that gap (v3.1.21–23), found and fixed the version badge's own sync-check bug in the process (v3.1.24), then ran a long `/loop /fixloop` stretch clearing every HIGH item and most MEDIUM/LOW items from the 2026-07-21 Playwright playtest findings: a board-copy templating bug, a duplicate log line, a log-ordering bug, solo-game card copy, a Game Log grammar bug, a stale test assertion, and an a11y DOM-cleanup fix. 4 of the LOW items turned out to be automation-observation artifacts rather than real bugs (documented in CLAUDE.md TACTICAL) — verified live and closed without code changes. Mid-session, the fixloop budget meter was recalibrated against the official `/usage` reading: the local tracker had been overestimating the weekly budget by ~11x ($2284 vs. the real $202.89) — headroom is now correctly tracked at a much tighter margin.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2445/2447 passing** (1 pre-existing skip, 1 known `E2E-Multiplayer2P` scheduling flake under full-suite load — confirmed pre-existing/non-regression, passes in isolation), ghost gates: see NEXT_SESSION.md / re-run if stale.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = **v3.1.29** (`1c2130a`), confirmed 2026-07-24. v3.1.31 pushed, not yet deployed.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.1.31** — 8 commits of fixes sitting pushed but undeployed (including 2 security fixes carried over from before this session's start).
2. **Real-TV checks + TVDisplay dark-mode decision** — still outstanding from before this session; needs a trip to the actual TV and a maintainer call on whether the shared screen wants a dark toggle at all.
3. **Remaining MEDIUM items need maintainer decisions, not more autonomous fixes** — funding-gap number reconciliation, "Funding raised" definition, and the High-Profile Client (L021) mechanic-vs-copy call are all real open questions, not bugs to fix blind.
