# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 19, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.20** — **deployed + confirmed live 2026-07-19** (bundle-verified: `v3.1.20 · 47c88a7`). Four real bug fixes: PC blank-view-after-restart (v3.1.17), a private card-replacement picker leaking to the shared/host screen (v3.1.18), a color picker that silently reassigned your color instead of showing it was taken (v3.1.19), and a Share button pushed off-screen on phones + missing entirely from the per-player mobile view (v3.1.20).

## Current sprint
**2026-07-19 — dashboard reconciliation + 4 real fixes, deployed same day.** User noticed the dashboard showed many open reports from May/June despite recent fix work; investigation found `TODO.md` had drifted badly from the live dashboard. Root cause: a 2026-07-01 feedback-staging draft (48 candidates) was never applied, and separately, 17 of the reports still showing "open" had actually already been fixed in v3.0.91/v3.0.97 (2026-07-01/06) but never flipped resolved. Reconciled all 22 open-but-untracked reports into TODO.md, then worked through them: 17 turned out already-fixed (flipped resolved on the dashboard, user-approved), 4 were real bugs (fixed, shipped, and deployed same day), 1 remains genuinely unactionable (a one-word report with no repro). Fixed the root cause in the `/start` skill itself: step 4d now cross-checks CHANGELOG.md before proposing a report as "new work," so an already-fixed-but-unflipped report routes to a flip proposal instead of redrafting it as a TODO item. Dashboard open count: 28 → 7.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, fast suite **2376/2377 passing, 1 pre-existing skip**, ghost gates **33/33** (all four 50-game batches, 0 hard failures).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = **v3.1.20** (`47c88a7`), confirmed 2026-07-19.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Real-TV checks** — the v3.1.2 camera fix confirmation + a look at the dark-mode slices, still outstanding from before this session.
2. **TVDisplay dark mode — needs a maintainer decision**, not a code fix: does a shared, across-the-room TV screen even want a dark toggle, and who would operate it?
3. **Dashboard backlog down to 7 open** — only 1 actionable ("Can't add player," no repro); the rest are Parking-lot/maintainer-decision items.
