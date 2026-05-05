// tests/fixtures/testData.ts
// Lightweight test data fixtures for performance optimization
// This reduces CSV loading overhead by 20%

import { Card, GameConfig, SpaceEffect, DiceEffect, Movement, SpaceContent } from '../../src/types/DataTypes';
import { Player } from '../../src/types/DataTypes';

// Minimal card data for testing
export const TEST_CARDS: Card[] = [
  {
    card_id: 'E001',
    card_type: 'E',
    card_name: 'Test Expeditor Card',
    description: 'Test card for unit testing',
    cost: 100,
    phase_restriction: 'Any',
    money_effect: '100',
    duration: 'Immediate',
    target: 'Self'
  },
  {
    card_id: 'W001',
    card_type: 'W',
    card_name: 'Test Work Card',
    description: 'Test work card for unit testing',
    cost: 0,
    phase_restriction: 'Construction',
    money_effect: '0',
    duration: 'Active',
    target: 'Self'
  },
  {
    card_id: 'B001',
    card_type: 'B',
    card_name: 'Test Blue Card',
    description: 'Test blue card for unit testing',
    cost: 50,
    phase_restriction: 'Any',
    money_effect: '200',
    duration: 'Immediate',
    target: 'Self'
  },
  {
    card_id: 'L003',
    card_type: 'L',
    card_name: 'New Safety Regulations',
    description: 'All players get +3 time and discard 1 E card',
    cost: 75,
    phase_restriction: 'Any',
    discard_cards: 'E:1',
    duration: 'Immediate',
    target: 'All Players'
  },
  {
    card_id: 'I001',
    card_type: 'I',
    card_name: 'Test Innovation Card',
    description: 'Test innovation card for unit testing',
    cost: 150,
    phase_restriction: 'Any',
    money_effect: '300',
    duration: 'Immediate',
    target: 'Self'
  }
];

// Minimal player data for testing
const EMPTY_MONEY_SOURCES = {
  ownerFunding: 0,
  bankLoans: 0,
  investmentDeals: 0,
  other: 0
};

const EMPTY_EXPENDITURES = {
  design: 0,
  fees: 0,
  construction: 0
};

const EMPTY_COSTS = {
  bank: 0,
  investor: 0,
  expeditor: 0,
  architectural: 0,
  engineering: 0,
  regulatory: 0,
  investmentFee: 0,
  miscellaneous: 0,
  total: 0
};

export const TEST_PLAYERS: Player[] = [
  {
    id: 'player1',
    name: 'Test Player 1',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    visitedSpaces: [],
    spaceVisitLog: [],
    money: 1000,
    timeSpent: 10,
    projectScope: 2000000,
    hand: ['E001'],
    activeCards: [],
    activeEffects: [],
    loans: [],
    score: 0,
    moneySources: { ...EMPTY_MONEY_SOURCES },
    expenditures: { ...EMPTY_EXPENDITURES },
    costHistory: [],
    fundingHistory: [],
    costs: { ...EMPTY_COSTS }
  },
  {
    id: 'player2',
    name: 'Test Player 2',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    visitedSpaces: [],
    spaceVisitLog: [],
    money: 1500,
    timeSpent: 12,
    projectScope: 2000000,
    hand: ['B001'],
    activeCards: [],
    activeEffects: [],
    loans: [],
    score: 0,
    moneySources: { ...EMPTY_MONEY_SOURCES },
    expenditures: { ...EMPTY_EXPENDITURES },
    costHistory: [],
    fundingHistory: [],
    costs: { ...EMPTY_COSTS }
  }
];

// Minimal game config data
export const TEST_GAME_CONFIGS: GameConfig[] = [
  {
    space_name: 'START-SPACE',
    phase: 'SETUP',
    path_type: 'Main',
    is_starting_space: true,
    is_ending_space: false,
    min_players: 1,
    max_players: 6,
    requires_dice_roll: true
  },
  {
    space_name: 'OWNER-SCOPE-INITIATION',
    phase: 'SETUP',
    path_type: 'Main',
    is_starting_space: true,
    is_ending_space: false,
    min_players: 1,
    max_players: 6,
    requires_dice_roll: true
  },
  {
    space_name: 'CONSTRUCTION-SITE',
    phase: 'Construction',
    path_type: 'Main',
    is_starting_space: false,
    is_ending_space: false,
    min_players: 1,
    max_players: 6,
    requires_dice_roll: false
  },
  {
    space_name: 'OWNER-FUND-INITIATION',
    phase: 'Funding',
    path_type: 'Main',
    is_starting_space: false,
    is_ending_space: false,
    min_players: 1,
    max_players: 6,
    requires_dice_roll: true
  }
];

// Minimal space effects data
export const TEST_SPACE_EFFECTS: SpaceEffect[] = [
  {
    space_name: 'START-SPACE',
    visit_type: 'First',
    effect_type: 'cards',
    effect_action: 'replace_e',
    effect_value: '1',
    condition: 'always',
    description: 'Replace E card on first visit'
  },
  {
    space_name: 'OWNER-FUND-INITIATION',
    visit_type: 'First',
    effect_type: 'cards',
    effect_action: 'draw_b',
    effect_value: '1',
    condition: 'scope_le_4M',
    description: 'Draw B card for small scope'
  },
  {
    space_name: 'OWNER-FUND-INITIATION',
    visit_type: 'First',
    effect_type: 'cards',
    effect_action: 'draw_i',
    effect_value: '1',
    condition: 'scope_gt_4M',
    description: 'Draw I card for large scope'
  }
];

