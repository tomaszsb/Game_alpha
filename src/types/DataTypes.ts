import type { Effect } from './EffectTypes';

export interface GameConfig {
  space_name: string;
  phase: string;
  path_type: string;
  is_starting_space: boolean;
  is_ending_space: boolean;
  min_players: number;
  max_players: number;
  requires_dice_roll: boolean;
  // Workstream 6 #5+#6: resume-mechanic flags (Spaces.csv columns)
  is_resume_hub?: boolean;
  is_point_of_no_return?: boolean;
  // Workstream 6 #2: minimum W cards required to leave this space (0 = no guard)
  min_w_cards_to_leave?: number;
  // Workstream 6 #7: design fee mechanic flags
  fee_calculation_method?: 'flat' | 'percentage_of_scope';
  fee_label?: string;
  // Workstream 6 #3: setup-phase auto-handling flags
  auto_apply_funding?: boolean;
  auto_trigger_card_types?: string[];  // parsed from comma-separated CSV column
  // 2026-05-18 audit: funding-source data flag (replaces hardcoded checks in
  // CardEffectHandler/CardEffectService/NotificationUtils). Empty/undefined
  // for non-funding spaces.
  funding_source?: 'owner' | 'bank' | 'investor' | '';
  // Workstream 6 #4: path-choice memory flags
  path_choice_memory_key?: string;       // opaque slot name; spaces share when they share a choice
  is_path_choice_lock_point?: boolean;   // First-visit destination is stored under path_choice_memory_key
  // Workstream 6 Phase 6.3: cosmetic per-space overrides (empty = use legacy code fallback)
  display_label_override?: string;       // short display name for board UI (was hardcoded SPECIAL_NAMES)
  review_loop_message?: string;          // explanation when dice sends player back here (was hardcoded reviewLoopMessages)
  // Workstream 3: coordinate-driven board (Living Map). Pixels in board
  // coordinate space. Seeded by scripts/seed-board-positions.mjs;
  // educators can drag tiles in the Data Editor to update.
  pos_x?: number;
  pos_y?: number;
  // 2026-06-02: Workstream 7 Phase 7.4 — Stage-1 approval gate. When true,
  // MovementService.getValidMoves runs ApprovalService.checkFinalReviewGate at
  // this space and collapses valid moves to [routeTo] when approvals are missing.
  // Replaces hardcoded `=== DOB_FINAL_REVIEW_SPACE` in MovementService.
  has_final_review_gate?: boolean;
  // 2026-07-16: CSV-portability lift. Flags which space plays the DOB/FDNY
  // exam or audit role in ApprovalService's approval-gate logic. Empty for
  // every space except the three that carry it. Replaces hardcoded
  // `=== DOB_EXAM_SPACE` / `FDNY_EXAM_SPACE` / `DOB_AUDIT_SPACE` literal
  // comparisons — a reskin CSV can move these roles to differently-named
  // spaces via ApprovalService.configureApprovalSpaces() without code changes.
  approval_role?: 'dob_exam' | 'fdny_exam' | 'dob_audit' | '';
  // 2026-07-16: CSV-portability lift. Assigns which NPC "speaks" at this space —
  // either a CHARACTER_MAP key (src/constants/characters.ts) or the 'PM'
  // sentinel (PM-voiced, no NPC). Empty for spaces that rely on the legacy
  // space-name-prefix heuristic (the default for the stock DOB-permitting
  // game). Replaces hardcoded space-name entries in characters.ts's
  // PM_VOICED_SPACES / extractPrefix.
  npc_speaker?: string;
  action?: string;  // Dynamic action keywords like 'GOTO_JAIL', 'PAY_TAX', 'AUCTION'
  game_phase?: string;
  space_order?: number;
  tutorial_step?: number;
}

