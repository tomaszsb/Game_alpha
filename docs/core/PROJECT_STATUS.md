# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 23, 2026 (v3.8.46 LIVE)
**Current Phase:** Beta — live in production
**Current Version:** **v3.8.46 LIVE** (`/health` `22f1de48`, checked 10-23 13:00 UTC). v3.8.41-46: pulsing red warnings, per-space work-button help, plain History notes, shorter commit hint, loans named for your project, "to raise", push-back keeps expeditor days and the drawer's lasting life event, certificate asks for a name.
**v3.8.47-49 (committed + pushed, not deployed; 49 = picture card, TV button opens it on a phone; 48 = maker-list sources, "My TV isn't listed", TV-family count in Site Stats):** "Step 1: put the game on a big screen" card for phone-first students (setup screen, /challenge, /class); suite 308 files / 4102 green.

## Current sprint
10-22/23, answering the Farmingdale class games: two bankruptcies right after hiring a builder (warnings now pulse; Hire stays allowed), a lasting life event the drawer escaped by pushing back (fixed), "Player 1" certificates (name box), wording fixes. Tom's rule this week: a played card is spent for good, and so is what it did.

## Health
- **Tests (v3.8.46):** build clean; `npm test` 307 files / 4095 green; ghost 15 passed, 1 skipped. Typecheck: only the pre-existing `tests/server/dataGate.test.ts` express-types errors. One unreproduced failure of `E2E-LogicPlaythrough` in a full run (pinned afterwards; see CHANGELOG housekeeping 10-21).
- **Deploy:** `deploy.sh` runs the tests first, and stops if a screen is connected (`FORCE=1` or `ssh -t` and type yes).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Read the Jarvis report on v3.8.46** (hold on Hire, opened walls, the office's extra choices, game length).
2. **Office reports left:** the "owner decides" help sentence names the owner at architect/engineer spaces; "turns show no days" (now worded in History, not confirmed what the student saw).
3. **N3 design:** Inspector sign-off, Hire an Expeditor fork, TCO vs final CO; refile when a redesign should cancel DOB approval.
