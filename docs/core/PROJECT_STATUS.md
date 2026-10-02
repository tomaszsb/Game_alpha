# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 1, 2026 (v3.2.90)
**Current Phase:** Beta — live in production
**Current Version:** **3.2.90 — deployed.** `/health` → `d8a07f9` (2026-10-01 07:21 EDT). Trust `/health`, never this line.

## Current sprint
**Real-TV test follow-up.** Tom's iPhone scanned a player QR and ran the TV screen. Root cause: since v3.2.81 the TV-mode QR links carried `&mode=tv`, which the app honours over the controller. v3.2.90: only `mode=remote` rides a personal link, the app ignores `mode=tv` on a link with a player, and a phone never inherits/stores a TV choice. Earlier this week: push-back money model, TV batch, DOB/FDNY tags, destination-list fix, nodemailer 10 + vitest 5 (v3.2.85–89).

## Health
- **Tests (v3.2.90):** `npm test` 453 files / 7069 tests green, typecheck ✅, build ✅. ghost gates 11 files / 43 tests green.
- **Feedback dashboard:** ~27 open; the four phone-became-TV reports are fixed but unflipped until Tom re-scans on a phone.
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom re-scans a TV-mode QR on a real phone**, then flip the four reports; also the real-TV check of wake lock and auto-center.
2. **Decisions waiting on Tom:** architect/engineer `try_again_fee_share` (currently 1); scope wording (fb:612fbdc4); glow on later visits; the "?" placement go.
3. **fb:ef974f1c and fb:b38110f3** (09-27: phone on shared host view / old finished game showing) — not the QR cause; uninvestigated.
