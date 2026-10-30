# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 30, 2026 (v3.9.8 committed + pushed, NOT deployed)
**Current Phase:** Beta — live in production
**Current Version:** **v3.9.8** pushed; live is v3.9.5 (`/health` `7efdf156`). Check `/health` against `git rev-parse --short HEAD` before saying what is live.

## Current sprint
The round town (fb:fefe42f8), opt-in: the shared buildings in a ring round a park with a fountain, a side per player, a table that turns to the player whose turn it is, clocks on the rim, pulsing move choices (3.9.6); buildings drawn by their job with the name on a sign on the front wall (3.9.7); "Round town" as a third board choice on the setup screen and in the Menu (3.9.8). Default board unchanged.

## Health
- **Tests (v3.9.8):** `npm test` 347 files / 4,427 pass; build OK. Typecheck: only the 9 old test-file errors (`dataGate`, `finalStretch`). `test:ghost` not rerun (no engine change since 3.9.5).
- **Deploy:** `deploy.sh` runs `npm ci` + `npm test` first; Tom deploys himself.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.9.8** and play one round-town game on the TV (never tried on a real Fire Stick).
2. **Round town loose ends:** no test yet that no two signs overlap at every pose; the trailer's sign is ~11 px on a 4-player TV; weather and small props not drawn on it; the teacher Town settings strip never clicked in a browser.
3. **Stage 2** (talk bubbles, panel split, glossary viewer) waits for Tom's TV test.
