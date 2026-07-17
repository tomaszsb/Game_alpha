# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 17, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.7** — committed, **pending deploy** (log/toast plumbing refactor + one genuinely new log entry for failed moves; no urgency, can ride along with the next real change). Live = v3.1.4.

## Current sprint
**2026-07-17 (third session, continued) — domain-event stage 3.** Collapsed the 9 moments that used to announce twice (hand-written log call + hand-written toast call) into one `GameEvent` emission each, consumed by two new bus subscribers: `LogWriter` (`src/services/LogWriter.ts`) and `ToastWriter` (`src/services/ToastWriter.ts`). No new turn-transaction buffering needed — `LoggingService`'s existing exploration-session mechanism already handles Try Again correctly for any `info()` call, including these. Caught and corrected two of the design doc's own assumptions during implementation: a completed move was already logged via a different code path (only the failure case was a genuine gap — logging success too would have duplicated every move), and one of `RoutedBackToReview`'s three branches had distinct wording the first pass missed (caught by a new unit test, not review). Also discovered mid-migration that ~14 hand-rolled E2E/regression test bootstraps needed the same `LogWriter` wiring `ServiceProvider.tsx` got, or a migrated event fires into the void there — found via 2 real full-suite failures, then proactively fixed the rest rather than discovering them one 10-minute run at a time. See [docs/design/domain-events.md](../design/domain-events.md) for the full plan; stage 4 (move emitter ownership into ApprovalService/FinancialEffectHandler/CardService) is next.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2405/2406 passing, 1 skipped, 0 failures** (612s). All 5 ghost gates green incl. both 50-game strict runs. +26 new tests (`LogWriter.test.ts`/`ToastWriter.test.ts`, one case per event type).
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.1.4 (confirmed 2026-07-17). v3.1.5–v3.1.7 pending — v3.1.5/v3.1.6 are behavior-inert/-identical, v3.1.7 adds one small new log entry (failed movement) but nothing else player-visible.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Domain-event stage 4** — move emitter ownership into ApprovalService/FinancialEffectHandler/CardService (currently their callers announce on their behalf). Execute against [docs/design/domain-events.md](../design/domain-events.md).
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; embedded browser can't play animated camera transitions, a glance on the maintainer's real TV is the honest final check.
3. **Other actives** — playtester acquisition (screenshot carousel/demo video), dark/light mode coverage beyond `PlayerPanelV2`, dashboard `version`/`gitCommit` display, dead `notificationService` params in 5 services (flagged in TODO.md, small cross-file cleanup).
