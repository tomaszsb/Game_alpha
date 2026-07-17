# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 17, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.1.5** — committed, **pending deploy** (behavior-inert: design doc + dead-code deletion; no urgency, can ride along with the next real change). Live = v3.1.4.

## Current sprint
**2026-07-17 (second session) — domain event architecture design pass + stage 1.** The "needs a real design pass before any engineering" parking-lot item got its dedicated session. Output: [docs/design/domain-events.md](../design/domain-events.md) — event catalog grounded in a verified audit of every announcement call site, 5-stage implementation plan, open questions, do-not rules. Key finding: `AutoActionEvent`/`emitAutoAction` is already the prototype (promotion, not invention), and 9 of ~18 game moments are announced twice today (hand-written log + toast). Stage 1 executed same-session: dead `TurnService.takeTurn()` + orphaned `TurnResult` deleted (zero callers, verified). Stages 2–4 are each ≈ one Sonnet session executing against the doc.

## Health
- **Tests:** typecheck ✅ clean, build ✅ clean, full suite **2378/2380 passing, 1 skipped, 1 failure — confirmed non-regression** (758s; the known pre-existing `E2E-AllPaths.test.ts` intermittent timeout under load, TODO parking lot since 2026-07-13). All 5 ghost gates green.
- **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** live = v3.1.4 (confirmed 2026-07-17). v3.1.5 pending, inert — no player-visible change.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Domain-event stage 2** — typed `GameEvent` union + bus, migrate existing `AutoActionEvent` traffic; execute against [docs/design/domain-events.md](../design/domain-events.md).
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding; embedded browser can't play animated camera transitions, a glance on the maintainer's real TV is the honest final check.
3. **Other actives** — playtester acquisition (screenshot carousel/demo video), dark/light mode coverage beyond `PlayerPanelV2`, dashboard `version`/`gitCommit` display.
