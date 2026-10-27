# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 27, 2026 (v3.9.3 committed + pushed, NOT deployed)
**Current Phase:** Beta — live in production
**Current Version:** **v3.9.3** pushed; live is v3.9.2 (`8161b8b4`, /health 2026-10-27 19:45 UTC). Check `/health` against `git rev-parse --short HEAD` before saying what is live.

## Current sprint
Bug-report pass 2 (10-27 evening): all 25 open reports re-checked; none was a new fixable bug (they wait on Tom's devices, a student's confirmation, or are design wishes). Built Tom's own report fb:fefe42f8: players are big pawns in their colour with their face on top, standing on the building's sign (3.9.3). Tom picks the pawn body (A/B/C) from `public/assets/pawns/contact_sheet.png`.

## Health
- **Tests (v3.9.3):** `npm test` 344 files / 4,399 pass; build OK; lint clean on changed files. Typecheck: only old test-file errors (`dataGate`, `finalStretch`).
- **Deploy:** `deploy.sh` runs `npm ci` + `npm test` first; Tom deploys himself.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.9.3**, look at the pawns on PC and TV, pick body A/B/C.
2. **Town layout half of fb:fefe42f8:** shared buildings in the middle, player areas on the outskirts, owner/office in player colour (design, Tom's go).
3. **Tom's TV:** Sony Bravia / Silk slow buttons (fb:5d7e02d9); TV player area too big (fb:7fbea636).
