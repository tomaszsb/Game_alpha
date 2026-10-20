# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 20, 2026 (v3.8.27 pushed, pending deploy)
**Current Phase:** Beta — live in production
**Current Version:** **v3.8.26 LIVE** (`/health` `0f360f74`); **v3.8.27 pushed (`63897bef`), pending Tom's deploy**: SUNY Farmingdale /class wording and the Course 350/409 pick on the certificate. Trust `/health`, never this line.

## Current sprint
10-18, the independent review + two playtests (D:/Unravel/Independent_Review). Shipped: review bugs (3.8.8-3.8.13), one "Move on" name (3.8.14), certificate fun + "why" questions with answers on the certificate and saved without IP, admin list in Site Stats, and five PLAYTEST-2 fixes (3.8.15), restore guide in ARCHITECTURE.md (untested). Next: N3 design ideas (PLAYTEST.md Part 2) and the why-tips during play (Q6).

## Health
- **Tests (v3.8.27):** build clean; `npm test` 299 files / 4042 green. Typecheck: only the pre-existing `tests/server/dataGate.test.ts` express-types errors (since v3.8.5).
- **Deploy:** `deploy.sh` runs the tests first (proven twice on the Tower 10-18, about 3 extra minutes).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom:** deploy v3.8.27, then play to the end on a phone, tick a course, print to PDF; read it in Admin > Site Stats > Class answers.
2. **N3:** PLAYTEST.md Part 2 design ideas (fix-or-steer at Site Inspection, TR8 test now/later at Trouble On Site, fewer forced expeditors); Q6 why-tips.
3. **Tom:** keep `.env` and `server/data` copies off the Tower (nothing backs them up today); reset teacher passwords.