/**
 * Workstream 6 #4: cross-space path-choice exclusion rule.
 * Loaded from PATH_CHOICE_RULES.csv. When a player is at `affected_space`,
 * if their `pathChoiceMemory[memory_key]` equals `chosen_value`, then
 * `excluded_destination` is removed from their available choices.
 *
 * Replaces the hardcoded REG-FDNY-PLAN-EXAM cross-space filter in MovementService.
 */
export interface PathChoiceRule {
  affected_space: string;
  memory_key: string;
  chosen_value: string;
  excluded_destination: string;
}

/**
 * 2026-07-16: CSV-portability lift. Player-facing display name for a card
 * type letter (W/B/E/L/I), loaded from CARD_TYPES.csv. Optional — a missing
 * file leaves this empty and cardTypeNames.ts falls back to its hardcoded
 * theme.ts defaults (today's DOB-permitting labels). Colors/emoji stay in
 * theme.ts; only the text label moves to CSV, since that's the part that
 * names the mechanic in real-world jargon a reskin needs to replace.
 */
export interface CardTypeLabel {
  card_type: string;
  label: string;
}

/**
 * 2026-08-09: CSV-portability lift, reskin item 4. One row of
 * CHARACTERS.csv — the raw-string shape as parsed off disk, mirroring
 * `CharacterInfo` (src/constants/characters.ts) plus the `id` map key.
 * `image_roles` is a comma-separated list of NpcImageRole values (empty for
 * no portrait art, matching BANK/LEND/INVESTOR today). Optional file — a
 * missing/malformed CHARACTERS.csv leaves this empty and characters.ts's
 * `configureCharacterMap` falls back to its built-in 9-NPC roster. This is
 * what lets a reskin CSV add a brand-new NPC (e.g. "Dungeon Master") without
 * a code edit.
 */
export interface CharacterCsvRow {
  id: string;
  emoji: string;
  name: string;
  phase: string;
  color: string;
  image_roles: string;
  short_label: string;
}

export interface Movement {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  movement_type: 'fixed' | 'choice' | 'dice' | 'dice_outcome' | 'logic' | 'none';
  destination_1?: string;
  destination_2?: string;
  destination_3?: string;
  destination_4?: string;
  destination_5?: string;
  condition_1?: string;
  condition_2?: string;
  condition_3?: string;
  condition_4?: string;
  condition_5?: string;
}

export interface DiceOutcome {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  roll_1?: string;
  roll_2?: string;
  roll_3?: string;
  roll_4?: string;
  roll_5?: string;
  roll_6?: string;
}

/**
 * One question in a logic-tree space's yes/no decision chain.
 * Loaded from CLEAN_FILES/LOGIC_QUESTIONS.csv and keyed by
 * (space_name, visit_type, question_id).
 *
 * A target (yes_target or no_target) can be:
 *   - another question_id on the same space (e.g. "Q2") — chain continues
 *   - a valid space_name (e.g. "PM-DECISION-CHECK") — chain resolves to a move
 *   - a comma-separated list of space_names (e.g. "PM-DECISION-CHECK,CON-INITIATION")
 *     — chain ends in a sub-choice modal letting the player pick the destination
 *
 * Entry point per (space, visitType) is always the row with question_id === 'Q1'.
 */
export interface LogicQuestion {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  question_id: string;
  question_text: string;
  yes_target: string;
  no_target: string;
  // v3.0.20 (fb:58a2112b) — when set, the engine consults player state
  // instead of asking the user. Supported keys (see MovementService.tryAutoAnswer):
  //   'fdny_approved'       → player.fdnyApprovalStatus === 'approved' → 'yes'
  //   'dob_approved'        → player.dobApprovalStatus === 'approved'  → 'yes'
  //   'dob_referred'        → arrived from DOB audit / plan-exam space  → 'yes' (Q3)
  //   'has_fire_protection' → holds a fire-systems W card              → 'yes' (Q4)
  // Empty / undefined → ask the user via choice modal (legacy behavior).
  // The auto-answered chain still walks its tree and produces a moveIntent
  // identical to a player-answered chain — it just skips the modal.
  auto_answer_from?: string;
  // fb:f1bc011b — authored explanation shown when THIS question's branch is
  // the one that routes the player to a destination (a terminal target, not
  // another question). Lets the player understand why they're moving where
  // they are, especially when every question auto-answered and no modal showed.
  // Surfaced via the routing-explanation modal; blank for branches that just
  // recurse to the next question.
  yes_reason?: string;
  no_reason?: string;
}

