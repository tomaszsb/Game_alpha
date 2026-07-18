# Domain Event Architecture — Design

**Status:** ✅ COMPLETE — all four planned stages shipped 2026-07-17 (CHANGELOG v3.1.5–v3.1.8: stage 1 dead-code cleanup, stage 2 typed `GameEvent` bus replacing `AutoActionEvent`, stage 3 LogWriter/ToastWriter dual-channel collapse, stage 4 emitter-ownership moves). Stage 5 (migrating blanket `stateService.subscribe()` UI consumers) was explicitly optional-on-measured-need and stays covered by TODO's "Notification storm + full-state subscriptions" item. **Archived 2026-07-18.** ARCHITECTURE.md now documents the shipped bus.
**Origin:** 2026-07-14 external review; TODO.md Architecture parking-lot item; design session 2026-07-17 (research findings verified against code that day).
**Relationship to other TODO items:** the "NotificationService.notify + LoggingService.info one-bus" item and the "EffectExecutor unification" item would both sit ON TOP of this — do not scope them separately while this is in flight.

---

## 1. Goal

Turn-flow code currently announces game moments by directly calling each interested system (`loggingService.info(...)` for the permanent log, `notificationService.notify(...)` for toasts, `stateService.emitAutoAction(...)` for modal-driving UI events) — often two or three hand-written, slightly-differently-worded calls for the same moment. Replace this with **named, typed domain events** (TurnStarted, MovementCompleted, ApprovalGranted, PlayerBankrupt, …) that the engine emits once, and that log/toast/UI/networking/analytics each subscribe to independently.

**Why (maintainer motivation, confirmed 2026-07-17):** future-proofing for the D&D-reskin goal. A community reskinning the game should plug in new listeners (different narration, different UI) without editing turn logic. Today, `TurnService` and friends know what a log entry should *say* — presentation bleeding into rules.

## 2. What already exists (verified findings, 2026-07-17)

**The prototype is already in the codebase.** `AutoActionEvent` ([StateService.ts:47](../../src/services/StateService.ts)) defines 8 event types (`dice_conditional_card | seed_money | automatic_funding | life_event | movement | routing_explanation | auto_dice_roll | approval_revoked`), emitted via `emitAutoAction()` and consumed by `GameLayout.tsx:390` (a de facto event router switching on `event.type`) and `TVDisplay.tsx:75`. The redesign is largely "promote this to a first-class typed event bus and route the log/toast calls through it too" — not a parallel new system.

**Weakness of the prototype to fix:** `AutoActionEvent` is one flat interface with ~15 optional fields shared across all 8 types. The new catalog must be a **discriminated union** — each event name with its own required payload — so consumers can't read fields that don't exist for that event.

**Systemic dual-channel duplication:** of ~18 top-level game moments, **9 currently fire from two or three call sites** (one log call + one toast call, sometimes + one emitAutoAction), each with re-derived wording. Full call-site catalog in §4. Collapsing these is the main near-term payoff: log and toast can never again disagree about the same moment.

**The game log is already an event stream, just stringly-typed.** `globalActionLog` is populated exclusively by `loggingService.info/warn/error` calls carrying an `action:` string (`'dice_roll'`, `'card_play'`, `'turn_start'`, …). `GameLog.tsx` and `PlayerChronicleV2.tsx` re-read it on every state change. Formalizing event names largely means typing these existing strings.

**`subscribeWithSelector` cautionary tale:** StateService implements a full selective-subscription API — **zero real callers** (only its own doc-comment examples). A narrower-subscription mechanism was built once and never adopted. Lesson: the event bus must be adopted at emission time (the engine fires events as its only announcement path), not offered as an optional nicer API consumers are supposed to migrate to voluntarily. Stage 3 therefore *removes* the old calls rather than deprecating them.

**Ownership is inverted in places:** `ApprovalService` is pure decision logic and announces nothing — its callers (`DiceRollProcessor`, `EffectEngineService`) announce for it, scattered across two files. Bankruptcy lives in `FinancialEffectHandler.checkBankruptcy` (:379), not CardService. Stage 4 fixes emitter ownership.

**Known asymmetry to decide on:** completed/failed movement goes through `emitAutoAction` only — it never reaches the permanent game log, unlike every other moment type. (Open question §6.1.)

