# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 30, 2026 (v3.9.12 committed + pushed, NOT deployed)
**Current Phase:** Beta — live in production
**Current Version:** **v3.9.12** pushed; live is v3.9.11 (`/health` `f18d07cd`). Check `/health` against `git rev-parse --short HEAD` before saying what is live.

## Current sprint
TV and round-town polish from Tom's first real TV test: a visible move-choice glow, a lighter table turn, a "turn" banner, the waiting word filling the phone, the shared menu (3.9.10), and an honest iPhone promise plus a sturdier turn chime (3.9.11). 3.9.12 is one wording cell (W053 "NFPA 13"). Alongside, a scope-drawings MOCK-UP (a blueprint sheet per kind of work, opened by a "Drawing" button on a scope line) sits in `.tmp/scope-mockup/`; nothing is built until Tom reacts to it.

## Health
- **Tests (v3.9.12):** `npm test` 351 files / 4,451 pass; build OK. Typecheck: only the 9 old test-file errors (`dataGate`, `finalStretch`). `test:ghost`: 16 files passed / 4 skipped (60 tests).
- **Deploy:** `deploy.sh` runs `npm ci` + `npm test` first; Tom deploys himself.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy, then play one round-town game on the real Hisense TV** and read `PLAYTEST_TV_TURN` / `PLAYTEST_TV_KEYS` from `GET /api/logs`; the iPhone chime has not been heard on a real iPhone.
2. **Tom's reaction to the scope-drawings mock-up** before any sheet is built (about 3-4% of a week for the 13 common kinds).
3. **Stage 2** (talk bubbles, panel split, glossary viewer) waits for the TV test.
