/**
 * Type definitions for the Space Data Editor
 */

/**
 * Represents a single row from SOURCE_FILES/Spaces.csv
 * Each space has 2 rows: First visit and Subsequent visit
 */
export interface SpaceRow {
  space_name: string;
  phase: string;
  visit_type: 'First' | 'Subsequent';
  Title: string;      // Display title (e.g., "Owner Scope Initiation")
  Event: string;      // Story text
  Action: string;     // Action description
  Outcome: string;    // Outcome description
  w_card: string;     // W card effect
  b_card: string;     // B card effect
  i_card: string;     // I card effect
  l_card: string;     // L card effect
  e_card: string;     // E card effect
  Time: string;       // Time cost (e.g., "5 days")
  Fee: string;        // Fee amount (e.g., "8%")
  space_1: string;    // Destination 1
  space_2: string;    // Destination 2
  space_3: string;    // Destination 3
  space_4: string;    // Destination 4
  space_5: string;    // Destination 5
  Negotiate: string;  // YES/NO
  requires_dice_roll: string; // Yes/No
  path: string;       // Path type
  rolls: string;      // Dice roll count
  end_turn_label: string;   // Custom end turn button label
  try_again_label: string;  // Custom try again / negotiate button label
  w_card_label: string;     // Custom button label for W card action
  b_card_label: string;     // Custom button label for B card action
  i_card_label: string;     // Custom button label for I card action
  l_card_label: string;     // Custom button label for L card action
  e_card_label: string;     // Custom button label for E card action
  shake_on: string;         // When modal shakes: '', 'negative', 'always'
  tts_field: string;        // Which text to read aloud: '', 'story', 'action', 'outcome', 'summary'
  w_card_narrative: string; // Per-action narrative for W card modal
  b_card_narrative: string; // Per-action narrative for B card modal
  i_card_narrative: string; // Per-action narrative for I card modal
  l_card_narrative: string; // Per-action narrative for L card modal
  e_card_narrative: string; // Per-action narrative for E card modal
}

/**
 * Represents a single row from SOURCE_FILES/DiceRoll Info.csv
 */
export interface DiceRollRow {
  space_name: string;
  die_roll: string;      // Category (e.g., "W Cards", "Next Step", "Fees Paid")
  visit_type: 'First' | 'Subsequent';
  roll_1: string;
  roll_2: string;
  roll_3: string;
  roll_4: string;
  roll_5: string;
  roll_6: string;
  button_label: string;  // Custom button label (e.g., "Roll for Scope Worktypes")
  roll_group: string;    // Group name — effects with same roll_group share one dice roll; blank = all share one roll
}

/**
 * Represents a single row from SOURCE_FILES/ModalConfig.csv
 * Per-action modal customization — overrides hardcoded modal text
 */
export interface ModalConfigRow {
  space_name: string;
  visit_type: 'First' | 'Subsequent';
  effect_action: string;       // e.g., 'draw_W', 'return_e', 'add' (time), 'deduct' (fee)
  modal_title: string;         // Override modal title
  modal_description: string;   // Override effect description (supports {count}, {cardType}, {amount})
  modal_button_label: string;  // Override "Continue" / "Make Choice" button
  modal_summary: string;       // Override summary text
}

/**
 * Editor state management
 */
export interface EditorState {
  spacesData: SpaceRow[];
  diceRollData: DiceRollRow[];
  modalConfigData: ModalConfigRow[];
  selectedSpaceId: string | null;
  visitType: 'First' | 'Subsequent';
  searchTerm: string;
  hasUnsavedChanges: boolean;
  activeTab: 'spaces' | 'diceRolls';
}

/**
 * Available phases for spaces
 */
export const PHASES = [
  'SETUP',
  'OWNER',
  'FUNDING',
  'DESIGN',
  'REGULATORY',
  'CONSTRUCTION',
  'END'
] as const;

/**
 * Available path types
 */
export const PATH_TYPES = [
  'Main',
  'LOGIC',
  'Special',
  'Side quest money',
  'side Quest scope',
  'side quest cheat',
  'Single choice',
  'Regular',
  'Prof'
] as const;

/**
 * Yes/No options for dropdowns
 */
export const YES_NO_OPTIONS = ['YES', 'NO'] as const;
export const YES_NO_LOWER_OPTIONS = ['Yes', 'No'] as const;

export const SHAKE_OPTIONS = ['', 'negative', 'always'] as const;
export const TTS_FIELD_OPTIONS = ['', 'story', 'action', 'outcome', 'summary'] as const;
