// Centralized UI text strings
// Both source components and tests import from here.
// Change a label once → tests stay green.

// --- Dice roll button labels (formatDiceRollButton) ---
export const DICE_BUTTON = {
  WORK: 'Get Work Packages',
  BANK: 'Apply for Bank Loans',
  EXPEDITOR: 'Hire Expeditors',
  INVESTMENT: 'Seek Investments',
  LIFE_EVENT: 'Check for Life Events',
  FEE: 'Determine Fee Amount',
  FUNDING: 'Determine Funding',
  TIME: 'Determine Time Impact',
  QUALITY: 'Assess Quality',
  EFFECTS: 'Determine Effects',
  BONUS: 'Check for Bonus',
  BONUS_FUNDING: 'Check for Bonus Funding',
  BONUS_EFFECTS: 'Check for Bonus Effects',
  NEXT_STEP: 'Determine Next Step',
  OUTCOME: 'Determine Outcome',
};

// --- Dice roll feedback (formatDiceRollFeedback) ---
export const DICE_FEEDBACK = {
  prefix: (value: number) => `Result: ${value}`,
  got: (count: number, typeName: string, plural: string) => `Got ${count} ${typeName}${plural}`,
  gained: (amount: number) => `Gained $${amount}`,
  spent: (amount: number) => `Spent $${amount}`,
  timePenalty: (days: number, unit: string) => `Time Penalty: ${days} ${unit}`,
  timeSaved: (days: number, unit: string) => `Time Saved: ${days} ${unit}`,
  timeBonus: (days: number, unit: string) => `Time Bonus: ${days} ${unit}`,
  movedTo: (dest: string) => `Moved to ${dest}`,
  ON_CURRENT_SPACE: 'on current space',
  ACTION_COMPLETED: 'Action completed',
};

// --- Notification format strings ---
export const NOTIF = {
  // createDiceRollNotification
  diceRollMedium: (value: number, summary: string) =>
    summary ? `🎲 Result: ${value} → ${summary}` : `🎲 Result: ${value} → No effects`,
  diceRollDetailed: (player: string, value: number, summary: string) =>
    summary ? `${player} got ${value} and gained: ${summary}` : `${player} got ${value}`,
  NO_EFFECTS: 'No effects',

  // createCardPlayNotification
  cardPlayShort: '✓',
  // Voice rule: no board-game iconography (the 🃏 playing-card joker leaked
  // game-deck framing). ⚡ reads as "activation" without implying a deck.
  cardPlayMedium: (name: string, summary: string) =>
    summary ? `⚡ Activated ${name} → ${summary}` : `⚡ Activated ${name}`,
  cardPlayDetailed: (player: string, name: string, summary: string) =>
    summary ? `${player} activated "${name}" with effects: ${summary}` : `${player} activated "${name}"`,
};

// --- CardReplacementModal ---
export const CARD_REPLACE = {
  title: (mode: string, typeName: string) => `${mode} ${typeName}`,
  instruction: (max: number) => `Select up to ${max} to replace`,
  instructionReturn: (max: number) =>
    max > 1 ? `Select up to ${max} to return` : 'Select one to return',
  confirm: (mode: string, count: number) => count > 0 ? `${mode} ${count}` : mode,
  empty: (typeName: string, action: string) => `No ${typeName} available to ${action}`,
  counter: (selected: number, max: number) => `${selected} of ${max} selected`,
  RETURN_BUTTON: 'Return to Main Panel',
};

// --- CardDetailsModal ---
export const CARD_DETAILS = {
  TRANSFER_TOGGLE: '↔ Transfer',
  TRANSFER_CONFIRM: 'Transfer',
  TRANSFER_HEADING: 'Select player to transfer to:',
};

// --- DiscardPileModal ---
export const DISCARD_PILE = {
  EMPTY_STATE: 'No resources used yet',
  FILTER_LABEL: 'Filter by type',
};