// Minimal dice effects data
export const TEST_DICE_EFFECTS: DiceEffect[] = [
  {
    space_name: 'START-SPACE',
    visit_type: 'First',
    effect_type: 'money',
    effect_action: 'add',
    roll_1: '100',
    roll_6: '500'
  }
];

// Minimal movement data
export const TEST_MOVEMENTS: Movement[] = [
  {
    space_name: 'START-SPACE',
    visit_type: 'First',
    movement_type: 'fixed',
    destination_1: 'OWNER-SCOPE-INITIATION'
  },
  {
    space_name: 'OWNER-SCOPE-INITIATION',
    visit_type: 'First',
    movement_type: 'fixed',
    destination_1: 'CONSTRUCTION-SITE'
  }
];

// Minimal space content data
export const TEST_SPACE_CONTENT: SpaceContent[] = [
  {
    space_name: 'START-SPACE',
    visit_type: 'First',
    title: 'Welcome to the Game',
    story: 'You begin your software development journey.',
    action_description: 'Draw your starting hand and roll the dice to begin.',
    outcome_description: '',
    can_negotiate: false
  },
  {
    space_name: 'CONSTRUCTION-SITE',
    visit_type: 'First',
    title: 'Construction Phase',
    story: 'Time to build your software project.',
    action_description: 'Play construction-related cards here.',
    outcome_description: '',
    can_negotiate: false
  }
];

// Utility functions for creating test data
export const createTestPlayer = (overrides: Partial<Player> = {}): Player => ({
  ...TEST_PLAYERS[0],
  ...overrides
});

export const createTestCard = (overrides: Partial<Card> = {}): Card => ({
  ...TEST_CARDS[0],
  ...overrides
});

// Utility function to create test game state
export const createTestGameState = (overrides: any = {}) => ({
  currentPlayer: 'player1',
  phase: 'PLAY',
  turn: 1,
  players: TEST_PLAYERS,
  gamePhase: 'PLAY',
  gameStarted: true,
  gameEnded: false,
  winner: null,
  maxPlayers: 6,
  decks: {
    W: { cards: [], shuffled: true },
    B: { cards: [], shuffled: true },
    E: { cards: [], shuffled: true },
    L: { cards: [], shuffled: true },
    I: { cards: [], shuffled: true }
  },
  discardPiles: { W: [], B: [], E: [], L: [], I: [] },
  actionHistory: [],
  modal: null,
  awaitingChoice: null,
  negotiationState: null,
  preSpaceEffectSnapshot: null,
  ...overrides
});

// Mock DataService data
export const MOCK_DATA_SERVICE_DATA = {
  cards: TEST_CARDS,
  gameConfigs: TEST_GAME_CONFIGS,
  spaceEffects: TEST_SPACE_EFFECTS,
  diceEffects: TEST_DICE_EFFECTS,
  movements: TEST_MOVEMENTS,
  spaceContent: TEST_SPACE_CONTENT
};

// Fast mock DataService factory
export const createFastMockDataService = () => ({
  isLoaded: vi.fn(() => true),
  loadData: vi.fn(async () => Promise.resolve()),

  // Card methods
  getCards: vi.fn(() => TEST_CARDS),
  getCardById: vi.fn((id: string) => TEST_CARDS.find(card => card.card_id === id)),
  getCardsByType: vi.fn((type: string) => TEST_CARDS.filter(card => card.card_type === type)),
  getAllCardTypes: vi.fn(() => ['W', 'B', 'E', 'L', 'I']),

  // Game config methods
  getGameConfig: vi.fn(() => TEST_GAME_CONFIGS),
  getGameConfigBySpace: vi.fn((space: string) => TEST_GAME_CONFIGS.find(config => config.space_name === space)),
  getPhaseOrder: vi.fn(() => ['SETUP', 'Design', 'Construction', 'Funding', 'Regulatory']),

  // Space methods
  getAllSpaces: vi.fn(() => TEST_GAME_CONFIGS.map(config => config.space_name)),
  getSpaceByName: vi.fn((name: string) => TEST_GAME_CONFIGS.find(config => config.space_name === name)),

  // Movement methods
  getMovement: vi.fn((current: string, _destination: string) =>
    TEST_MOVEMENTS.find(m => m.space_name === current)),
  getAllMovements: vi.fn(() => TEST_MOVEMENTS),

  // Effects methods
  getSpaceEffects: vi.fn((space: string) => TEST_SPACE_EFFECTS.filter(effect => effect.space_name === space)),
  getAllSpaceEffects: vi.fn(() => TEST_SPACE_EFFECTS),
  getDiceEffects: vi.fn((space: string) => TEST_DICE_EFFECTS.filter(effect => effect.space_name === space)),
  getAllDiceEffects: vi.fn(() => TEST_DICE_EFFECTS),

  // Content methods
  getSpaceContent: vi.fn((space: string) => TEST_SPACE_CONTENT.find(content => content.space_name === space)),
  getAllSpaceContent: vi.fn(() => TEST_SPACE_CONTENT),

  // Dice outcome methods
  getDiceOutcome: vi.fn(() => ({ space_name: 'START-SPACE', visit_type: 'First' as const, roll_3: 'Move forward 3 spaces' })),
  getAllDiceOutcomes: vi.fn(() => [])
});
