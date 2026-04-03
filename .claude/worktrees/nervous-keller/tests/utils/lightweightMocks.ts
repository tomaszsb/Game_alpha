// tests/utils/lightweightMocks.ts
// Lightweight mock services for performance optimization
// Uses minimal fixtures instead of heavy mock objects with 300+ method stubs

// Cross-compatibility for Jest and Vitest
const mockFn: any = (() => {
  if (typeof vi !== 'undefined' && vi.fn) return vi.fn;
  if (typeof jest !== 'undefined' && jest.fn) return jest.fn;
  return (impl?: any) => impl || (() => {});
})();

import { 
  TEST_PLAYERS, 
  TEST_CARDS, 
  createTestPlayer, 
  createTestCard,
  createFastMockDataService,
  MOCK_DATA_SERVICE_DATA 
} from '../fixtures/testData';

import { 
  IDataService, 
  IStateService, 
  ICardService, 
  IResourceService,
  ITurnService,
  IPlayerActionService,
  IEffectEngineService
} from '../../src/types/ServiceContracts';

// Lightweight StateService mock - only essential methods
export const createLightweightStateService = () => ({
  // Essential state access
  isStateLoaded: mockFn(() => true),
  getGameState: mockFn(() => ({
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
    preSpaceEffectSnapshot: null
  })),
  
  // Player management
  getPlayer: mockFn((id: string) => TEST_PLAYERS.find(p => p.id === id) || TEST_PLAYERS[0]),
  getAllPlayers: mockFn(() => TEST_PLAYERS),
  updatePlayer: mockFn(async (player) => Promise.resolve()),
  addPlayer: mockFn(async (player) => Promise.resolve()),
  
  // Game flow
  setCurrentPlayer: mockFn(async (playerId: string) => Promise.resolve()),
  setGamePhase: mockFn(async (phase: string) => Promise.resolve()),
  advanceTurn: mockFn(async () => Promise.resolve()),
  nextPlayer: mockFn(async () => Promise.resolve()),
  
  // Essential utilities
  initializeGame: mockFn(async (players) => Promise.resolve()),
  startGame: mockFn(async () => Promise.resolve()),
  updateGameState: mockFn(async (updates) => Promise.resolve()),
  updateActionCounts: mockFn(async (playerId, requiredActions, completedActions) => Promise.resolve())
});

// Lightweight CardService mock - only essential methods
export const createLightweightCardService = () => ({
  // Essential card operations
  playCard: mockFn(async (playerId: string, cardId: string) => 
    Promise.resolve({ success: true, message: 'Card played successfully' })),
  
  drawCards: mockFn(async (playerId: string, cardType: string, count: number) => 
    Promise.resolve(TEST_CARDS.slice(0, count))),
  
  discardCards: mockFn(async (playerId: string, cardIds: string[], reason?: string) => 
    Promise.resolve({ success: true, discardedCount: cardIds.length })),
  
  // Card information
  getCardType: mockFn((cardId: string) => cardId.charAt(0) as 'W' | 'B' | 'E' | 'L' | 'I'),
  getPlayerCards: mockFn((playerId: string) => TEST_CARDS.slice(0, 3)),
  getPlayerCardCount: mockFn((playerId: string) => 3),
  
  // Validation
  canPlayCard: mockFn((playerId: string, cardId: string) => true),
  playerOwnsCard: mockFn((playerId: string, cardId: string) => true),
  isValidCardType: mockFn((cardType: string) => ['W', 'B', 'E', 'L', 'I'].includes(cardType)),
  
  // Lifecycle
  endOfTurn: mockFn(async (playerId: string) => Promise.resolve())
});

