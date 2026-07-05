# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 5, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.95** — **pending deploy** (production still runs v3.0.94; the mid-session `deploy.sh` run happened before this session's commits existed, so it re-pulled the old code). New Playtester Acquisition landing page at `/challenge`: real calendar/bookmark/PWA-install/browser-push/email-text reminders, campaign-source tracking through every link.

## Current sprint
**2026-07-05 — Playtester Acquisition System, first cut.** QR-code landing page mounted as its own React root (zero changes to `App.tsx`/game code). All four Reminder Hub options are real: calendar (.ics), bookmark (fixed — was silently doing nothing, now shows device-aware instructions), PWA install (fixed a manifest icon-size bug that silently failed installability), browser push (VAPID + persistent scheduler), email/text (SMTP + carrier-gateway SMS). Found and fixed a campaign-source propagation gap across all three reminder link-builders. Deferred: real mobile-preview mini-puzzle and demo video (both grayed "coming soon" — need actual content, not more engineering).

## Health
- **Tests:** typecheck + build clean. **Full suite ran this session: 2,293 passed / 1 skipped** (previous session's baseline — see NEXT_SESSION.md for this session's own run).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.95 pending.** Production's `.env` already has SMTP + VAPID keys added (this session, via scp+ssh append) — deploying just needs `deploy.sh` to pull the code that uses them. Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.95** — code is committed/pushed; production `.env` already has the new SMTP/VAPID keys, so a normal `deploy.sh` run should light up email/text + push reminders live.
2. **Confirm the glossary tap fix on a real tablet** (the cursor:pointer cause is desktop-verified only — hypothesis for the iPad report fb:baa01a70, carried over from the 2026-07-02 session).
3. **Remaining standalone bugs:** Move button disappeared after bug-report popup (fb:bf8bf19a), buttons gone after board zoom (fb:45cb8b0c), action-count off-by-one (fb:65160c0c — needs repro with space name).