**Dead code found during research:** `TurnService.takeTurn()` has zero callers and duplicates the dice-announcement logic of `rollDiceAndProcessEffects()`. Delete in Stage 1, don't migrate.

## 3. Target design

- **`GameEvent`** — a discriminated union type: `{ type: 'TurnStarted', turn: number, playerId: … } | { type: 'MovementCompleted', playerId, fromSpace, toSpace, … } | …`. Payloads carry **facts** (ids, amounts, space names), not prose. Prose is composed by consumers (log writer, toast writer, TTS narrator) — this is the reskin seam.
- **`GameEventBus`** — synchronous, ordered dispatch (deterministic; listeners run in subscribe order; a listener throwing must not break the turn — catch, log, continue). Emit-after-commit: events announce facts about state that has already been applied, never intents. Emitters get no return values from listeners — the engine must not depend on who's listening.
- **Consumers (initial set):**
  - **LogWriter** — subscribes to committed events, writes `globalActionLog` entries (replaces hand-written `loggingService.info` calls in turn flow).
  - **ToastWriter** — subscribes, calls `notificationService.notify` (replaces hand-written notify calls).
  - **GameLayout / TVDisplay modal router** — today's `subscribeToAutoActions` consumers, migrated to the new bus.
- **Turn-transaction semantics (important):** the logging system already has explore/commit/discard sessions (`startNewExplorationSession` / `commitCurrentSession` / `discardCurrentSession`, TurnService.ts:613–642) because Try Again rolls a turn back. The bus must respect the same boundary. Proposed: events dispatch **immediately** to *live* consumers (toasts, modals — players should see what's happening even if later discarded) but the LogWriter buffers within the turn transaction and commits/discards with it. `TurnDiscarded` fires as its own event so live consumers can react (e.g. clear stale toasts). This mirrors exactly what TEMP/REAL + logging sessions do today — the bus formalizes it, it does not invent new semantics.

## 4. Event catalog (grounded in call-site research, 2026-07-17)

🔁 = currently announced from 2–3 call sites for one logical moment.

| Event | Trigger | Current call sites to replace |
|---|---|---|
| TurnStarted | turn officially begins | TurnService.ts:671 |
| TurnCommitted 🔁 | turn finished, handing off | TurnTransitionHandler.ts:99 (log) + :270 (notify) |
| TurnSkipped | turn auto-skipped by modifier card | TurnTransitionHandler.ts:225 |
| TurnDiscarded / TryAgainUsed 🔁 | Try Again used, turn rolled back, time penalty | TurnService.ts:931 (log) + :996 (notify) |
| DiceRolled 🔁 | die rolled, outcome known | TurnService.ts:334; SpaceArrivalProcessor.ts:113 (TurnService.ts:261 is in dead `takeTurn()` — delete) |
| AutoRollResolved | system auto-rolled at REGULATORY examiner space | TurnService.ts:738 (emitAutoAction `auto_dice_roll`) |
| RerollUsed | E066 re-roll ability used | TurnService.ts:1039 |
| MovementCompleted / MovementFailed 🔁 | player finished moving / stuck | MovementExecutor.ts:77, :132, :164 (success), :92, :180 (failure) — all emitAutoAction only, never logged (§6.1) |
| RoutedBackToReview 🔁 | outcome bounced player back to exam/review | DiceRollProcessor.ts:521, :587, :629 — three near-duplicate notifies |
| ApprovalOutcomeDetermined | examiner roll / Prof-Cert resolved | DiceRollProcessor.ts:476–496, :570–582 (currently surfaces only via returned `TurnEffectResult.approvalOutcome`) |
| ApprovalRevoked | approval pulled (scope change / card / audit) | EffectEngineService.ts:284, :1212 (emitAutoAction) |
| ManualActionCompleted 🔁 | manual action button resolved | ManualActionProcessor.ts:352 (log) + :361 (notify) |
| FundingReceived 🔁 | owner seed money auto-applied on arrival | ManualActionProcessor.ts:489 (notify) + :556 (emitAutoAction) |
| LifeEventTriggered 🔁 | L-card / dice-conditional card auto-drew on arrival | SpaceArrivalProcessor.ts:314 (emitAutoAction) + :318 (notify) |
| RecurringCardEffectApplied 🔁 | duration card re-fired on a later turn | EffectEngineService.ts:1508 (notify) + :1523 (log) |
| PlayerPlaced | initial placement at game start | TurnService.ts:1081 |
| EndGamePenaltyApplied | FINISH without DOB sign-off penalty | TurnService.ts:463 |
| QuickStartHandDistributed | Quick Start hand copied to all players | TurnTransitionHandler.ts:180 |
| PlayerBankrupt | money went negative on mandatory charge | FinancialEffectHandler.ts:379 |
| GameEnded (DesignFeeCapExceeded variant) | design fees exceeded 20% cap → game over | FinancialEffectHandler.ts:301 |

**Card lifecycle** (all single-channel `loggingService.info` in CardService.ts): CardDrawn :131, DeckReshuffled :180, CardReplaced :452, CardPlayed :618, CardActivated :739, CardTransferred :805, CardExpired :901, CardDiscarded :2043, CardEffectTargetResolved :2096/:2162/:2188/:2249. Note: CardPlayed + CardActivated fire as two log entries for what a player experiences as one action (§6.2).

## 5. Staged plan (agreed 2026-07-17)

Each stage ships independently with full-suite + typecheck + build green; live click-through for stages touching UI-visible flows.

1. **Cleanup** (~zero risk, can piggyback on any session): delete dead `TurnService.takeTurn()`.
2. **Name the events:** define the `GameEvent` discriminated union + `GameEventBus`; migrate the existing `AutoActionEvent` emitters/consumers (GameLayout, TVDisplay) onto it. Behavior-identical — the 8 existing auto-action types become properly-typed events; old `emitAutoAction` path removed.
3. **Collapse the duplicates:** migrate the 9 🔁 moments to single emissions consumed by LogWriter + ToastWriter. This is where the near-term payoff lives. Includes implementing the turn-transaction buffering (§3) so LogWriter honors Try Again exactly as logging sessions do today.
4. **Move ownership:** ApprovalService emits its own Approval* events; FinancialEffectHandler emits PlayerBankrupt/GameEnded; card lifecycle events emitted from CardService methods. Callers stop announcing on behalf of callees.
5. **(Optional, later, only on demonstrated need):** migrate blanket `stateService.subscribe()` UI consumers (PlayerPanelV2, ScoreboardV2 force-rerender on every change) to specific events. Do NOT do this for churn's sake — the subscribeWithSelector lesson says unforced consumer migrations don't stick; only do it against a measured render-cost problem.

Sizing honestly: stages 2–4 are each roughly a session in the spirit of the TurnService/PlayerSetup splits (plan → extract → verify per step). Not a Tuesday-afternoon item; also not a rewrite-the-world — the state layer, EffectEngine internals, and CSV data pipeline are untouched.

## 6. Open design decisions (resolve at implementation time, not silently)

1. **Should MovementCompleted feed the permanent log?** Today movement never reaches `globalActionLog` (only live UI). Recommendation: yes, log it — the Chronicle/history story is incomplete without moves — but confirm with maintainer since it changes what players see in the log.
2. **Merge CardPlayed + CardActivated?** Two log entries for one player action. Probably one event with an `activated: boolean` fact; decide when touching CardService in Stage 4.
3. **Networking/analytics consumers** are motivating but out of scope; the only requirement now is that event payloads be serializable (plain data, no service references) so a future WebSocket relay can forward them verbatim.
4. **Where prose lives after Stage 3:** LogWriter/ToastWriter need per-event message templates. Keep them in code initially; a future CSV/data-driven narration table is the reskin end-state but is NOT part of this project (belongs to the engine-data separation workstream).

## 7. Do-not rules

- Do not build the bus as an optional parallel path — every migrated emitter's old direct calls are deleted in the same commit (subscribeWithSelector lesson).
- Do not let listeners return values into the engine or mutate state synchronously from a handler.
- Do not start Stage 3 without the turn-transaction buffering design settled — a LogWriter that ignores Try Again would corrupt the permanent log.
- Do not bundle the notification-bus or EffectExecutor TODO items into these stages; re-scope them after Stage 4 lands.
