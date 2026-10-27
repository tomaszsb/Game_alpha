# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 27, 2026 (v3.9.2 committed + pushed, NOT deployed)
**Current Phase:** Beta — live in production
**Current Version:** **v3.9.2** pushed; live is `bcb8026f` (v3.8.100 + deploy.sh cleanup). Check `/health` against `git rev-parse --short HEAD` before saying what is live. Version jumped 3.8.100 → 3.9.0 because the patch number caps at 99.

## Current sprint
Bug-report pass (10-27): QR join codes labelled (3.9.0), bug reports now record hidden board pieces for the blank-board report fb:5618257f (3.9.1), the waiting player's glossary word opens in the panel's own help card instead of the glossary screen (3.9.2, Tom's ask). Six reports closed on Tom's yes (light mode confirmed on his iPhone). The glossary page cutting long words on a phone is the dictionary website's title, not the game.

## Health
- **Tests (v3.9.2):** `npm test` 359 files / 4,456 pass (4 skipped); build OK; `npm audit` 0 (qs 6.17.0). Typecheck: only old test-file errors (`dataGate`, `finalStretch`).
- **Deploy:** `deploy.sh` runs `npm ci` + `npm test` first; Tom deploys himself.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.9.2** and look at the waiting word on a phone.
2. **Dictionary website:** shrink the word title on phones (other project).
3. **Tom's TV:** Sony Bravia / Silk slow buttons (fb:5d7e02d9); design items (bigger pawns fb:fefe42f8, newspaper pop-up, expediter rework) wait for his go.
