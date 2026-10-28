# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** October 27, 2026 (v3.9.5 committed + pushed, NOT deployed)
**Current Phase:** Beta — live in production
**Current Version:** **v3.9.5** pushed; live is v3.9.2 (`8161b8b4`). Check `/health` against `git rev-parse --short HEAD` before saying what is live.

## Current sprint
Bug-report pass 2 (10-27): Tom closed 10 reports (16 open now). Players are big pawns in their colour (3.9.3), body C (3.9.4). The game draws glossary entries itself instead of framing the dictionary site, so long words fit on phones and every word shows a meaning (3.9.5).

## Health
- **Tests (v3.9.5):** `npm test` 344 files / 4,401 pass (one Windows file-lock flake in `instanceResolver.test.ts`, passes on rerun); build OK. Typecheck: only old test-file errors (`dataGate`, `finalStretch`).
- **Deploy:** `deploy.sh` runs `npm ci` + `npm test` first; Tom deploys himself.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.9.5**, look at the pawns on PC and TV and a glossary word on a phone.
2. **Town layout half of fb:fefe42f8:** shared buildings in the middle, player areas on the outskirts, owner/office in player colour (design, Tom's go).
3. **Tom's TV:** Sony Bravia / Silk slow buttons (fb:5d7e02d9); TV player area too big (fb:7fbea636).
