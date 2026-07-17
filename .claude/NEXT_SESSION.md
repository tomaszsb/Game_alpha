# Next session starter — written 2026-07-17 by /koniec

## State at handoff
- **Version:** v3.1.5 committed, **pending deploy — but inert** (design doc + dead-code deletion, zero behavior change; no urgency, deploy whenever the next real change ships). Live = v3.1.4.
- **Branch:** master, clean (only pre-existing `.claude/settings.local.json` uncommitted).
- **Last shipped:** domain event architecture **design pass** — the full design is committed at `docs/design/domain-events.md` (event catalog from a verified call-site audit, 5-stage plan, open questions, do-not rules). Stage 1 executed same-session: dead `TurnService.takeTurn()` + orphaned `TurnResult` type deleted (grep-confirmed zero callers; typecheck/build/targeted tests 70/70).
- **Test suite:** **2378/2380 passing, 1 skipped, 1 failure — confirmed non-regression** (758s). The failure is the pre-existing `E2E-AllPaths.test.ts` intermittent timeout under full-suite load (TODO parking lot since 2026-07-13; different random sub-test each run, passes in isolation). All 5 ghost gates green incl. both 50-game strict runs — cleaner than the prior session's run (4 flakes then).
- **Build/typecheck:** clean.
- **Dashboard:** not swept (design session, no fb reports involved).

## Top 3 open items
1. **Domain-event stage 2** — define the typed `GameEvent` discriminated union + `GameEventBus`, migrate the existing `AutoActionEvent` traffic (emitters + GameLayout/TVDisplay consumers) onto it, delete `emitAutoAction`. Execute against `docs/design/domain-events.md` — the design decisions are made; don't re-litigate, but stop and flag if the doc missed something.
2. **Real-TV confirmation of the v3.1.2 camera fix** — still outstanding from three sessions ago; 2-minute glance on the real TV (zoom should stay put between moves).
3. **Domain-event stage 3 waits for stage 2** — the dual-channel collapse (LogWriter/ToastWriter + turn-transaction buffering). Doc's do-not rule: don't start stage 3 without the buffering design settled. Optionally Opus for this one stage (agreed 2026-07-17); Sonnet everywhere else.

## Decisions waiting on the user
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.
- **Homeowner starting scenario** — direction decided, needs a design pass on the mechanic itself.
- **(For stage 3, not before)** — should `MovementCompleted` feed the permanent game log? Today movement never reaches it; the doc recommends yes but flags it as a player-visible change to confirm.

## Suggested first move
Stage 2 of the domain-event plan is the natural pickup — a scoped, one-session refactor with its design already written. Or open with the 2-minute real-TV camera check to finally close item 2.

## Suggested model for next session
**Sonnet 5** — stage 2 is execute-against-a-written-design work, the same shape as the TurnService/PlayerSetup splits. (Stage 3, later, optionally Opus per the 2026-07-17 discussion.)

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The design doc's do-not rules are load-bearing — especially "old announcement calls get deleted in the same commit that replaces them" (the subscribeWithSelector lesson: an optional parallel path never gets adopted).
