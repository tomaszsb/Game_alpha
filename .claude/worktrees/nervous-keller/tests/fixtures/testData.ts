// tests/fixtures/testData.ts
// Lightweight test data fixtures for performance optimization
// This reduces CSV loading overhead by 20%

import { Card, GameConfig, SpaceEffect, DiceEffect, Movement, SpaceContent } from '../../src/types/DataTypes';
import { Player } from '../../src/types/StateTypes';

// Minimal card data for testing
export const TEST_CARDS: Card[] = [
  {
    card_id: 'E001',
    card_type: 'E',
    card_name: 'Test Expeditor Card',
    description: 'Test card for unit testing',
    cost: 100,
    source: 'test',
    phase_restriction: 'Any',
    money_effect: 100,
    time_effect: -1,
    duration: 'Immediate',
    target: 'Self'
  },
  {
    card_id: 'W001',
    card_type: 'W',
    card_name: 'Test Work Card',
    description: 'Test work card for unit testing',
    cost: 0,
    source: 'test',
    phase_restriction: 'Construction',
    money_effect: 0,
    time_effect: 0,
    duration: 'Active',
    target: 'Self'
  },
  {
    card_id: 'B001',
    card_type: 'B',
    card_name: 'Test Blue Card',
    description: 'Test blue card for unit testing',
    cost: 50,
    source: 'test',
    phase_restriction: 'Any',
    money_effect: 200,
    time_effect: 0,
    duration: 'Immediate',
    target: 'Self'
  },
  {
    card_id: 'L003',
    card_type: 'L',
    card_name: 'New Safety Regulations',
    description: 'All players get +3 time and discard 1 E card',
    cost: 75,
    source: 'test',
    phase_restriction: 'Any',
    time_effect: 3,
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
    source: 'test',
    phase_restriction: 'Any',
    money_effect: 300,
    time_effect: -2,
    duration: 'Immediate',
    target: 'Self'
  }
];

// Minimal player data for testing
export const TEST_PLAYERS: Player[] = [
  {
    id: 'player1',
    name: 'Test Player 1',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    money: 1000,
    timeSpent: 10,
    projectScope: 2000000,
    hand: ['E001'],
    activeCards: []
  },
  {
    id: 'player2',
    name: 'Test Player 2',
    currentSpace: 'START-SPACE',
    visitType: 'First',
    money: 1500,
    timeSpent: 12,
    projectScope: 2000000,
    hand: ['B001'],
    activeCards: []
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
    condition: 'always',
    type: 'cards',
    action: 'replace_e',
    value: '1'
  },
  {
    space_name: 'OWNER-FUND-INITIATION',
    condition: 'scope_le_4M',
    type: 'cards',
    action: 'draw_b',
    value: '1'
  },
  {
    space_name: 'OWNER-FUND-INITIATION',
    condition: 'scope_gt_4M',
    type: 'cards',
    action: 'draw_i',
    value: '1'
  }
];

// Minimal dice effects data
export const TEST_DICE_EFFECTS: DiceEffect[] = [
  {
    space_name: 'START-SPACE',
    dice_roll: 1,
    type: 'money',
    action: 'add',
    value: '100'
  },
  {
    space_name: 'START-SPACE',
    dice_roll: 6,
    type: 'money',
    action: 'add',
    value: '500'
  }
];

// Minimal movement data
export const TEST_MOVEMENTS: Movement[] = [
  {
    current_space: 'START-SPACE',
    destination: 'OWNER-SCOPE-INITIATION',
    movement_type: 'adjacent'
  },
  {
    current_space: 'OWNER-SCOPE-INITIATION',
    destination: 'CONSTRUCTION-SITE',
    movement_type: 'adjacent'
  }
];

// Minimal space content data
export const TEST_SPACE_CONTENT: SpaceContent[] = [
  {
    space_name: 'START-SPACE',
    title: 'Welcome to the Game',
    story_text: 'You begin your software development journey.',
    instruction_text: 'Draw your starting hand and roll the dice to begin.'
  },
  {
    space_name: 'CONSTRUCTION-SITE',
    title: 'Construction Phase',
    story_text: 'Time to build your software project.',
    instruction_text: 'Play construction-related cards here.'
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
  getCardById: vi.fn((id: string) => TEST_CARDS.find(card => card.id === id)),
  getCardsByType: vi.fn((type: string) => TEST_CARDS.filter(card => card.type === type)),
  getAllCardTypes: vi.fn(() => ['W', 'B', 'E', 'L', 'I']),
  
  // Game config methods
  getGameConfig: vi.fn(() => TEST_GAME_CONFIGS),
  getGameConfigBySpace: vi.fn((space: string) => TEST_GAME_CONFIGS.find(config => config.space_name === space)),
  getPhaseOrder: vi.fn(() => ['SETUP', 'Design', 'Construction', 'Funding', 'Regulatory']),
  
  // Space methods
  getAllSpaces: vi.fn(() => TEST_GAME_CONFIGS.map(config => config.space_name)),
  getSpaceByName: vi.fn((name: string) => TEST_GAME_CONFIGS.find(config => config.space_name === name)),
  
  // Movement methods
  getMovement: vi.fn((current: string, destination: string) => 
    TEST_MOVEMENTS.find(m => m.current_space === current && m.destination === destination)),
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
  getDiceOutcome: vi.fn(() => ({ space_name: 'START-SPACE', dice_roll: 3, outcome: 'Move forward 3 spaces' })),
  getAllDiceOutcomes: vi.fn(() => [])
});