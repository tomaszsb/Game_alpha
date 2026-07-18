// src/types/GameEvents.ts
// Domain-event stage 2 (docs/design/domain-events.md). Promotes the former
// flat `AutoActionEvent` (StateService.ts) to a discriminated union: each of
// the 8 existing auto-action types keeps its exact wire shape (verified
// against every emitter call site), but now only exposes the fields that
// type actually carries instead of ~15 optional fields shared by all 8.
import { TurnEffectResult } from './StateTypes';
import { ApprovalStatus } from './DataTypes';

// Player-facing receipt of a single thing an L-card just did. Computed by
// diffing player state before/after applyCardEffects, then surfaced to the
// LifeEventModal as an "Effects applied" block. Voice rule: copy is rendered
// by the modal in PM voice, so these labels stay value-only (e.g. "+$5,000",
// "DOB approval revoked", "lost 2 cards"). v3.0.40 — playtest signal: Kids
// A–E worked but were invisible to the player.
export interface LifeEventEffectSummary {
  kind: 'money' | 'time' | 'approval_revoke' | 'card_gained' | 'card_lost' | 'duration_start' | 'competing_reveal' | 'leader_reveal';
  /** Signed numeric delta for money/time, or count for cards/turns. */
  amount?: number;
  /** Display label rendered next to the icon (PM voice — see LifeEventModal). */
  label: string;
}

export interface DiceConditionalCardEvent {
  type: 'dice_conditional_card';
  playerId: string;
  playerName: string;
  spaceName: string;
  message: string;
  diceValue?: number;
  requiredRoll?: number;
  cardType?: string;
  cardName?: string;
  cardId?: string;
  success?: boolean;
}

export interface LifeEventEvent {
  type: 'life_event';
  playerId: string;
  playerName: string;
  playerColor?: string;
  spaceName: string;
  message: string;
  success?: boolean;
  // Card-draw shape (CardEffectHandler / SpaceArrivalProcessor).
  diceValue?: number;
  requiredRoll?: number;
  cardType?: string;
  cardName?: string;
  cardId?: string;
  // v3.0.40: ordered list of receipts for an auto-applied life event card.
  // Only populated for card-draw emissions — the game-over/bankruptcy
  // emissions below (FinancialEffectHandler) leave this and cardId unset;
  // GameLayout's modal gate (`event.cardId`) relies on that to skip them,
  // while TVDisplay's overlay still shows their `message` either way.
  effectsSummary?: LifeEventEffectSummary[];
}

export interface SeedMoneyEvent {
  type: 'seed_money';
  playerId: string;
  playerName: string;
  spaceName: string;
  message: string;
  cardType?: string;
  cardName?: string;
  cardId?: string;
  success?: boolean;
  moneyAmount?: number;
  /** Alternative to moneyAmount — EffectEngineService's owner-investment emission uses this field instead. */
  amount?: number;
  /**
   * v3.0.99 — full result for owner funding granted directly via
   * TurnService.handleAutomaticFunding (not via a drawn card). Fires from
   * inside startTurn on every turn transition, including the internal
   * endTurn → startTurn path with no React caller to capture a return
   * value — this event is the only way it reaches the UI. GameLayout
   * enqueues it straight into diceResultQueue so the player sees the same
   * rich modal a manually-triggered roll gets.
   */
  turnEffectResult?: TurnEffectResult;
}

export interface AutomaticFundingEvent {
  type: 'automatic_funding';
  playerId: string;
  playerName: string;
  spaceName: string;
  message: string;
  cardType?: string;
  cardName?: string;
  cardId?: string;
  success?: boolean;
  moneyAmount?: number;
}

export interface MovementEvent {
  type: 'movement';
  playerId: string;
  playerName: string;
  playerColor?: string;
  spaceName: string;
  fromSpace?: string;
  toSpace?: string;
  success: boolean;
  message: string;
}

export interface RoutingExplanationEvent {
  type: 'routing_explanation';
  playerId: string;
  playerName: string;
  playerColor?: string;
  spaceName: string;
  fromSpace?: string;
  toSpace: string;
  message: string;
  success?: boolean;
}

export interface AutoDiceRollEvent {
  type: 'auto_dice_roll';
  playerId: string;
  playerName: string;
  spaceName: string;
  message: string;
  diceValue?: number;
  /**
   * v3.0.99 — full result for the REGULATORY-phase auto-roll in
   * TurnService.startTurn (DOB/FDNY plan exam, "the examiner decides").
   * Same fire-from-inside-startTurn reasoning as SeedMoneyEvent above.
   */
  turnEffectResult?: TurnEffectResult;
}

export interface ApprovalRevokedEvent {
  type: 'approval_revoked';
  playerId: string;
  playerName: string;
  spaceName: string;
  message: string;
  cardName?: string;
}

// --- Domain-event stage 3 (docs/design/domain-events.md) ---
// Collapses 9 moments that used to fire from 2-3 separate hand-written
// loggingService.info/notificationService.notify call sites into one
// emission each, consumed by LogWriter/ToastWriter (src/services/).

export interface TurnCommittedEvent {
  type: 'turn_committed';
  playerId: string;
  playerName: string;
  turn: number;
  spaceName: string;
}

export interface TurnDiscardedEvent {
  type: 'turn_discarded';
  playerId: string;
  playerName: string;
  spaceName: string;
  timePenalty: number;
  tryAgainCount: number;
}

