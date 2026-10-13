# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 13, 2026 (v3.7.33)
**Current Phase:** Beta — live in production
**Current Version:** **v3.7.33 — LIVE (`/health` `788a5ea4` = HEAD, 2026-10-13 22:17 UTC).** Trust `/health`, never this line.

## Current sprint
Latest: Tom's four reports from 10-13, built in order and now live: v3.7.25 one bubble per kind per tap; v3.7.26 orange part-way "Funded 78%" plus the loan-fee line; v3.7.27/28/30 the town reveals names as the game goes, two construction sites (new building / renovation, picked by the scope's `card_kind` tags) and per-player owner house, office and site; v3.7.29/31/32 the clipboard (Money and Scope side by side on a phone, the player's colour, page tabs, eight round icons wearing their building's picture, flipping pages, play pop-ups as clipboard pages); v3.7.33 two-column "This turn" rows (button left, proposed result right). Before that: v3.7.24 "Lock the scope" fix, the town board (3.7.6-15) and the clipboard look (3.7.16-23).

## Health
- **Tests (v3.7.33):** typecheck + build clean; `npm test` 272 files / 3896 green (exit 0); ghost gate green (11 files / 43 tests, 1 skipped). Phone panel 647 px at 360x640 and 390x844 (was 649).
- **Feedback dashboard:** 56 open on 10-13 (~3 newer than the last triage are untracked; see NEXT_SESSION).
- **Machine:** Node 24.10.0 (matches Dockerfile).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom's look at 3.7.14-3.7.33 (all live)** on real devices (list in TODO "Tom's checks"), then flip the confirmed reports. Not seen in motion: the page flip; not seen on a real TV: the 4-player town.
2. **Two small choices for Tom:** what the Life events page holds; whether the "Remove / Replace / No change" rolls get worded in the right column of "This turn".
3. **Money/scope bug** (scope not reproduced; waiting on Tom's reload result + same player on another screen). Parked: the ResizeObserver loop error (needs Chrome connected) and the untriaged reports fb:a49b598f, f9e897b0, bf9dd267.