export interface DiceRollInfo {
  space_name: string;
  die_roll: string; // e.g., "Next Step", "Time outcomes", "W Cards", etc.
  visit_type: 'First' | 'Subsequent';
  roll_1?: string;
  roll_2?: string;
  roll_3?: string;
  roll_4?: string;
  roll_5?: string;
  roll_6?: string;
}

export interface SpaceEffect {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  effect_type: 'time' | 'cards' | 'money' | 'turn' | 'fee' | 'dice';
  effect_action: string;
  effect_value: string | number;
  condition: string;
  description: string;
  trigger_type?: 'manual' | 'auto';
  // 2026-07-16: CSV-portability lift — LOAN_TIERED added, replacing text-
  // sniffing ("1.4m"/"2.75m" substring checks in FinancialEffectHandler)
  // that broke if the fee flavor text was ever reworded.
  fee_type?: 'LOAN_PERCENTAGE' | 'SCOPE_PERCENTAGE' | 'FIXED' | 'DICE_BASED' | 'LOAN_TIERED';
  narrative?: string;
  modal_title?: string;
  modal_description?: string;
  modal_button_label?: string;
  modal_summary?: string;
}

/**
 * Per-action modal text overrides. Loaded from SOURCE_FILES/ModalConfig.csv and
 * keyed by `space_name|visit_type|effect_action`. Phase 1 ships this on
 * SpaceEffect rows; Phase 2 exposes the raw map so standalone modals (like
 * ChoiceModal) can look up overrides that aren't attached to an effect row.
 */
export interface ModalConfigOverrides {
  modal_title?: string;
  modal_description?: string;
  modal_button_label?: string;
  modal_summary?: string;
}

export interface DiceEffect {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  effect_type: string;
  card_type?: string;
  roll_1?: string;
  roll_2?: string;
  roll_3?: string;
  roll_4?: string;
  roll_5?: string;
  roll_6?: string;
  effect_action?: string;
  effect_value?: string | number;
  condition?: string;
  description?: string;
  roll_group?: string;
  roll_action?: string;
  roll_is_percentage?: boolean;
  roll_numeric_only?: boolean;
  fee_category?: string;
}

export interface SpaceContent {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  title: string;
  story: string;
  action_description: string;
  outcome_description: string;
  can_negotiate: boolean;
  end_turn_label?: string;
  try_again_label?: string;
  shake_on?: string;
  tts_field?: string;
  special_action?: string;
  content_text?: string;
  requires_choice?: boolean;
}

export interface Space {
  id: string;
  name: string;
  title: string;
  config: GameConfig;
  content: SpaceContent[];
  movement: Movement[];
  spaceEffects: SpaceEffect[];
  diceEffects: DiceEffect[];
  diceOutcomes: DiceOutcome[];
}

export interface Loan {
  id: string;
  principal: number;
  interestRate: number; // e.g., 0.05 for 5%
  startTurn: number;
}

export interface MoneySources {
  ownerFunding: number;    // Money from owner/founder (dice rolls at OWNER-FUND-INITIATION)
  bankLoans: number;       // Money from bank loans
  investmentDeals: number; // Money from investor deals
  other: number;           // Other sources (cards, space effects, etc.)
}

export interface FundingEntry {
  id: string;
  sourceType: 'bank' | 'investment' | 'owner' | 'other';
  cardId?: string;         // Card ID if funding came from a card
  cardName?: string;       // Card name for display
  amount: number;
  description: string;
  turn: number;
  timestamp: Date;
}

