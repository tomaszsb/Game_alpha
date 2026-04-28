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
  // Workstream 6 #4: path-choice memory flags
  path_choice_memory_key?: string;       // opaque slot name; spaces share when they share a choice
  is_path_choice_lock_point?: boolean;   // First-visit destination is stored under path_choice_memory_key
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
  fee_type?: 'LOAN_PERCENTAGE' | 'FIXED' | 'DICE_BASED';
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

// Legacy type for backward compatibility - use ExpenseCategory for new code
export type CostCategory = ExpenseCategory | IncomeCategory;

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
  // Resume point: last main-path space before player detoured to a side quest
  // When returning from side quest to PM-DECISION-CHECK, this space's destinations are offered
  mainPathResumePoint?: string | null;
  // Set when player visits CHEAT-BYPASS — disables resume logic (point of no return)
  hasUsedCheatBypass?: boolean;
}

export interface Card {
  card_id: string;
  card_name: string;
  card_type: 'W' | 'B' | 'E' | 'L' | 'I';
  description: string;
  effects_on_play?: string;
  cost?: number;
  phase_restriction?: string;
  work_type_restriction?: string;  // Work type (Plumbing, Electrical, Mechanical Systems, etc.)
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

  // Card interaction mechanics
  draw_cards?: string;
  discard_cards?: string;
  target?: string;
  scope?: string;

  // Structured effect columns (replaces description/name regex parsing)
  card_mechanic?: 'choice' | 'dice_conditional';
  dice_range_1_min?: number;
  dice_range_1_max?: number;
  dice_range_1_time?: number;
  dice_range_2_min?: number;
  dice_range_2_max?: number;
  dice_range_2_time?: number;
  investor_payout?: number;

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
  effectData: any;           // The original effect object to be executed
  remainingDuration: number;  // Number of turns remaining
  startTurn: number;         // Turn when effect was applied
  effectType: string;        // Type of effect for easier categorization
  description?: string;      // Human-readable description
}

export type VisitType = 'First' | 'Subsequent';
export type MovementType = 'fixed' | 'choice' | 'dice' | 'dice_outcome' | 'logic' | 'none';
export type EffectType = 'time' | 'cards' | 'money';
export type CardType = 'W' | 'B' | 'E' | 'L' | 'I';