// Lightweight ResourceService mock - only essential methods
export const createLightweightResourceService = () => ({
  addMoney: mockFn(async (playerId: string, amount: number, reason?: string) => Promise.resolve()),
  spendMoney: mockFn(async (playerId: string, amount: number, reason?: string) => Promise.resolve()),
  canAfford: mockFn((playerId: string, amount: number) => true),
  
  addTime: mockFn(async (playerId: string, amount: number, reason?: string) => Promise.resolve()),
  spendTime: mockFn(async (playerId: string, amount: number, reason?: string) => Promise.resolve()),
  
  updateResources: mockFn(async (playerId: string, moneyChange: number, timeChange: number, reason?: string) => Promise.resolve()),
  
  validateResourceChange: mockFn((playerId: string, moneyChange: number, timeChange: number) => 
    ({ valid: true, errors: [] }))
});

// Lightweight TurnService mock - only essential methods
export const createLightweightTurnService = () => ({
  takeTurn: mockFn(async (playerId: string) => Promise.resolve({ success: true })),
  endTurn: mockFn(async (playerId: string) => Promise.resolve({ success: true })),
  rollDice: mockFn(async (playerId: string) => Promise.resolve({ diceRoll: 3, success: true })),
  
  canPlayerTakeTurn: mockFn((playerId: string) => true),
  getCurrentPlayerTurn: mockFn(() => 'player1'),
  
  rollDiceWithFeedback: mockFn(async (playerId: string) => 
    Promise.resolve({ diceRoll: 3, success: true, message: 'Rolled 3' }))
});

// Lightweight PlayerActionService mock - only essential methods
export const createLightweightPlayerActionService = (cardService?: any) => ({
  playCard: mockFn(async (playerId: string, cardId: string) => {
    // Call the cardService.playCard if provided to simulate real behavior
    if (cardService && cardService.playCard) {
      await cardService.playCard(playerId, cardId);
    }
    return Promise.resolve({ success: true, message: 'Card played successfully' });
  }),

  rollDice: mockFn(async (playerId: string) =>
    Promise.resolve({ success: true, diceRoll: 3 })),

  endTurn: mockFn(async (playerId: string) =>
    Promise.resolve({ success: true, message: 'Turn ended' }))
});

// Lightweight EffectEngineService mock - only essential methods
export const createLightweightEffectEngineService = () => ({
  processEffects: mockFn(async (effects, targetPlayerId, triggerEvent, source) => 
    Promise.resolve({ 
      successful: effects.length, 
      failed: 0, 
      errors: [],
      totalEffects: effects.length,
      successfulEffects: effects.length
    })),
  
  processCardEffects: mockFn(async (playerId, cardId) => 
    Promise.resolve({ 
      successful: 1, 
      failed: 0, 
      errors: [],
      totalEffects: 1,
      successfulEffects: 1
    })),
  
  processEffect: mockFn(async (effect, targetPlayerId) => Promise.resolve()),
  
  validateEffect: mockFn((effect) => ({ valid: true, errors: [] })),
  validateEffects: mockFn((effects) => ({ valid: true, errors: [] }))
});

// Factory function to create all lightweight mocks at once
export const createLightweightMockServices = () => {
  const cardService = createLightweightCardService();

  return {
    dataService: createFastMockDataService(),
    stateService: createLightweightStateService(),
    cardService,
    resourceService: createLightweightResourceService(),
    turnService: createLightweightTurnService(),
    playerActionService: createLightweightPlayerActionService(cardService),
    effectEngineService: createLightweightEffectEngineService()
  };
};

// Utility function to create a test game state quickly
export const createTestGameState = (overrides = {}) => ({
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

// Performance testing utilities
export const performanceMocks = {
  // Ultra-fast mocks for performance-critical tests
  fastDataService: () => ({
    isLoaded: () => true,
    getCardById: (id: string) => ({ id, type: id.charAt(0), name: `Test ${id}` }),
    getCardsByType: (type: string) => [{ id: `${type}001`, type, name: `Test ${type}` }]
  }),
  
  // Minimal state service for performance tests
  fastStateService: () => ({
    isStateLoaded: () => true,
    getPlayer: (id: string) => createTestPlayer({ id }),
    updatePlayer: mockFn(async () => {})
  })
};

export default createLightweightMockServices;