export interface Expenditures {
  design: number;       // Architect/Engineer fees (ARCH-FEE-REVIEW, ENG-FEE-REVIEW)
  fees: number;         // All regulatory, consultant, and expeditor costs (DOB, FDNY, Bank, Investor fees, E cards)
  construction: number; // Cost of work from 'W' cards (work_cost field)
}

// Expense categories (costs/fees paid OUT)
export type ExpenseCategory = 'expeditor' | 'architectural' | 'engineering' | 'regulatory' | 'investmentFee' | 'miscellaneous';

// Income sources (funds received IN) - matches money source types
export type IncomeCategory = 'bank' | 'investor' | 'owner' | 'other';

// Legacy type for backward compatibility - use ExpenseCategory for new code.
// 'construction' is a cost-history-only category (contractor construction cost);
// it is intentionally NOT part of CostBreakdown / ExpenseCategory, which index
// the fee-summary buckets.
export type CostCategory = ExpenseCategory | IncomeCategory | 'construction';

export interface CostEntry {
  id: string;
  category: CostCategory;
  amount: number;
  description: string;
  turn: number;
  timestamp: Date;
  spaceName?: string; // Space where cost was incurred
}

export interface CostBreakdown {
  bank: number;
  investor: number;
  expeditor: number;
  architectural: number;
  engineering: number;
  regulatory: number;
  investmentFee: number;
  miscellaneous: number;
  total: number;
}

export interface SpaceVisitRecord {
  spaceName: string;    // Name of the space visited
  daysSpent: number;    // Days (time) spent at this space
  entryTurn: number;    // Turn when player arrived
  entryTime: number;    // Time spent when player arrived
  exitTurn?: number;    // Turn when player left (undefined if current space)
  exitTime?: number;    // Time spent when player left
  // fb:f1bc011b — project scope at the moment of arrival, so a later visit to
  // the same space can answer "did the scope change since the last visit?"
  // (Q2). Undefined for records written before this field existed.
  scopeAtEntry?: number;
}

export interface Player {
  id: string;
  shortId?: string; // Short ID for URLs (e.g., "P1", "P2", "P3")
  name: string;
  currentSpace: string;
  visitType: 'First' | 'Subsequent';
  visitedSpaces: string[];
  spaceVisitLog: SpaceVisitRecord[]; // Detailed log with time spent per space
  money: number;
  timeSpent: number;
  projectScope: number;
  color?: string;
  avatar?: string;
  deviceType?: 'mobile' | 'desktop'; // Device type detected when player first connects
  hand: string[]; // All cards the player currently possesses
  activeCards: ActiveCard[];
  lastDiceRoll?: {
    roll1: number;
    roll2: number;
    total: number;
  };
  spaceEntrySnapshot?: {
    space: string;
    visitType: 'First' | 'Subsequent';
    money: number;
    timeSpent: number;
    hand: string[];
    activeCards: ActiveCard[];
  };
  turnModifiers?: {
    skipTurns: number;
    canReRoll?: boolean; // Allow re-roll if player doesn't like dice outcome
  };
  activeEffects: ActiveEffect[]; // Duration-based effects that persist across turns
  loans: Loan[]; // Player's outstanding loans with interest
  score: number; // Player's calculated final score
  moneySources: MoneySources; // Track where money came from
  expenditures: Expenditures; // Track where money is spent
  costHistory: CostEntry[]; // Detailed log of all costs incurred
  fundingHistory: FundingEntry[]; // Detailed log of all funding received
  costs: CostBreakdown; // Summary of costs by category
  moveIntent?: string | null; // Player's intended destination (set before move execution)
  currentCard?: string | null; // The card the player is currently interacting with
  role?: string; // Player's assigned role (e.g., "Explorer", "Strategist")
  // Workstream 6 #4 + Phase 6.2: literal-typed shape widened to a generic
  // string→string map so educator-added path-choice spaces work without TS errors.
  // Key = path_choice_memory_key from Spaces.csv (e.g. 'dob_path').
  // Value = the destination space the player committed to at the lock-point.
  pathChoiceMemory?: Record<string, string>;
  // Contractor info from CON-INITIATION dice rolls
  contractor?: {
    quality: 'HIGH' | 'MED' | 'LOW'; // Affects change order frequency (HIGH = fewer, LOW = more)
    multiplier: number; // 1-6, affects base construction cost
    hiredAt?: string; // Space where contractor was hired (for tracking)
  };
  // Resume point: last main-path space before player detoured to a side quest.
  // Workstream 7: still set on arrival at PM-DECISION-CHECK for diagnostic value,
  // but no longer drives resume-hub destination computation — that now reads
  // dobApprovedDestinations / fdnyApprovedDestinations below.
  mainPathResumePoint?: string | null;
  // Set when player visits CHEAT-BYPASS — disables resume logic (point of no return)
  hasUsedCheatBypass?: boolean;

