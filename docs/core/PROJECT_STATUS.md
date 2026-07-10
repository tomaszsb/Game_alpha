# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 9, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.100** — **pending deploy** (v3.0.99's foreign-IP alert feature is the last one live; production `.env` still needs `ALERT_PHONE`/`ALERT_CARRIER` added if that hasn't landed yet).

## Current sprint
**2026-07-09 — one bug report unraveled into six real fixes.** Started investigating "nothing showed me the plan examiner verdict" and kept finding a deeper cause underneath each fix: the verdict banner was genuinely buried in collapsed text, but the actual reason it was invisible is that `TurnService.startTurn()` auto-rolls dice for DOB/FDNY plan-exam spaces with no button at all and discarded the result — no modal ever opened in normal play. Fixing that surfaced the same shape of bug for owner seed money, and fixing *that* required finding that `PlayerPanelV2` (the default panel since v3.0.97) has never rendered the `playerNotification` prop it receives, meaning every toast notification anywhere in the app has been silently invisible for weeks. Also fixed: a `{fundingAmount}` token leak on two more funding spaces, a completely silent DOB/FDNY approval-revoke path, a foreign-game-alert false-positive firing on every deploy restart, and reserved "approve" language for DOB/FDNY sign-off only (was also used for architect/engineer/contractor sign-off, reading as confusable). 14 dashboard feedback reports checked and closed. Full detail + file links in CHANGELOG v3.0.100.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite hung on Windows per known issue (see CLAUDE.md); targeted fallback sweep (`tests/components/ tests/utils/ tests/services/`) — **108 test files, 1807 tests, all passing**.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.100 pending.** Run `bash deploy.sh` from a Windows terminal (not WSL).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Bank/Investor/Lender have no character entry** — 6 board spaces (Bank, Investor, Lender, PM's own decision point, Cheat/Bypass, Finish) still show phase-only labels since the game has never defined an NPC for them. User is deciding whether to invent names/colors for these — parked, don't nudge.
2. **6x duplicate `subscribeToAutoActions` firing** — every auto-action event fires 6 times instead of once, reproducible on a fresh browser session. Currently harmless (existing handlers are idempotent) but worth root-causing before a future non-idempotent handler misbehaves. Flagged as a background task this session, not yet investigated.
3. **Host-to-player messaging** — no channel exists to send a message into a live game (companion to the spectate feature, useful for remote-classroom teacher use). Needs its own design pass: who can send, free text vs. presets, does it interrupt play.
