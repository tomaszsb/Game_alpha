# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 18, 2026 (v3.8.13)
**Current Phase:** Beta — live in production
**Current Version:** **v3.8.13 LIVE** (`/health` `6b94e2a4` = HEAD at 15:28 UTC, deployed by the bug session on Tom's go for 10-18). Trust `/health`, never this line.

## Current sprint
10-18, the independent review (D:/Unravel/Independent_Review): every finding is in TODO.md "From the 2026-10-18 independent review", tagged for the overnight sessions. The bug session fixed: scope to zero (3.8.8), push-back erasing life events (3.8.9), NPC promises (3.8.10; "time went backwards" was good-luck events, not a bug), one bank-fee source + 20% warning on peakScope (3.8.11), deploy test gate (3.8.12), glossary fail-soft (3.8.13). Bug 6 (hold vs tap, "move on" names) waits on Tom.

## Health
- **Tests (v3.8.13):** build clean; `npm test` 284 files / 3982 green; ghost gate 45 passed, 1 skipped. Typecheck: only the pre-existing `tests/server/dataGate.test.ts` express-types errors (since v3.8.5).
- **Deploy:** `deploy.sh` now runs the tests first (its first real run is the next deploy).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom: bug 6 decision** (one gesture rule + one name for "move on"); robot facts in TODO.
2. **Next overnight sessions:** [N2] certificate questions + why-tips + restore guide; [N3] PLAYTEST design ideas.
3. **Tom:** reset teacher passwords; the device checks still listed in TODO.
