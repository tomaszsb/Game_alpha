import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectEngineService } from '../../src/services/EffectEngineService';
import {
  IResourceService,
  ICardService,
  IChoiceService,
  IStateService,
  IMovementService,
  ITurnService,
  IGameRulesService,
  ITargetingService
} from '../../src/types/ServiceContracts';
import { Effect, EffectContext } from '../../src/types/EffectTypes';

describe('EffectEngineService', () => {
  let effectEngineService: EffectEngineService;
  let mockResourceService: any;
  let mockCardService: any;
  let mockChoiceService: any;
  let mockStateService: any;
  let mockMovementService: any;
  let mockTurnService: any;
  let mockGameRulesService: any;
  let mockTargetingService: any;

  beforeEach(() => {
    // Mock all dependencies
    mockResourceService = {
      adjustResource: vi.fn(),
      addMoney: vi.fn(),
      spendMoney: vi.fn(),
      canAfford: vi.fn(),
      addTime: vi.fn(),
      spendTime: vi.fn(),
      updateResources: vi.fn(),
      getResourceHistory: vi.fn(),
      validateResourceChange: vi.fn(),
      takeOutLoan: vi.fn(),
      applyInterest: vi.fn()
    };

    mockCardService = {
      canPlayCard: vi.fn(),
      isValidCardType: vi.fn(),
      playerOwnsCard: vi.fn(),
      playCard: vi.fn(),
      drawCards: vi.fn(),
      drawAndApplyCard: vi.fn(),
      discardCards: vi.fn(),
      removeCard: vi.fn(),
      replaceCard: vi.fn(),
      endOfTurn: vi.fn(),
      activateCard: vi.fn(),
      transferCard: vi.fn(),
      getCardType: vi.fn(),
      getPlayerCards: vi.fn(),
      getPlayerCardCount: vi.fn(),
      getCardToDiscard: vi.fn(),
      applyCardEffects: vi.fn(),
      finalizePlayedCard: vi.fn(),
      discardPlayedCard: vi.fn(),
      effectEngineService: {} as any,
      setEffectEngineService: vi.fn()
    };

    mockChoiceService = {
      createChoice: vi.fn(),
      resolveChoice: vi.fn(),
      getActiveChoice: vi.fn(),
      clearChoice: vi.fn()
    };

    mockStateService = {
      getGameState: vi.fn(),
      getGameStateDeepCopy: vi.fn(),
      isStateLoaded: vi.fn(),
      subscribe: vi.fn(),
      addPlayer: vi.fn(),
      updatePlayer: vi.fn(),
      removePlayer: vi.fn(),
      getPlayer: vi.fn(),
      getAllPlayers: vi.fn(),
      setCurrentPlayer: vi.fn(),
      setGamePhase: vi.fn(),
      advanceTurn: vi.fn(),
      nextPlayer: vi.fn(),
      initializeGame: vi.fn(),
      startGame: vi.fn(),
      endGame: vi.fn(),
      resetGame: vi.fn(),
      updateNegotiationState: vi.fn(),
      fixPlayerStartingSpaces: vi.fn(),
      forceResetAllPlayersToCorrectStartingSpace: vi.fn(),
      setAwaitingChoice: vi.fn(),
      clearAwaitingChoice: vi.fn(),
      setPlayerHasMoved: vi.fn(),
      clearPlayerHasMoved: vi.fn(),
      setPlayerCompletedManualAction: vi.fn(),
      setPlayerHasRolledDice: vi.fn(),
      clearPlayerCompletedManualActions: vi.fn(),
      clearPlayerHasRolledDice: vi.fn(),
      updateActionCounts: vi.fn(),
      clearTurnActions: vi.fn(),
      showCardModal: vi.fn(),
      dismissModal: vi.fn(),
      createPlayerSnapshot: vi.fn(),
      restorePlayerSnapshot: vi.fn(),
      validatePlayerAction: vi.fn(),
      canStartGame: vi.fn(),
      logToActionHistory: vi.fn(),
      savePreSpaceEffectSnapshot: vi.fn(),
      clearPreSpaceEffectSnapshot: vi.fn(),
      hasPreSpaceEffectSnapshot: vi.fn(),
      getPreSpaceEffectSnapshot: vi.fn(),
      setGameState: vi.fn(),
      updateGameState: vi.fn(),
      selectDestination: vi.fn()
    };

    mockMovementService = {
      getValidMoves: vi.fn(),
      movePlayer: vi.fn(),
      getDiceDestination: vi.fn(),
      handleMovementChoice: vi.fn()
    };

    mockTurnService = {
      canPlayerTakeTurn: vi.fn(),
      getCurrentPlayerTurn: vi.fn(),
      nextPlayer: vi.fn(),
      endTurn: vi.fn(),
      takeTurn: vi.fn(),
      rollDiceAndProcessEffects: vi.fn(),
      endTurnWithMovement: vi.fn(),
      setEffectEngineService: vi.fn(),
      processTurnEffects: vi.fn(),
      rollDice: vi.fn(),
      rollDiceWithFeedback: vi.fn(),
      rerollDice: vi.fn(),
      startTurn: vi.fn(),
      setTurnModifier: vi.fn()
    };

    mockGameRulesService = {
      isMoveValid: vi.fn(),
      canPlayCard: vi.fn(),
      canDrawCard: vi.fn(),
      canPlayerAfford: vi.fn(),
      isPlayerTurn: vi.fn(),
      isGameInProgress: vi.fn(),
      canPlayerTakeAction: vi.fn(),
      checkWinCondition: vi.fn(),
      calculateProjectScope: vi.fn(),
      evaluateCondition: vi.fn().mockReturnValue(true),
      calculatePlayerScore: vi.fn(),
      determineWinner: vi.fn(),
      checkTurnLimit: vi.fn(),
      checkGameEndConditions: vi.fn()
    };

    mockTargetingService = {
      getTargetPlayers: vi.fn(),
      applyEffectToTargets: vi.fn(),
      resolveTargetRule: vi.fn(),
      validateTargeting: vi.fn(),
      resolveTargets: vi.fn(),
      getTargetDescription: vi.fn()
    };

    // Instantiate the EffectEngineService with mocked dependencies
    effectEngineService = new EffectEngineService(
      mockResourceService,
      mockCardService,
      mockChoiceService,
      mockStateService,
      mockMovementService,
      mockTurnService,
      mockGameRulesService,
      mockTargetingService
    );
  });

  it('should process RESOURCE_CHANGE effect and call ResourceService', async () => {
    // Arrange - Create a sample ResourceChangeEffect
    const resourceChangeEffect: Effect = {
      effectType: 'RESOURCE_CHANGE',
      payload: {
        playerId: 'player1',
        resource: 'MONEY',
        amount: 100,
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the addMoney method to return success
    mockResourceService.addMoney.mockReturnValue(true);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(resourceChangeEffect, context);

    // Assert - Verify ResourceService.addMoney was called with correct parameters
    expect(mockResourceService.addMoney).toHaveBeenCalledTimes(1);
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player1', 100, 'test', 'Unit test');
    expect(result.success).toBe(true);
  });

  it('should process CARD_DRAW effect and call CardService', async () => {
    // Arrange - Create a sample CardDrawEffect
    const cardDrawEffect: Effect = {
      effectType: 'CARD_DRAW',
      payload: {
        playerId: 'player1',
        cardType: 'W',
        count: 2,
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the drawCards method to return success
    mockCardService.drawCards.mockReturnValue(['W_001', 'W_002']);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(cardDrawEffect, context);

    // Assert - Verify CardService.drawCards was called with correct parameters
    expect(mockCardService.drawCards).toHaveBeenCalledTimes(1);
    expect(mockCardService.drawCards).toHaveBeenCalledWith('player1', 'W', 2, 'test', 'Unit test');
    expect(result.success).toBe(true);
  });

  it('should process PLAYER_MOVEMENT effect and call MovementService', async () => {
    // Arrange - Create a sample PlayerMovementEffect
    const playerMovementEffect: Effect = {
      effectType: 'PLAYER_MOVEMENT',
      payload: {
        playerId: 'player1',
        destinationSpace: 'NEW-SPACE',
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the movePlayer method to return success
    mockMovementService.movePlayer.mockResolvedValue({ success: true });

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(playerMovementEffect, context);

    // Assert - Verify MovementService.movePlayer was called with correct parameters
    expect(mockMovementService.movePlayer).toHaveBeenCalledTimes(1);
    expect(mockMovementService.movePlayer).toHaveBeenCalledWith('player1', 'NEW-SPACE');
    expect(result.success).toBe(true);
  });

  it('should process TURN_CONTROL effect for skip turn and call StateService', async () => {
    // Arrange - Create a sample TurnControlEffect for SKIP_TURN
    const turnControlEffect: Effect = {
      effectType: 'TURN_CONTROL',
      payload: {
        action: 'SKIP_TURN',
        playerId: 'player1',
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the setTurnModifier method to return success
    mockTurnService.setTurnModifier.mockReturnValue(true);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(turnControlEffect, context);

    // Assert - Verify TurnService.setTurnModifier was called with correct parameters
    expect(mockTurnService.setTurnModifier).toHaveBeenCalledTimes(1);
    expect(mockTurnService.setTurnModifier).toHaveBeenCalledWith('player1', 'SKIP_TURN');
    expect(result.success).toBe(true);
  });

  it('should process TURN_CONTROL effect for grant re-roll and call StateService', async () => {
    // Arrange - Create a sample TurnControlEffect for GRANT_REROLL
    const turnControlEffect: Effect = {
      effectType: 'TURN_CONTROL',
      payload: {
        action: 'GRANT_REROLL',
        playerId: 'player1',
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the getPlayer method to return a player object
    const mockPlayer = {
      id: 'player1',
      name: 'Test Player',
      turnModifiers: { skipTurns: 0 }
    };
    mockStateService.getPlayer.mockReturnValue(mockPlayer);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(turnControlEffect, context);

    // Assert - Verify StateService.updatePlayer was called with correct parameters
    expect(mockStateService.updatePlayer).toHaveBeenCalledTimes(1);
    expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
      id: 'player1',
      turnModifiers: {
        skipTurns: 0,
        canReRoll: true
      }
    });
    expect(result.success).toBe(true);
  });

  it('should process CHOICE effect and call ChoiceService', async () => {
    // Arrange - Create a sample ChoiceEffect
    const choiceEffect: Effect = {
      effectType: 'CHOICE',
      payload: {
        id: 'test-choice-123',
        playerId: 'player1',
        type: 'GENERAL',
        prompt: 'Choose your action',
        options: [
          { id: 'option1', label: 'First Option' },
          { id: 'option2', label: 'Second Option' }
        ]
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the createChoice method to return a selection
    mockChoiceService.createChoice.mockResolvedValue('option1');

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(choiceEffect, context);

    // Assert - Verify ChoiceService.createChoice was called with correct parameters
    expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(1);
    expect(mockChoiceService.createChoice).toHaveBeenCalledWith(
      'player1',
      'GENERAL',
      'Choose your action',
      [
        { id: 'option1', label: 'First Option' },
        { id: 'option2', label: 'Second Option' }
      ]
    );
    expect(result.success).toBe(true);
  });

  it('should process CARD_DISCARD effect and call CardService', async () => {
    // Arrange - Create a sample CardDiscardEffect
    const cardDiscardEffect: Effect = {
      effectType: 'CARD_DISCARD',
      payload: {
        playerId: 'player1',
        cardIds: [], // Empty to trigger cardType/count logic
        cardType: 'W',
        count: 1,
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock the getPlayerCards method to return available cards
    mockCardService.getPlayerCards.mockReturnValue(['W_001', 'W_002']);

    // Mock the discardCards method to return success
    mockCardService.discardCards.mockResolvedValue(true);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(cardDiscardEffect, context);

    // Assert - Verify CardService methods were called with correct parameters
    expect(mockCardService.getPlayerCards).toHaveBeenCalledTimes(1);
    expect(mockCardService.getPlayerCards).toHaveBeenCalledWith('player1', 'W');

    expect(mockCardService.discardCards).toHaveBeenCalledTimes(1);
    expect(mockCardService.discardCards).toHaveBeenCalledWith('player1', ['W_001'], 'test', 'Unit test');

    expect(result.success).toBe(true);
  });

  it('should process EFFECT_GROUP_TARGETED effect and call TargetingService', async () => {
    // Arrange - Create a sample EffectGroupTargeted object
    const effectGroupTargetedEffect: Effect = {
      effectType: 'EFFECT_GROUP_TARGETED',
      payload: {
        targetType: 'ALL_OTHER_PLAYERS',
        templateEffect: {
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: 'PLACEHOLDER', // Will be replaced for each target
            resource: 'MONEY',
            amount: 50,
            source: 'group_effect',
            reason: 'Group bonus'
          }
        },
        prompt: 'Apply bonus to all other players',
        source: 'test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT'
    };

    // Mock getAllPlayers to return multiple players
    const mockPlayers = [
      { id: 'player1', name: 'Player 1' },
      { id: 'player2', name: 'Player 2' },
      { id: 'player3', name: 'Player 3' }
    ];
    mockStateService.getAllPlayers.mockReturnValue(mockPlayers);

    // Mock addMoney method to return success for resource changes
    mockResourceService.addMoney.mockReturnValue(true);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(effectGroupTargetedEffect, context);

    // Assert - Verify getAllPlayers was called to get targets
    expect(mockStateService.getAllPlayers).toHaveBeenCalledTimes(1);

    // Verify addMoney was called for each target player (excluding the source player)
    expect(mockResourceService.addMoney).toHaveBeenCalledTimes(2);
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player2', 50, 'group_effect', 'Group bonus');
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player3', 50, 'group_effect', 'Group bonus');

    expect(result.success).toBe(true);
  });

  it('should process CONDITIONAL_EFFECT and execute correct branch', async () => {
    // Arrange - Create a sample ConditionalEffect object with two branches
    const conditionalEffect: Effect = {
      effectType: 'CONDITIONAL_EFFECT',
      payload: {
        playerId: 'player1',
        condition: {
          type: 'DICE_ROLL',
          ranges: [
            {
              min: 1,
              max: 3,
              effects: [{
                effectType: 'RESOURCE_CHANGE',
                payload: {
                  playerId: 'player1',
                  resource: 'MONEY',
                  amount: 100,
                  source: 'low_roll',
                  reason: 'Low dice roll bonus'
                }
              }]
            },
            {
              min: 4,
              max: 6,
              effects: [{
                effectType: 'RESOURCE_CHANGE',
                payload: {
                  playerId: 'player1',
                  resource: 'MONEY',
                  amount: 200,
                  source: 'high_roll',
                  reason: 'High dice roll bonus'
                }
              }]
            }
          ]
        },
        source: 'test',
        reason: 'Unit test'
      }
    };

    const context: EffectContext = {
      source: 'Unit Test',
      playerId: 'player1',
      triggerEvent: 'TEST_EVENT',
      diceRoll: 2 // This should trigger the 1-3 range
    };

    // Mock addMoney method to return success
    mockResourceService.addMoney.mockReturnValue(true);

    // Act - Call processEffect with the sample effect and context
    const result = await effectEngineService.processEffect(conditionalEffect, context);

    // Assert - Verify the low roll effect (1-3 range) was processed
    expect(mockResourceService.addMoney).toHaveBeenCalledTimes(1);
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player1', 100, 'low_roll', 'Low dice roll bonus');

    // Verify the high roll effect (4-6 range) was NOT processed by checking call count
    expect(mockResourceService.addMoney).not.toHaveBeenCalledWith('player1', 200, 'high_roll', 'High dice roll bonus');

    expect(result.success).toBe(true);
  });

  describe('Duration-Based Effects', () => {
    let mockLoggingService: any;

    beforeEach(() => {
      // Add logging service mock
      mockLoggingService = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };

      // Create new service instance with logging service
      effectEngineService = new EffectEngineService(
        mockResourceService,
        mockCardService,
        mockChoiceService,
        mockStateService,
        mockMovementService,
        mockTurnService,
        mockGameRulesService,
        mockTargetingService,
        mockLoggingService
      );
    });

    it('should store duration effects when card has duration=Turns', async () => {
      // Arrange - Create effects and card data for duration processing
      const effects: Effect[] = [
        {
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: 'player1',
            resource: 'MONEY',
            amount: 100,
            source: 'L002',
            reason: 'Economic Downturn effect'
          }
        }
      ];

      const cardData = {
        card_id: 'L002',
        card_name: 'Economic Downturn',
        duration: 'Turns',
        duration_count: '3',
        target: 'All Players'
      };

      const context: EffectContext = {
        source: 'card:L002',
        playerId: 'player1',
        triggerEvent: 'CARD_PLAY'
      };

      // Mock player data with empty activeEffects
      const mockPlayer = {
        id: 'player1',
        name: 'Test Player',
        activeEffects: []
      };
      mockStateService.getPlayer.mockReturnValue(mockPlayer);

      // Mock game state for turn tracking
      mockStateService.getGameState.mockReturnValue({ turn: 5, players: [] });

      // Mock targeting service for multi-player effects
      mockTargetingService.resolveTargets.mockResolvedValue(['player1', 'player2']);
      mockTargetingService.getTargetDescription.mockReturnValue('All Players');

      // Act - Process effects with duration
      const result = await effectEngineService.processCardEffects(effects, context, cardData);

      // Assert - Verify effects were stored as active, not processed immediately
      expect(result.success).toBe(true);
      expect(result.totalEffects).toBe(2); // One effect for each target player
      expect(result.successfulEffects).toBe(2);
      expect(result.results.every(r => r.effectType === 'DURATION_STORED')).toBe(true);

      // Verify updatePlayer was called to store active effects
      expect(mockStateService.updatePlayer).toHaveBeenCalledTimes(2);

      // Resource service should NOT have been called for immediate processing
      expect(mockResourceService.addMoney).not.toHaveBeenCalled();
    });

    it('should apply active effects and decrement duration', async () => {
      // Arrange - Create player with existing active effects
      const activeEffect = {
        effectId: 'L002_effect_1',
        sourceCardId: 'L002',
        effectData: {
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: 'player1',
            resource: 'MONEY',
            amount: -50,
            source: 'L002',
            reason: 'Economic Downturn'
          }
        },
        remainingDuration: 2,
        startTurn: 3,
        effectType: 'RESOURCE_CHANGE',
        description: 'Effect from L002 (2 turns remaining)'
      };

      const mockPlayer = {
        id: 'player1',
        name: 'Test Player',
        activeEffects: [activeEffect]
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockResourceService.spendMoney.mockReturnValue(true);

      // Act - Apply active effects for the player
      await effectEngineService.applyActiveEffects('player1');

      // Assert - Verify effect was processed and duration decremented
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith('player1', 50, 'active:L002', 'Economic Downturn');

      // Verify player was updated with decremented duration
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        activeEffects: [{
          ...activeEffect,
          remainingDuration: 1,
          description: 'Effect from L002 (1 turns remaining)'
        }]
      });
    });

    it('should remove expired active effects', async () => {
      // Arrange - Create player with effect that will expire
      const expiredEffect = {
        effectId: 'L004_effect_1',
        sourceCardId: 'L004',
        effectData: {
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: 'player1',
            resource: 'TIME',
            amount: 4,
            source: 'L004',
            reason: 'Labor Strike - increased construction time'
          }
        },
        remainingDuration: 1, // Will expire after this turn
        startTurn: 5,
        effectType: 'RESOURCE_CHANGE',
        description: 'Effect from L004 (1 turns remaining)'
      };

      const continueEffect = {
        effectId: 'L002_effect_1',
        sourceCardId: 'L002',
        effectData: {
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: 'player1',
            resource: 'MONEY',
            amount: -25,
            source: 'L002',
            reason: 'Economic Downturn'
          }
        },
        remainingDuration: 2, // Will continue
        startTurn: 4,
        effectType: 'RESOURCE_CHANGE',
        description: 'Effect from L002 (2 turns remaining)'
      };

      const mockPlayer = {
        id: 'player1',
        name: 'Test Player',
        activeEffects: [expiredEffect, continueEffect]
      };

      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockResourceService.addTime.mockReturnValue(true);
      mockResourceService.spendMoney.mockReturnValue(true);

      // Act - Apply active effects
      await effectEngineService.applyActiveEffects('player1');

      // Assert - Verify both effects were processed
      expect(mockResourceService.addTime).toHaveBeenCalledWith('player1', 4, 'active:L004', 'Labor Strike - increased construction time');
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith('player1', 25, 'active:L002', 'Economic Downturn');

      // Verify only the continuing effect remains (expired effect removed)
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        activeEffects: [{
          ...continueEffect,
          remainingDuration: 1,
          description: 'Effect from L002 (1 turns remaining)'
        }]
      });
    });

    it('should process active effects for all players', async () => {
      // Arrange - Create multiple players with active effects
      const players = [
        {
          id: 'player1',
          name: 'Player 1',
          activeEffects: [{
            effectId: 'L022_effect_1',
            sourceCardId: 'L022',
            effectData: {
              effectType: 'RESOURCE_CHANGE',
              payload: {
                playerId: 'player1',
                resource: 'TIME',
                amount: -2,
                source: 'L022',
                reason: 'Economic Boom - faster construction'
              }
            },
            remainingDuration: 3,
            startTurn: 2,
            effectType: 'RESOURCE_CHANGE',
            description: 'Effect from L022 (3 turns remaining)'
          }]
        },
        {
          id: 'player2',
          name: 'Player 2',
          activeEffects: [{
            effectId: 'L020_effect_1',
            sourceCardId: 'L020',
            effectData: {
              effectType: 'RESOURCE_CHANGE',
              payload: {
                playerId: 'player2',
                resource: 'TIME',
                amount: 2,
                source: 'L020',
                reason: 'Building Code Update - slower inspections'
              }
            },
            remainingDuration: 1,
            startTurn: 4,
            effectType: 'RESOURCE_CHANGE',
            description: 'Effect from L020 (1 turns remaining)'
          }]
        }
      ];

      mockStateService.getGameState.mockReturnValue({
        players: players,
        turn: 5
      });

      // Mock individual getPlayer calls for each player
      mockStateService.getPlayer
        .mockReturnValueOnce(players[0])
        .mockReturnValueOnce(players[1]);

      mockResourceService.spendTime.mockReturnValue(true);
      mockResourceService.addTime.mockReturnValue(true);

      // Act - Process active effects for all players
      await effectEngineService.processActiveEffectsForAllPlayers();

      // Assert - Verify effects were processed for both players
      expect(mockResourceService.spendTime).toHaveBeenCalledWith('player1', 2, 'active:L022', 'Economic Boom - faster construction');
      expect(mockResourceService.addTime).toHaveBeenCalledWith('player2', 2, 'active:L020', 'Building Code Update - slower inspections');

      // Verify both players were updated
      expect(mockStateService.updatePlayer).toHaveBeenCalledTimes(2);
    });

    it('should handle effects with no duration immediately', async () => {
      // Arrange - Effects and card without duration
      const effects: Effect[] = [
        {
          effectType: 'RESOURCE_CHANGE',
          payload: {
            playerId: 'player1',
            resource: 'MONEY',
            amount: 200,
            source: 'I001',
            reason: 'Immediate investment return'
          }
        }
      ];

      const cardData = {
        card_id: 'I001',
        card_name: 'Investment Card',
        duration: null, // No duration
        duration_count: null,
        target: 'Self'
      };

      const context: EffectContext = {
        source: 'card:I001',
        playerId: 'player1',
        triggerEvent: 'CARD_PLAY'
      };

      mockResourceService.addMoney.mockReturnValue(true);

      // Act - Process effects without duration
      const result = await effectEngineService.processCardEffects(effects, context, cardData);

      // Assert - Verify effects were processed immediately, not stored
      expect(result.success).toBe(true);
      expect(mockResourceService.addMoney).toHaveBeenCalledWith('player1', 200, 'I001', 'Immediate investment return');

      // Verify no active effects were stored
      expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
    });

    it('should add active effect with correct metadata', async () => {
      // Arrange - Mock player and game state
      const mockPlayer = {
        id: 'player1',
        name: 'Test Player',
        activeEffects: []
      };
      mockStateService.getPlayer.mockReturnValue(mockPlayer);
      mockStateService.getGameState.mockReturnValue({ turn: 8 });

      const effect: Effect = {
        effectType: 'RESOURCE_CHANGE',
        payload: {
          playerId: 'player1',
          resource: 'MONEY',
          amount: -100,
          source: 'L030',
          reason: 'Cybersecurity Breach'
        }
      };

      // Act - Add active effect
      effectEngineService.addActiveEffect('player1', effect, 'L030', 2);

      // Assert - Verify updatePlayer was called with correct active effect
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
        id: 'player1',
        activeEffects: [{
          effectId: expect.stringMatching(/^L030_\d+_[a-z0-9]{9}$/),
          sourceCardId: 'L030',
          effectData: effect,
          remainingDuration: 2,
          startTurn: 8,
          effectType: 'RESOURCE_CHANGE',
          description: 'Effect from L030 (2 turns remaining)'
        }]
      });
    });
  });

  describe('Multi-Player Interactive Effects', () => {
    let mockLoggingService: any;
    let mockNegotiationService: any;

    beforeEach(() => {
      // Add logging service mock
      mockLoggingService = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      };

      // Add negotiation service mock
      mockNegotiationService = {
        initiateNegotiation: vi.fn(),
        makeOffer: vi.fn(),
        acceptOffer: vi.fn(),
        declineOffer: vi.fn(),
        cancelNegotiation: vi.fn(),
        completeNegotiation: vi.fn(),
        getActiveNegotiation: vi.fn(),
        hasActiveNegotiation: vi.fn()
      };

      // Create new service instance with all services
      effectEngineService = new EffectEngineService(
        mockResourceService,
        mockCardService,
        mockChoiceService,
        mockStateService,
        mockMovementService,
        mockTurnService,
        mockGameRulesService,
        mockTargetingService,
        mockLoggingService
      );

      // Set the negotiation service
      effectEngineService.setNegotiationService(mockNegotiationService);
    });

    it('should process INITIATE_NEGOTIATION effect successfully', async () => {
      // Arrange
      const effect: Effect = {
        effectType: 'INITIATE_NEGOTIATION',
        payload: {
          initiatorId: 'player1',
          targetPlayerIds: ['player2', 'player3'],
          negotiationType: 'CARD_EXCHANGE',
          context: {
            description: 'Propose card exchange with other players',
            requiresAgreement: true,
            offerData: { cardsOffered: ['W001'] },
            requestData: { cardsRequested: ['B001'] }
          },
          source: 'card:N001'
        }
      };

      const context: EffectContext = {
        source: 'card:N001',
        playerId: 'player1',
        triggerEvent: 'CARD_PLAY'
      };

      mockNegotiationService.initiateNegotiation.mockResolvedValue({
        success: true,
        message: 'Negotiation started successfully',
        negotiationId: 'nego_123',
        effects: []
      });

      // Act
      const result = await effectEngineService.processEffect(effect, context);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNegotiationService.initiateNegotiation).toHaveBeenCalledWith('player1', {
        type: 'CARD_EXCHANGE',
        targetPlayerIds: ['player2', 'player3'],
        context: {
          description: 'Propose card exchange with other players',
          requiresAgreement: true,
          offerData: { cardsOffered: ['W001'] },
          requestData: { cardsRequested: ['B001'] }
        },
        source: 'card:N001'
      });
    });

    it('should process NEGOTIATION_RESPONSE effect with ACCEPT', async () => {
      // Arrange
      const effect: Effect = {
        effectType: 'NEGOTIATION_RESPONSE',
        payload: {
          respondingPlayerId: 'player2',
          negotiationId: 'nego_123',
          response: 'ACCEPT',
          source: 'ui:negotiation_modal'
        }
      };

      const context: EffectContext = {
        source: 'ui:negotiation_modal',
        playerId: 'player2',
        triggerEvent: 'CARD_PLAY'
      };

      mockNegotiationService.acceptOffer.mockResolvedValue({
        success: true,
        message: 'Offer accepted successfully',
        effects: []
      });

      // Act
      const result = await effectEngineService.processEffect(effect, context);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNegotiationService.acceptOffer).toHaveBeenCalledWith('player2');
    });

    it('should process NEGOTIATION_RESPONSE effect with DECLINE', async () => {
      // Arrange
      const effect: Effect = {
        effectType: 'NEGOTIATION_RESPONSE',
        payload: {
          respondingPlayerId: 'player3',
          negotiationId: 'nego_123',
          response: 'DECLINE',
          source: 'ui:negotiation_modal'
        }
      };

      const context: EffectContext = {
        source: 'ui:negotiation_modal',
        playerId: 'player3',
        triggerEvent: 'CARD_PLAY'
      };

      mockNegotiationService.declineOffer.mockResolvedValue({
        success: true,
        message: 'Offer declined',
        effects: []
      });

      // Act
      const result = await effectEngineService.processEffect(effect, context);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNegotiationService.declineOffer).toHaveBeenCalledWith('player3');
    });

    it('should process NEGOTIATION_RESPONSE effect with COUNTER_OFFER', async () => {
      // Arrange
      const effect: Effect = {
        effectType: 'NEGOTIATION_RESPONSE',
        payload: {
          respondingPlayerId: 'player2',
          negotiationId: 'nego_123',
          response: 'COUNTER_OFFER',
          responseData: { cardsOffered: ['E001'], cardsRequested: ['W002'] },
          source: 'ui:negotiation_modal'
        }
      };

      const context: EffectContext = {
        source: 'ui:negotiation_modal',
        playerId: 'player2',
        triggerEvent: 'CARD_PLAY'
      };

      mockNegotiationService.makeOffer.mockResolvedValue({
        success: true,
        message: 'Counter-offer made successfully',
        effects: []
      });

      // Act
      const result = await effectEngineService.processEffect(effect, context);

      // Assert
      expect(result.success).toBe(true);
      expect(mockNegotiationService.makeOffer).toHaveBeenCalledWith('player2', {
        cardsOffered: ['E001'],
        cardsRequested: ['W002']
      });
    });

    it('should process PLAYER_AGREEMENT_REQUIRED effect successfully', async () => {
      // Arrange
      const effect: Effect = {
        effectType: 'PLAYER_AGREEMENT_REQUIRED',
        payload: {
          requesterPlayerId: 'player1',
          targetPlayerIds: ['player2', 'player3'],
          agreementType: 'RESOURCE_SHARE',
          agreementData: {
            resourceType: 'MONEY',
            amount: 50000,
            description: 'Emergency funding request'
          },
          prompt: 'Player 1 requests emergency funding. Do you agree to contribute $50,000?',
          source: 'card:emergency_fund'
        }
      };

      const context: EffectContext = {
        source: 'card:emergency_fund',
        playerId: 'player1',
        triggerEvent: 'CARD_PLAY'
      };

      // Mock player data
      const mockPlayer2 = { id: 'player2', name: 'Player 2' };
      const mockPlayer3 = { id: 'player3', name: 'Player 3' };

      mockStateService.getPlayer
        .mockReturnValueOnce(mockPlayer2)
        .mockReturnValueOnce(mockPlayer3);

      // Mock choice responses
      mockChoiceService.createChoice
        .mockResolvedValueOnce('accept')
        .mockResolvedValueOnce('decline');

      // Act
      const result = await effectEngineService.processEffect(effect, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.resultingEffects).toBeDefined();
      expect(result.resultingEffects).toHaveLength(1);

      expect(mockChoiceService.createChoice).toHaveBeenCalledTimes(2);
      expect(mockChoiceService.createChoice).toHaveBeenCalledWith(
        'player2',
        'GENERAL',
        'Player 1 requests emergency funding. Do you agree to contribute $50,000?',
        [
          { id: 'accept', label: 'Accept' },
          { id: 'decline', label: 'Decline' }
        ]
      );
    });

    it('should fail INITIATE_NEGOTIATION when NegotiationService is not available', async () => {
      // Arrange
      const effectWithoutNegotiationService = new EffectEngineService(
        mockResourceService,
        mockCardService,
        mockChoiceService,
        mockStateService,
        mockMovementService,
        mockTurnService,
        mockGameRulesService,
        mockTargetingService,
        mockLoggingService
      );
      // Don't set negotiation service

      const effect: Effect = {
        effectType: 'INITIATE_NEGOTIATION',
        payload: {
          initiatorId: 'player1',
          targetPlayerIds: ['player2'],
          negotiationType: 'CARD_EXCHANGE',
          context: {
            description: 'Test negotiation',
            requiresAgreement: true
          }
        }
      };

      const context: EffectContext = {
        source: 'test',
        playerId: 'player1',
        triggerEvent: 'CARD_PLAY'
      };

      // Act
      const result = await effectWithoutNegotiationService.processEffect(effect, context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('NegotiationService not available');
    });

    it('should create negotiation effects using helper methods', () => {
      // Test createNegotiationEffect
      const negotiationEffect = effectEngineService.createNegotiationEffect(
        'player1',
        ['player2', 'player3'],
        'RESOURCE_TRADE',
        {
          description: 'Trade resources for mutual benefit',
          requiresAgreement: true,
          offerData: { money: 100000 },
          requestData: { time: 10 }
        },
        'card:trade'
      );

      expect(negotiationEffect.effectType).toBe('INITIATE_NEGOTIATION');
      expect(negotiationEffect.payload.initiatorId).toBe('player1');
      expect(negotiationEffect.payload.negotiationType).toBe('RESOURCE_TRADE');

      // Test createPlayerAgreementEffect
      const agreementEffect = effectEngineService.createPlayerAgreementEffect(
        'player1',
        ['player2', 'player3'],
        'JOINT_ACTION',
        { actionType: 'shared_permit_filing' },
        'Do you want to join this permit filing?',
        'card:joint_permit'
      );

      expect(agreementEffect.effectType).toBe('PLAYER_AGREEMENT_REQUIRED');
      expect(agreementEffect.payload.agreementType).toBe('JOINT_ACTION');

      // Test createNegotiationResponseEffect
      const responseEffect = effectEngineService.createNegotiationResponseEffect(
        'player2',
        'nego_123',
        'ACCEPT',
        { finalTerms: 'agreed' },
        'ui:modal'
      );

      expect(responseEffect.effectType).toBe('NEGOTIATION_RESPONSE');
      expect(responseEffect.payload.response).toBe('ACCEPT');
    });
  });
});