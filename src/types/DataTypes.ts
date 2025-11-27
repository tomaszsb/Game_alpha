export interface GameConfig {
  space_name: string;
  phase: string;
  path_type: string;
  is_starting_space: boolean;
  is_ending_space: boolean;
  min_players: number;
  max_players: number;
  requires_dice_roll: boolean;
  action?: string;  // Dynamic action keywords like 'GOTO_JAIL', 'PAY_TAX', 'AUCTION'
  game_phase?: string;
  space_order?: number;
  tutorial_step?: number;
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
  effect_type: 'time' | 'cards' | 'money' | 'dice_roll_chance' | 'turn';
  effect_action: string;
  effect_value: string | number;
  condition: string;
  description: string;
  trigger_type?: 'manual' | 'auto';
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
}

export interface SpaceContent {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  title: string;
  story: string;
  action_description: string;
  outcome_description: string;
  can_negotiate: boolean;
  special_action?: string;
  content_text?: string;
  requires_choice?: boolean;
}

export interface Space {
  name: string;
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

export interface Expenditures {
  design: number;       // Architect/Engineer fees (ARCH-FEE-REVIEW, ENG-FEE-REVIEW)
  fees: number;         // All regulatory, consultant, and expeditor costs (DOB, FDNY, Bank, Investor fees, E cards)
  construction: number; // Cost of work from 'W' cards (work_cost field)
}

export type CostCategory = 'bank' | 'investor' | 'expeditor' | 'architectural' | 'engineering' | 'regulatory' | 'miscellaneous';

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
  costs: CostBreakdown; // Summary of costs by category
  moveIntent?: string | null; // Player's intended destination (set before move execution)
  pathChoiceMemory?: {
    'REG-DOB-TYPE-SELECT'?: 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT'; // DOB path choice (locked for application)
    // Future: Other spaces that need choice memory can be added here
  };
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  gamePhase: string;
  isGameOver: boolean;
  winner?: string;
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

  // Turn control mechanics
  turn_skip?: string;
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