# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 21, 2026 (v3.8.40 pushed; v3.8.33-40 pending Tom's deploy)
**Current Phase:** Beta — live in production
**Current Version:** live is v3.8.32 (`/health` `3ea9e061`, checked 10-21 05:29 UTC); **v3.8.40 pushed (`fcd5f8f7`), pending Tom's deploy** (v3.8.33-40: neutral dice words, "you would be short" warnings, pop-up snap-flat, the office keeps unlocked steps, Your Office, expeditor cost on the Money page, History shows the turn in progress, certificate logo + other-sites links, wider end screen, admin list shows MINE/STUDENT and progress, push-back shown in History, "Hold until it fills" cue).

## Current sprint
10-20/21, the SUNY Farmingdale classes (courses 350/409): about 10 class games ended 10-20 evening, 3 lost to bankruptcy right after the builder was signed. Shipped from their reports: hold-to-hire, opened walls (1 in 6 back to the engineer on the cheap inspector branches), start screen says a TV needs TV AND phones, screenshots fixed (color-mix), Site Stats in New York days, the office keeps unlocked steps. Jarvis robot: holds Hire 2.6 s; untested on the new office until after deploy.

## Health
- **Tests (v3.8.40):** build clean; `npm test` 307 files / 4083 green. Typecheck: only the pre-existing `tests/server/dataGate.test.ts` express-types errors. One unreproduced failure of `E2E-LogicPlaythrough` in a full run (pinned afterwards; see CHANGELOG housekeeping 10-21).
- **Deploy:** `deploy.sh` runs the tests first, and stops if a screen is connected (`FORCE=1` or `ssh -t` and type yes).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Tom:** deploy v3.8.40 (before 02:45 EDT or after 04:45), then watch tonight's Jarvis report for the hold, opened walls and office.
2. **Office reports left:** the "owner decides" help sentence names the owner at architect/engineer spaces; "turns show no days" (now worded in History, not confirmed what the student saw).
3. **N3 design:** Inspector sign-off, Hire an Expeditor fork, TCO vs final CO; refile when a redesign should cancel DOB approval.
