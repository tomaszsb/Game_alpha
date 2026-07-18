# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 17, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.8** — committed, **pending deploy** (emitter-ownership refactor + a real bankruptcy/design-fee-cap toast bug fix + the WIN ending now reaches the log/toast/TV for the first time; no urgency, can ride along with the next real change). Live = v3.1.4.

## Current sprint
**2026-07-17 (third session, continued) — domain-event stage 4 (final planned stage).** Moved emitter ownership into the services that decide *what happened* (`ApprovalService`, `FinancialEffectHandler`, `CardService`) instead of leaving callers to re-derive gating logic and message text. `ApprovalService` stays fully stateless — its methods now return `{update, event}` and callers just forward the event, rather than injecting a `stateService` dependency into a previously-pure service. Along the way, fixed a real bug found during research: bankruptcy and design-fee-cap losses were emitting a repurposed `life_event` shape that `ToastWriter` couldn't read, so both game-ending toasts literally said "Received: undefined" instead of the crafted message (never reached players — v3.1.5-8 are all still pending deploy). Also closed the single biggest coverage gap: the WIN ending previously had **zero** announcement outside `EndGameModal` — it now fires a toast, a log entry, and a TV overlay flash like every other ending. Per explicit user sign-off, 4 previously-silent approval moments now reach the permanent game log: examiner approval outcomes + Prof-Cert grants, final-review gate bounces, approval revocations, and the WIN ending. Also promoted 5 already-self-owned CardService log calls (draw, reshuffle, transfer, expire, discard) plus card-replace and the 4 card-effect-target-resolution sites to typed events, and merged `CardPlayed`/`CardActivated` into one event for the common case. Flagged, but explicitly did NOT fix (out of scope, follow-up spawned): a possible double-activate bug in the separate, unrelated `PlayerActionService.playCard()` path used only by the classic (deprecated) card modal. This closes all 4 planned domain-event stages from [docs/design/domain-events.md](../design/domain-events.md); stage 5 (further consolidation) is optional and gated on a demonstrated future need, not scheduled.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2427/2429 passing, 1 skipped, 1 failure** (533s) — the 1 failure is `E2E-AllPaths.test.ts`'s pre-existing documented flake (TODO.md), confirmed non-regression via 2 isolated reruns (a different sub-test failed once, then 10/10 clean). All 5 ghost gates green incl. both 50-game strict runs + the new authored-insertion ghost fixture. +~20 new/updated tests across `ApprovalService`, `CardService`, `FinancialEffectHandler`, `LogWriter`, `ToastWriter`.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.1.4 (confirmed 2026-07-17). v3.1.5–v3.1.8 pending — all behavior changes are additive announcements/bug-fixes, nothing structurally risky.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **`PlayerActionService.playCard()` possible double-activate bug** — found during stage 4 Slice 3 research, not fixed (unrelated to this stage's scope; flagged as a follow-up task). See TODO.md for the repro-check details.
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; embedded browser can't play animated camera transitions, a glance on the maintainer's real TV is the honest final check.
3. **Other actives** — playtester acquisition (screenshot carousel/demo video), dark/light mode coverage beyond `PlayerPanelV2`, dashboard `version`/`gitCommit` display, dead `notificationService` params in 5 services (flagged in TODO.md, small cross-file cleanup).
