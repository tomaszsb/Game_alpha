# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 8, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.99** — **pending deploy** (v3.0.98 is the last version deployed live; production `.env` needs `ALERT_PHONE`/`ALERT_CARRIER` added before this deploy for the new text-alert feature to work).

## Current sprint
**2026-07-08 — two sessions in parallel: foreign-IP alert/spectator view, and a real bug caught by live drag verification.** The user is starting to get real outside playtesters and wanted to know when someone joins from off the home network. One session shipped that: removed the unreliable ntfy.sh push integration entirely, replaced it with a carrier-SMS text alert (`sendOwnerAlert()`) gated behind an admin-toggleable setting, auto-detecting the home IP instead of requiring a manual env var, plus a read-only "👁️ Spectate" button in Admin Tools reusing the existing `TVDisplay.tsx`. A concurrent session verified both pieces live in a real browser (checkbox persists, Spectate opens a genuine read-only view) and separately re-verified the v3.0.98 board-editor drag-overlap fix with an actual mouse drag — found it silently didn't work (React Flow's drag-end settle event bypassed the overlap check), fixed the one-line gate, and confirmed live. Also resolved two backlog design questions: Expeditors now warn (not block) when playing early would waste part of their day-savings, and the "outcome modal scope change" item turned out to already be resolved by earlier work (audit only, no code needed). Full detail + file links in CHANGELOG v3.0.99.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite: **2340/2341 passing, 1 skipped** (1 E2E test timed out under heavy parallel load alongside the ghost simulations; re-ran in isolation and passed cleanly in 269ms — confirmed not a regression).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.99 pending** — production `.env` needs `ALERT_PHONE=3472604300` + `ALERT_CARRIER=tmobile` added first (deploys don't touch env files), then `bash deploy.sh` from a Windows terminal.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Bank/Investor/Lender have no character entry** — 6 board spaces (Bank, Investor, Lender, PM's own decision point, Cheat/Bypass, Finish) still show phase-only labels since the game has never defined an NPC for them. User is deciding whether to invent names/colors for these.
2. **No plan-examiner verdict shown** — after a plan examination nothing surfaces the result; needs a new verdict modal (pairs with making DOB/FDNY approval a bigger moment). Not started — flagged as genuinely new work, not a quick fix.
3. **Host-to-player messaging** — no channel exists to send a message into a live game (companion to the new spectate feature and useful for remote-classroom teacher use). Needs its own design pass: who can send, free text vs. presets, does it interrupt play.
