// E012 Card Choice Integration Test
import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectFactory } from '../src/utils/EffectFactory';
import { EffectEngineService } from '../src/services/EffectEngineService';
import { Effect, EffectContext, isChoiceOfEffectsEffect } from '../src/types/EffectTypes';
import { Player, Card } from '../src/types/DataTypes';
import { GameState } from '../src/types/StateTypes';
import {
  createMockResourceService,
  createMockCardService,
  createMockChoiceService,
  createMockStateService,
  createMockMovementService,
  createMockTurnService,
  createMockGameRulesService
} from './mocks/mockServices';

const createMockServices = () => ({
  resourceService: createMockResourceService(),
  cardService: createMockCardService(),
  choiceService: createMockChoiceService(),
  stateService: createMockStateService(),
  movementService: createMockMovementService(),
  turnService: createMockTurnService(),
  gameRulesService: createMockGameRulesService()
});

describe('E012 Card - Choice of Effects Integration', () => {
  let effectEngineService: EffectEngineService;
  let mockServices: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    mockServices = createMockServices();
    
    // Set up default mock behaviors
    vi.clearAllMocks();
    
    // Default mock returns for services
    mockServices.cardService.discardCards.mockReturnValue(true);
    mockServices.resourceService.addMoney.mockReturnValue(true);
    mockServices.resourceService.spendMoney.mockReturnValue(true);
    mockServices.resourceService.addTime.mockReturnValue(undefined);
    mockServices.resourceService.spendTime.mockReturnValue(undefined);
    
    effectEngineService = new EffectEngineService(
      mockServices.resourceService,
      mockServices.cardService,
      mockServices.choiceService,
      mockServices.stateService,
      mockServices.movementService,
      mockServices.turnService,
      mockServices.gameRulesService,
      {} as any // targetingService
    );
  });

  it('should parse E012 card description into CHOICE_OF_EFFECTS', () => {
    const e012Card: Card = {
      card_id: 'E012',
      card_name: 'Paperwork Snag',
      description: 'Discard 1 Expeditor Card or the current filing takes 1 tick more time.',
      card_type: 'E'
    };

    const effects = EffectFactory.createEffectsFromCard(e012Card, 'player1');

    expect(effects).toHaveLength(1);
    expect(effects[0].effectType).toBe('CHOICE_OF_EFFECTS');
    
    if (isChoiceOfEffectsEffect(effects[0])) {
      const payload = effects[0].payload;
      expect(payload.playerId).toBe('player1');
      expect(payload.prompt).toBe('Paperwork Snag: Choose one option');
      expect(payload.options).toHaveLength(2);
      
      // Check first option - discard card
      expect(payload.options[0].label).toBe('Discard 1 Expeditor Card');
      expect(payload.options[0].effects).toHaveLength(1);
      expect(payload.options[0].effects[0].effectType).toBe('CARD_DISCARD');
      
      // Check second option - time delay
      expect(payload.options[1].label).toBe('Current filing takes 1 tick more time');
      expect(payload.options[1].effects).toHaveLength(1);
      expect(payload.options[1].effects[0].effectType).toBe('RESOURCE_CHANGE');
    }
  });

  it('should process E012 choice effect - option 0 (discard card)', async () => {
    const choiceEffect: Effect = {
      effectType: 'CHOICE_OF_EFFECTS',
      payload: {
        playerId: 'player1',
        prompt: 'Paperwork Snag: Choose one option',
        options: [
          {
            label: 'Discard 1 Expeditor Card',
            effects: [{
              effectType: 'CARD_DISCARD',
              payload: {
                playerId: 'player1',
                cardIds: [],
                cardType: 'E',
                count: 1,
                source: 'card:E012',
                reason: 'Paperwork Snag: Player chose to discard Expeditor card'
              }
            }]
          },
          {
            label: 'Current filing takes 1 tick more time',
            effects: [{
              effectType: 'RESOURCE_CHANGE',
              payload: {
                playerId: 'player1',
                resource: 'TIME',
                amount: 1,
                source: 'card:E012',
                reason: 'Paperwork Snag: Player chose filing delay'
              }
            }]
          }
        ]
      }
    };

    const context: EffectContext = {
      source: 'Card Play',
      playerId: 'player1',
      triggerEvent: 'CARD_PLAY'
    };

    // Mock choice service to return option 0 (discard)
    mockServices.choiceService.createChoice.mockResolvedValue('0');
    
    // Mock card service for discard processing
    const mockPlayer: Player = {
      id: 'player1',
      name: 'Test Player',
      currentSpace: 'START',
      visitType: 'First',
      money: 100,
      timeSpent: 0,
      projectScope: 0,
      score: 0,
      color: '#007bff',
      avatar: '👤',
      hand: ['E001', 'E002'], // New hand structure - player has 2 E cards
      activeCards: [],
      turnModifiers: { skipTurns: 0 },
      activeEffects: [],
      loans: []
    };

    const mockGameState: GameState = {
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      turn: 1,
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      isGameOver: false,
      requiredActions: 1,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      decks: {
        W: ['W003', 'W004'],
        B: ['B003', 'B004'],
        E: ['E003', 'E004'], // Additional E cards in deck
        L: ['L001', 'L002'],
        I: ['I001', 'I002']
      },
      discardPiles: {
        W: [],
        B: [],
        E: [],
        L: [],
        I: []
      }
    };
    
    mockServices.stateService.getPlayer.mockReturnValue(mockPlayer);
    mockServices.stateService.getGameState.mockReturnValue(mockGameState);
    mockServices.cardService.getPlayerCards.mockReturnValue(['E001', 'E002']);

    const result = await effectEngineService.processEffect(choiceEffect, context);

    expect(result.success).toBe(true);
    expect(mockServices.choiceService.createChoice).toHaveBeenCalledWith(
      'player1',
      'GENERAL',
      'Paperwork Snag: Choose one option',
      [
        { id: '0', label: 'Discard 1 Expeditor Card' },
        { id: '1', label: 'Current filing takes 1 tick more time' }
      ]
    );
  });

  it('should process E012 choice effect - option 1 (time delay)', async () => {
    const choiceEffect: Effect = {
      effectType: 'CHOICE_OF_EFFECTS',
      payload: {
        playerId: 'player1',
        prompt: 'Paperwork Snag: Choose one option',
        options: [
          {
            label: 'Discard 1 Expeditor Card',
            effects: [{
              effectType: 'CARD_DISCARD',
              payload: {
                playerId: 'player1',
                cardIds: [],
                cardType: 'E',
                count: 1,
                source: 'card:E012',
                reason: 'Paperwork Snag: Player chose to discard Expeditor card'
              }
            }]
          },
          {
            label: 'Current filing takes 1 tick more time',
            effects: [{
              effectType: 'RESOURCE_CHANGE',
              payload: {
                playerId: 'player1',
                resource: 'TIME',
                amount: 1,
                source: 'card:E012',
                reason: 'Paperwork Snag: Player chose filing delay'
              }
            }]
          }
        ]
      }
    };

    const context: EffectContext = {
      source: 'Card Play',
      playerId: 'player1',
      triggerEvent: 'CARD_PLAY'
    };

    // Mock choice service to return option 1 (time delay)
    mockServices.choiceService.createChoice.mockResolvedValue('1');

    const result = await effectEngineService.processEffect(choiceEffect, context);

    expect(result.success).toBe(true);
    expect(mockServices.choiceService.createChoice).toHaveBeenCalledWith(
      'player1',
      'GENERAL',
      'Paperwork Snag: Choose one option',
      [
        { id: '0', label: 'Discard 1 Expeditor Card' },
        { id: '1', label: 'Current filing takes 1 tick more time' }
      ]
    );
  });

  it('should handle invalid choice option gracefully', async () => {
    const choiceEffect: Effect = {
      effectType: 'CHOICE_OF_EFFECTS',
      payload: {
        playerId: 'player1',
        prompt: 'Test prompt',
        options: [
          {
            label: 'Option 1',
            effects: []
          }
        ]
      }
    };

    const context: EffectContext = {
      source: 'Test',
      playerId: 'player1'
    };

    // Mock choice service to return invalid option index
    mockServices.choiceService.createChoice.mockResolvedValue('999');

    const result = await effectEngineService.processEffect(choiceEffect, context);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid choice option selected');
  });
});