  // Workstream 7 — Plan Approval Mechanic (see docs/core/BETA_PLAN_V3.md).
  // DOB / FDNY approval status updated when player rolls dice at the corresponding
  // examiner space. Persists across moves until explicitly revoked.
  dobApprovalStatus?: ApprovalStatus;
  fdnyApprovalStatus?: ApprovalStatus;
  // Destinations granted by the last successful approval at each examiner.
  // Read by the PM-DECISION-CHECK resume hub to offer "continue from where you left off"
  // moves. Empty array means no approval is active.
  dobApprovedDestinations?: string[];
  fdnyApprovedDestinations?: string[];

  // Homeowner Violation mechanic (L050/L051, see TODO.md 2026-07-31 spec).
  // Set when the life-event card is drawn; cleared to 'resolved' by
  // fileAffidavitOfCorrection(). violationAccrualCheckpoint only matters for
  // the 'daily' variant (L051) — tracks timeSpent already charged through so
  // the per-turn accrual never double-charges the same overdue days.
  violationStatus?: 'none' | 'active' | 'resolved';
  violationVariant?: 'flat' | 'daily';
  violationTier?: 'small' | 'large';
  violationDeadlineDay?: number;
  violationPenaltyBase?: number;
  violationAccrualCheckpoint?: number;
}

export type ApprovalStatus = 'none' | 'minor-objection' | 'approved' | 'denied';

export interface Card {
  card_id: string;
  card_name: string;
  card_type: 'W' | 'B' | 'E' | 'L' | 'I';
  description: string;
  effects_on_play?: string;
  cost?: number;
  phase_restriction?: string;
  work_type_restriction?: string;  // Work type (Plumbing, Electrical, Mechanical Systems, etc.)
  // 2026-07-16: CSV-portability lift. Per-W-card category flags, replacing
  // hardcoded GROUNDWORK_WORK_TYPES/UTILITY_WORK_TYPES/HIGH_PROFILE_WORK_TYPES
  // trade-name allowlists in CardService — those gated L012/L029/L044 by
  // matching work_type_restriction against a fixed set of real NYC trade
  // names, which would silently stop matching if a reskin renames work types.
  is_groundwork?: boolean;            // gates L012 "Soil Contamination"
  requires_utility_hookup?: boolean;  // gates L029 "Utility Delay"
  is_high_profile?: boolean;          // gates L044 "State Funding"
  is_transferable?: boolean;  // Whether this card can be transferred to another player

  // Expanded card mechanics from code2026
  duration?: string;
  duration_count?: string;
  turn_effect?: string;
  activation_timing?: string;

  // Financial mechanics
  loan_amount?: string;
  loan_rate?: string;
  investment_amount?: string;
  work_cost?: string;

