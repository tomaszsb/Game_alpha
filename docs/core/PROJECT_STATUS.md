# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** August 17, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.13** — pushed to origin/master, not yet deployed.

## Current sprint
**2026-08-17 — first session under the new "work TODO.md proactively" pattern.** Finished a board-editor picker-popup left uncommitted from the prior session (v3.2.11), then shipped two real reliability fixes straight from the backlog: a "Resume your last game?" prompt for bare-URL visits (v3.2.12), and a friendly explanation screen for expired/invalid shared game links instead of a silent blank setup screen (v3.2.13, closes fb:feedback-1781190420890-5a155a1a). Also attempted a live repro of the long-standing Con-Initiation crash report using the session's Browser-pane tool — confirmed (not just suspected) that the tool cannot produce a trustworthy repro here, since the tab reports `document.visibilityState: 'hidden'` even when called "foregrounded." That item now firmly needs the maintainer's own browser.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite (`npm test`) **2765/2765** passing (189 files). `npm run test:ghost` backgrounded, result pending as of this snapshot — check `.claude/NEXT_SESSION.md` if it hadn't finished by session end.
- **Lint:** not touched this session.
- **Deploy:** v3.2.13 pushed to origin/master, not yet deployed — maintainer deploys manually.
- **Dashboard feedback:** fb:feedback-1781190420890-5a155a1a fixed this session (v3.2.13) but not yet flipped resolved — pending deploy confirmation.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Con-Initiation crash** — needs the maintainer's own foregrounded-browser repro; confirmed this session that automated tooling cannot produce trustworthy signal here.
2. **G160 restore-picker + hover-highlight (v3.1.95) + the new pick-by-name popup (v3.2.11)** — code-complete and deployed, just needs the maintainer's own real-browser confirmation it feels right.
3. **D&D-reskin engagement-data question** — real signal still thin (9 real games in 13 days); current read points at join-friction over board theme. Revisit after another 2-3 weeks of traffic.
