# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 17, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.6** — committed, **pending deploy** (behavior-identical refactor; no urgency, can ride along with the next real change). Live = v3.1.4.

## Current sprint
**2026-07-17 (third session) — domain-event stage 2.** Promoted the flat `AutoActionEvent` prototype (StateService.ts) to a typed discriminated union (`src/types/GameEvents.ts`, 8 variants) dispatched through a new `GameEventBus` class (`src/services/GameEventBus.ts`). All 15 emitter call sites and both consumers (GameLayout's modal router, TVDisplay's dramatic overlay) migrated in the same commit — no parallel old+new path, per the design doc's do-not rule. Behavior-identical by design; see [docs/design/domain-events.md](../design/domain-events.md) for the full plan. Stage 3 (collapse the 9 dual-channel log+toast duplicates) is next.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2379/2380 passing, 1 skipped, 0 failures** (608s — cleaner than the prior session's 1-failure baseline). All 5 ghost gates green incl. both 50-game strict runs.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.1.4 (confirmed 2026-07-17). v3.1.5 + v3.1.6 pending, both behavior-inert/-identical — no player-visible change yet.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Domain-event stage 3** — collapse the 9 moments currently announced twice (hand-written log call + hand-written toast call) via LogWriter/ToastWriter subscribers; needs turn-transaction buffering so Try Again still discards log entries. Execute against [docs/design/domain-events.md](../design/domain-events.md).
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; embedded browser can't play animated camera transitions, a glance on the maintainer's real TV is the honest final check.
3. **Other actives** — playtester acquisition (screenshot carousel/demo video), dark/light mode coverage beyond `PlayerPanelV2`, dashboard `version`/`gitCommit` display.