  // Effect mechanics
  money_effect?: string;
  tick_modifier?: string;

  // 2026-07-26 — L021 "High-Profile Client". Some cards apply ONE time delta
  // to the playing player (via tick_modifier) and a DIFFERENT delta to every
  // OTHER player. tick_modifier alone can't express two different magnitudes
  // in one row, so this column carries the other-players delta. CardService
  // applies it as a second, independent effect — one RESOURCE_CHANGE per
  // other player currently in the game — after the card's own tick_modifier
  // effect resolves; it never re-targets or replaces that effect. Empty/
  // undefined → no other-player effect (true for every card except L021
  // today). See CardService.applyOtherPlayersTickModifier.
  other_players_tick_modifier?: string;

  // Card interaction mechanics
  draw_cards?: string;
  discard_cards?: string;
  target?: string;
  scope?: string;

  // Structured effect columns (replaces description/name regex parsing)
  // 'bulk_permit_conditional' (2026-07-26, E040 "Bulk Discount") gates on
  // 3+ Work Package cards gained this turn — see CardService.playerFiledBulkPermitsThisTurn.
  card_mechanic?: 'choice' | 'dice_conditional' | 'work_type_conditional' | 'utility_conditional' | 'competing_worktype_conditional' | 'high_profile_conditional' | 'leader_phase_conditional' | 'bulk_permit_conditional';
  dice_range_1_min?: number;
  dice_range_1_max?: number;
  dice_range_1_time?: number;
  dice_range_2_min?: number;
  dice_range_2_max?: number;
  dice_range_2_time?: number;
  investor_payout?: number;

  // Workstream 7 Phase 7.3 — narrative-driven approval revocation.
  // When the card is played, revoke the specified approval(s). Empty / undefined
  // means no revocation. Used for L cards whose story implies regulator pulled
  // back approval (new building code, project redesign forced by lawsuit, etc.).
  revokes_approval?: 'dob' | 'fdny' | 'both' | '';

  // v3.0.17 — phase filter for global-scope tick_modifier fan-out.
  // When set on a card with scope=Global, the time delta only applies to
  // players whose current space is in this phase. Empty / undefined means
  // unrestricted (delta applies to every player). Phase values match
  // GAME_CONFIG.phase: SETUP, OWNER, FUNDING, DESIGN, REGULATORY, CONSTRUCTION, END.
  // Authoring rule: card text saying "all filing times…" → REGULATORY;
  // "all construction times…" → CONSTRUCTION. Without this filter, "all
  // filing times" would also tick down a player standing on a CONSTRUCTION
  // space, contradicting the card's own wording.
  affected_phase?: string;

  // Turn control mechanics
  turn_skip?: string;

  // UI display properties (for enhanced card display)
  name?: string;              // Alternative to card_name for display
  story?: string;             // Narrative text for the card
  actionRequired?: string;    // What the player must do
  potentialOutcomes?: string; // Possible results of choices
  duration_turns?: number;    // Numeric version of duration_count

  // Structured effect data (for choice-based cards)
  effect?: {
    type: string;
    choices?: Array<{
      id: string;
      label: string;
      description: string;
    }>;
  };
}

export interface ActiveCard {
  cardId: string;
  expirationTurn: number;
}

export interface ActiveEffect {
  effectId: string;           // Unique identifier for tracking
  sourceCardId: string;       // The card that created this effect
  effectData: Effect;         // The original effect object to be executed
  remainingDuration: number;  // Number of turns remaining
  startTurn: number;         // Turn when effect was applied
  effectType: string;        // Type of effect for easier categorization
  description?: string;      // Human-readable description
}

export type VisitType = 'First' | 'Subsequent';
export type MovementType = 'fixed' | 'choice' | 'dice' | 'dice_outcome' | 'logic' | 'none';
export type EffectType = 'time' | 'cards' | 'money';
export type CardType = 'W' | 'B' | 'E' | 'L' | 'I';