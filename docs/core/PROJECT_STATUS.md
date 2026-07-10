# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 10, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.100** — **deployed 2026-07-10** (commit `8929371`, confirmed by maintainer; foreign-game alert fully operational, prod `.env` verified).

## Current sprint
**2026-07-10 — process session, no app change.** Flipped 20 fixed-and-deployed dashboard reports resolved (53→33 open), slimmed TODO.md 306→152 lines with a `/koniec`-enforced size guard, and built the **autonomous fix loop** (`/loop /fixloop`): a token-budget meter paces work to sevenths of the weekly plan quota per day, routing each bug to Sonnet 5 by default, Opus 4.8 for ambiguity, Fable 5 for the hardest reasoning. Calibrated (Monday 7am reset) and ready to launch. Also: session SSH key to unraid installed (passwordless checks; deploys stay manual), `/challenge` verified on the user's iPhone, QR codes printed — the external-playtester funnel is fully unblocked. Detail in CHANGELOG [Ops] 2026-07-10.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean. Full suite not run this session (zero game-source changes); baseline **2340/2341 passing, 1 skipped** (2026-07-09).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.0.100, no drift.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Launch the fix loop** — fresh Sonnet 5 session, auto-accept edits, `/loop /fixloop`; it works the bug backlog inside the day's budget cap.
2. **6x duplicate `subscribeToAutoActions` firing** — every auto-action event fires 6× instead of once; harmless today (idempotent handlers) but root-cause before a non-idempotent one lands.
3. **8 newly-staged dashboard reports** (July 3–5, mostly v3.0.93) in TODO's "Newly arrived" — modal close paths, "rolled" wording in history, seed-money-as-funding question, share button.