export interface DiceRolledEvent {
  type: 'dice_rolled';
  playerId: string;
  playerName: string;
  spaceName: string;
  diceValue: number;
  /** manual = "Roll Dice" button; arrival = space-arrival condition-eval piggyback. */
  trigger: 'manual' | 'arrival';
  /** Pre-composed by the emitter so LogWriter doesn't need a dataService dependency. */
  logMessage: string;
}

export interface RoutedBackToReviewEvent {
  // A distinct discriminant from 'routing_explanation' on purpose — that type
  // already drives the "why am I here" modal (GameLayout's pendingRouting);
  // these three toast-only sites must not also trigger that modal.
  type: 'routed_back_to_review';
  playerId: string;
  playerName: string;
  spaceName: string;
  toSpace: string;
  toSpaceTitle: string;
  reason: string;
  kind: 'gate_bounce' | 'single_destination' | 'chosen_destination';
}

export interface ManualActionCompletedEvent {
  type: 'manual_action_completed';
  playerId: string;
  playerName: string;
  effectType: string;
  summary: string;
}

export interface RecurringCardEffectAppliedEvent {
  type: 'recurring_card_effect_applied';
  playerId: string;
  playerName: string;
  sourceCardId: string;
  cardName: string;
  moneyDelta: number;
  timeDelta: number;
  turnsLeftAfterThis: number;
  /** Shared verbatim by today's log AND notify — genuinely one fact, not two prose variants. */
  headline: string;
  delta: string;
  tail: string;
}

// --- Domain-event stage 4 (docs/design/domain-events.md) ---
// Moves emitter ownership: ApprovalService/FinancialEffectHandler/CardService
// now own deciding whether/what to announce, instead of a caller re-deriving
// that logic on the callee's behalf.

export interface ApprovalOutcomeDeterminedEvent {
  type: 'approval_outcome_determined';
  playerId: string;
  playerName: string;
  spaceName: string;
  approval: 'dob' | 'fdny';
  kind: ApprovalStatus;
  source: 'examiner_roll' | 'prof_cert_self_certify';
  /** narrateOutcome()'s text, or the Prof-Cert grant text — never re-derived by the caller. */
  message: string;
}

// ONE type with a reason discriminant for all 3 stateService.endGame() call
// sites (win/bankruptcy/design_fee_cap) — they funnel to the same consumer
// (EndGameModal) and are one logical moment ("game over, here's why") with
// 3 flavors, not 3 unrelated moments.
export interface GameEndedEvent {
  type: 'game_ended';
  reason: 'win' | 'bankruptcy' | 'design_fee_cap';
  playerId: string;
  playerName: string;
  spaceName: string;
  message: string;
}

// --- Card lifecycle (CardService) ---

export interface CardDrawnEvent {
  type: 'card_drawn';
  playerId: string;
  cardType: string;
  count: number;
  cards: string[];
  source: string;
  message: string;
}

export interface DeckReshuffledEvent {
  type: 'deck_reshuffled';
  playerId: string;
  cardType: string;
  message: string;
}

export interface CardReplacedEvent {
  type: 'card_replaced';
  playerId: string;
  oldCardId: string;
  newCardId: string | null;
  newCardType: string;
  message: string;
}

export interface CardPlayedEvent {
  type: 'card_played';
  playerId: string;
  cardId: string;
  cardName: string;
  /** True when this same play also activated the card (duration_count > 0). */
  activated: boolean;
  durationTurns?: number;
}

export interface CardActivatedEvent {
  type: 'card_activated';
  playerId: string;
  cardId: string;
  cardName?: string;
  durationTurns: number;
}

export interface CardTransferredEvent {
  type: 'card_transferred';
  sourcePlayerId: string;
  targetPlayerId: string;
  cardId: string;
  cardName?: string;
  message: string;
}

export interface CardExpiredEvent {
  type: 'card_expired';
  playerId: string;
  cardId: string;
  cardName?: string;
  message: string;
}

export interface CardDiscardedEvent {
  type: 'card_discarded';
  playerId: string;
  cardIds: string[];
  message: string;
}

// Shared type for 2 distinct mechanics (Return-to-Sender / Favor-Called-In) —
// same consumer, same resolved/no-target shape, a `mechanic` discriminant
// is enough to keep them distinguishable.
export interface CardEffectTargetResolvedEvent {
  type: 'card_effect_target_resolved';
  playerId: string;
  mechanic: 'return_to_sender' | 'favor_called_in';
  resolved: boolean;
  targetPlayerName?: string;
  cardName?: string;
  message: string;
}

export type GameEvent =
  | DiceConditionalCardEvent
  | LifeEventEvent
  | SeedMoneyEvent
  | AutomaticFundingEvent
  | MovementEvent
  | RoutingExplanationEvent
  | AutoDiceRollEvent
  | ApprovalRevokedEvent
  | TurnCommittedEvent
  | TurnDiscardedEvent
  | DiceRolledEvent
  | RoutedBackToReviewEvent
  | ManualActionCompletedEvent
  | RecurringCardEffectAppliedEvent
  | ApprovalOutcomeDeterminedEvent
  | GameEndedEvent
  | CardDrawnEvent
  | DeckReshuffledEvent
  | CardReplacedEvent
  | CardPlayedEvent
  | CardActivatedEvent
  | CardTransferredEvent
  | CardExpiredEvent
  | CardDiscardedEvent
  | CardEffectTargetResolvedEvent;
