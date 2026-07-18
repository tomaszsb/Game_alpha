import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { EffectEngineService } from '../../src/services/EffectEngineService';
import { FinancialEffectHandler } from '../../src/services/FinancialEffectHandler';
import { CardEffectHandler } from '../../src/services/CardEffectHandler';
import {
  IResourceService,
  ICardService,
  IChoiceService,
  IStateService,
  IMovementService,
  ITurnService,
  IGameRulesService,
  ITargetingService,
  ILoggingService
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
  let mockLoggingService: any;

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
      takeOutLoan: vi.fn()
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
      selectDestination: vi.fn(),
      updateTempState: vi.fn().mockReturnValue({ success: true }),
      emitGameEvent: vi.fn(),
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

    mockLoggingService = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      addLogEntry: vi.fn(),
      getLogEntries: vi.fn().mockReturnValue([]),
      clearLogs: vi.fn()
    };

    // Build handlers first, then pass through EffectEngineService constructor
    const financialEffectHandler = new FinancialEffectHandler(
      mockResourceService,
      mockStateService,
      mockGameRulesService,
      mockLoggingService
    );
    const cardEffectHandler = new CardEffectHandler(
      mockCardService,
      mockStateService,
      mockChoiceService,
      mockLoggingService
    );

    effectEngineService = new EffectEngineService(
      mockResourceService,
      mockCardService,
      mockChoiceService,
      mockStateService,
      mockMovementService,
      mockTurnService,
      mockGameRulesService,
      mockTargetingService,
      mockLoggingService,
      undefined,
      undefined,
      financialEffectHandler,
      cardEffectHandler
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
      triggerEvent: 'TEST_EVENT' as any
    };

    // Mock the addMoney method to return success
    mockResourceService.addMoney.mockReturnValue(true);

    // Act - Call processEffect with the sample effect
    const result = await effectEngineService.processEffect(resourceChangeEffect, context);

    // Assert - Verify ResourceService.addMoney was called with correct parameters
    expect(mockResourceService.addMoney).toHaveBeenCalledTimes(1);
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player1', 100, 'test', 'Unit test', 'other');
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
      triggerEvent: 'TEST_EVENT' as any
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
      triggerEvent: 'TEST_EVENT' as any
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
      triggerEvent: 'TEST_EVENT' as any
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
      triggerEvent: 'TEST_EVENT' as any
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
      triggerEvent: 'TEST_EVENT' as any
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
      triggerEvent: 'TEST_EVENT' as any
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
      triggerEvent: 'TEST_EVENT' as any
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
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player2', 50, 'group_effect', 'Group bonus', 'other');
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player3', 50, 'group_effect', 'Group bonus', 'other');

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
      triggerEvent: 'TEST_EVENT' as any,
      diceRoll: 2 // This should trigger the 1-3 range
    };

    // Mock addMoney method to return success
    mockResourceService.addMoney.mockReturnValue(true);

    // Act - Call processEffect with the sample effect and context
    const result = await effectEngineService.processEffect(conditionalEffect, context);

    // Assert - Verify the low roll effect (1-3 range) was processed
    expect(mockResourceService.addMoney).toHaveBeenCalledTimes(1);
    expect(mockResourceService.addMoney).toHaveBeenCalledWith('player1', 100, 'low_roll', 'Low dice roll bonus', 'other');

    // Verify the high roll effect (4-6 range) was NOT processed by checking call count
    expect(mockResourceService.addMoney).not.toHaveBeenCalledWith('player1', 200, 'high_roll', 'High dice roll bonus', 'other');

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

      // Build handlers first, then pass through EffectEngineService constructor
      const financialEffectHandler = new FinancialEffectHandler(
        mockResourceService,
        mockStateService,
        mockGameRulesService,
        mockLoggingService
      );
      const cardEffectHandler = new CardEffectHandler(
        mockCardService,
        mockStateService,
        mockChoiceService,
        mockLoggingService
      );

      effectEngineService = new EffectEngineService(
        mockResourceService,
        mockCardService,
        mockChoiceService,
        mockStateService,
        mockMovementService,
        mockTurnService,
        mockGameRulesService,
        mockTargetingService,
        mockLoggingService,
        undefined,
        undefined,
        financialEffectHandler,
        cardEffectHandler
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

      const cardData: any = {
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
      mockStateService.getGameState.mockReturnValue({ globalTurnCount: 5, players: [] });

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

      // Verify updateTempState was called to store active effects
      expect(mockStateService.updateTempState).toHaveBeenCalledTimes(2);

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
      // Mandatory life-event bill: allowNegative (6th arg) so an unpayable
      // charge drives bankruptcy rather than being silently dropped (v3.0.91).
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith('player1', 50, 'active:L002', 'Economic Downturn', undefined, true);

      // Verify player was updated via TEMP state with decremented duration
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        {
          activeEffects: [{
            ...activeEffect,
            remainingDuration: 1,
            description: 'Effect from L002 (1 turns remaining)'
          }]
        }
      );
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
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith('player1', 25, 'active:L002', 'Economic Downturn', undefined, true);

      // Verify only the continuing effect remains (expired effect removed)
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        {
          activeEffects: [{
            ...continueEffect,
            remainingDuration: 1,
            description: 'Effect from L002 (1 turns remaining)'
          }]
        }
      );
    });

    it('should process active effects only for the current (turn-ending) player, not every player', async () => {
      // v3.0.119 — maintainer ruling 2026-07-11 Option B: a duration effect
      // ticks only on the holder's own turn. Arrange two players with active
      // effects and process only player1's turn ending.
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
        globalTurnCount: 5
      });

      // v3.0.40: applyActiveEffects now calls getPlayer multiple times per
      // player (initial load + beforeFire snapshot + post-fire snapshot in
      // surfaceRecurringEffect). Use an argument-aware mock so the test is
      // robust to call-count changes.
      mockStateService.getPlayer.mockImplementation((id: string) =>
        players.find(p => p.id === id),
      );

      mockResourceService.spendTime.mockReturnValue(true);
      mockResourceService.addTime.mockReturnValue(true);

      // Act - Process active effects for player1's turn ending only
      await effectEngineService.processActiveEffectsForCurrentPlayer('player1');

      // Assert - player1's effect fired; player2's did NOT (their turn hasn't ended)
      expect(mockResourceService.spendTime).toHaveBeenCalledWith('player1', 2, 'active:L022', 'Economic Boom - faster construction');
      expect(mockResourceService.addTime).not.toHaveBeenCalledWith('player2', 2, 'active:L020', 'Building Code Update - slower inspections');

      // Only player1 was updated via TEMP state
      expect(mockStateService.updateTempState).toHaveBeenCalledTimes(1);
      expect(mockStateService.updateTempState).toHaveBeenCalledWith('player1', expect.anything());
    });

    it('does not mutate the live activeEffect object in place while decrementing duration', async () => {
      // v3.0.119 — remainingDuration used to be decremented via
      // `activeEffect.remainingDuration -= 1`, mutating the object referenced
      // directly by player.activeEffects (StateService doesn't deep-copy it).
      // Guard against a regression by asserting the original object handed
      // into state is untouched after processing.
      const originalEffect = {
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
      };
      const player = { id: 'player1', name: 'Player 1', activeEffects: [originalEffect] };

      mockStateService.getGameState.mockReturnValue({ players: [player], globalTurnCount: 5 });
      mockStateService.getPlayer.mockReturnValue(player);
      mockResourceService.spendTime.mockReturnValue(true);

      await effectEngineService.processActiveEffectsForCurrentPlayer('player1');

      expect(originalEffect.remainingDuration).toBe(3);
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

      const cardData: any = {
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
      expect(mockResourceService.addMoney).toHaveBeenCalledWith('player1', 200, 'I001', 'Immediate investment return', 'other');

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
      mockStateService.getGameState.mockReturnValue({ globalTurnCount: 8 });

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

      // Assert - Verify updateTempState was called with correct active effect
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        {
          activeEffects: [{
            effectId: expect.stringMatching(/^L030_\d+_[a-z0-9]{9}$/),
            sourceCardId: 'L030',
            effectData: effect,
            remainingDuration: 2,
            startTurn: 8,
            effectType: 'RESOURCE_CHANGE',
            description: 'Effect from L030 (2 turns remaining)'
          }]
        }
      );
    });
  });


  // Bug #2 Regression Tests: Conditional funding at OWNER-FUND-INITIATION
  // These are covered by:
  // 1. tests/data/space-effects-regression.test.ts - Validates CSV has correct conditions
  // 2. tests/services/GameRulesService.test.ts - Tests evaluateCondition logic
  // 3. User manual testing - Verified only one card (B or I) is drawn based on scope

  describe('FEE_DEDUCTION Effect Processing', () => {
    let mockLoggingService: any;

    beforeEach(() => {
      // Add logging service mock
      mockLoggingService = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        log: vi.fn(),
        startPerformanceTimer: vi.fn(),
        endPerformanceTimer: vi.fn(),
        startNewExplorationSession: vi.fn(),
        commitCurrentSession: vi.fn(),
        getCurrentSessionId: vi.fn(),
        cleanupAbandonedSessions: vi.fn()
      };

      // Build handlers first, then pass through EffectEngineService constructor
      const financialEffectHandler = new FinancialEffectHandler(
        mockResourceService,
        mockStateService,
        mockGameRulesService,
        mockLoggingService
      );
      const cardEffectHandler = new CardEffectHandler(
        mockCardService,
        mockStateService,
        mockChoiceService,
        mockLoggingService
      );

      effectEngineService = new EffectEngineService(
        mockResourceService,
        mockCardService,
        mockChoiceService,
        mockStateService,
        mockMovementService,
        mockTurnService,
        mockGameRulesService,
        mockTargetingService,
        mockLoggingService,
        undefined,
        undefined,
        financialEffectHandler,
        cardEffectHandler
      );
    });

    it('should deduct loan percentage fee based on tiered rates', async () => {
      // Arrange - Player with $1M loan (should get 1% fee = $10,000)
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'LOAN_TIERED',
          feeDescription: '1% for loan of up to $1.4M or 2% for loan between $1.5M and 2.75M or 3% above 2.75M',
          source: 'space:BANK-FUND-REVIEW',
          reason: 'Bank fund review fee'
        }
      };

      const context: EffectContext = {
        source: 'space:BANK-FUND-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      // Mock player with loan
      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        money: 100000, // Has enough money to pay the fee
        loans: [{ id: 'loan1', principal: 1000000, interestRate: 0.05, startTurn: 1 }]
      });

      mockResourceService.canAfford.mockReturnValue(true);
      mockResourceService.spendMoney.mockReturnValue(true);

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - 1% of $1M = $10,000
      expect(result.success).toBe(true);
      expect(mockResourceService.canAfford).toHaveBeenCalledWith('player1', 10000);
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        10000,
        'space:BANK-FUND-REVIEW',
        expect.any(String)
      );
      expect(mockLoggingService.info).toHaveBeenCalled();
    });

    it('should deduct higher tier fee for large loans', async () => {
      // Arrange - Player with $2M loan (should get 2% fee = $40,000)
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'LOAN_TIERED',
          feeDescription: '1% for loan of up to $1.4M or 2% for loan between $1.5M and 2.75M or 3% above 2.75M',
          source: 'space:BANK-FUND-REVIEW',
          reason: 'Bank fund review fee'
        }
      };

      const context: EffectContext = {
        source: 'space:BANK-FUND-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        money: 100000, // Has enough money to pay the fee
        loans: [{ id: 'loan1', principal: 2000000, interestRate: 0.05, startTurn: 1 }]
      });

      mockResourceService.canAfford.mockReturnValue(true);
      mockResourceService.spendMoney.mockReturnValue(true);

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - 2% of $2M = $40,000
      expect(result.success).toBe(true);
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        40000,
        'space:BANK-FUND-REVIEW',
        expect.any(String)
      );
    });

    it('should deduct fixed percentage fee', async () => {
      // Arrange - Player with $500K loan at 5% fee = $25,000
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'LOAN_PERCENTAGE',
          feeDescription: '5% of amount borrowed',
          source: 'space:INVESTOR-FUND-REVIEW',
          reason: 'Investor fee'
        }
      };

      const context: EffectContext = {
        source: 'space:INVESTOR-FUND-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        money: 50000, // Has enough money to pay the fee
        loans: [{ id: 'loan1', principal: 500000, interestRate: 0.08, startTurn: 1 }]
      });

      mockResourceService.canAfford.mockReturnValue(true);
      mockResourceService.spendMoney.mockReturnValue(true);

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - 5% of $500K = $25,000
      expect(result.success).toBe(true);
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        25000,
        'space:INVESTOR-FUND-REVIEW',
        expect.any(String)
      );
    });

    it('should skip fee when player has no loans', async () => {
      // Arrange - Player with no loans
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'LOAN_PERCENTAGE',
          feeDescription: '1% for loan of up to $1.4M',
          source: 'space:BANK-FUND-REVIEW',
          reason: 'Bank fund review fee'
        }
      };

      const context: EffectContext = {
        source: 'space:BANK-FUND-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        loans: [] // No loans
      });

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - No fee deducted
      expect(result.success).toBe(true);
      expect(mockResourceService.spendMoney).not.toHaveBeenCalled();
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.stringContaining('No loan to charge against'),
        expect.any(Object)
      );
    });

    it('should handle dice-based fee gracefully', async () => {
      // Arrange - Dice-based fee
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'DICE_BASED',
          feeDescription: 'Based on dice roll',
          source: 'space:REG-DOB-FEE-REVIEW',
          reason: 'Dice-based fee'
        }
      };

      const context: EffectContext = {
        source: 'space:REG-DOB-FEE-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        loans: [{ id: 'loan1', principal: 1000000, interestRate: 0.05, startTurn: 1 }]
      });

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - Logged as pending, no deduction
      expect(result.success).toBe(true);
      expect(mockResourceService.spendMoney).not.toHaveBeenCalled();
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.stringContaining('awaiting outcome'),
        expect.any(Object)
      );
    });

    it('should sum multiple loans for fee calculation', async () => {
      // Arrange - Player with multiple loans totaling $1.5M (2% tier = $30,000)
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'LOAN_TIERED',
          feeDescription: '1% for loan of up to $1.4M or 2% for loan between $1.5M and 2.75M or 3% above 2.75M',
          source: 'space:BANK-FUND-REVIEW',
          reason: 'Bank fund review fee'
        }
      };

      const context: EffectContext = {
        source: 'space:BANK-FUND-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        money: 100000, // Has enough money to pay the fee
        loans: [
          { id: 'loan1', principal: 1000000, interestRate: 0.05, startTurn: 1 },
          { id: 'loan2', principal: 500000, interestRate: 0.05, startTurn: 2 }
        ]
      });

      mockResourceService.canAfford.mockReturnValue(true);
      mockResourceService.spendMoney.mockReturnValue(true);

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - 2% of $1.5M = $30,000
      expect(result.success).toBe(true);
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        30000,
        'space:BANK-FUND-REVIEW',
        expect.any(String)
      );
    });

    it('should fail when player cannot afford the fee', async () => {
      // Arrange - Player with $1M loan but not enough money to pay fee
      const feeEffect: Effect = {
        effectType: 'FEE_DEDUCTION',
        payload: {
          playerId: 'player1',
          feeType: 'LOAN_TIERED',
          feeDescription: '1% for loan of up to $1.4M or 2% for loan between $1.5M and 2.75M or 3% above 2.75M',
          source: 'space:BANK-FUND-REVIEW',
          reason: 'Bank fund review fee'
        }
      };

      const context: EffectContext = {
        source: 'space:BANK-FUND-REVIEW',
        playerId: 'player1',
        triggerEvent: 'SPACE_ENTRY'
      };

      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        name: 'Test Player',
        money: 5000, // Only has $5,000 but fee is $10,000
        loans: [{ id: 'loan1', principal: 1000000, interestRate: 0.05, startTurn: 1 }]
      });

      mockResourceService.canAfford.mockReturnValue(false);

      // Act
      const result = await effectEngineService.processEffect(feeEffect, context);

      // Assert - Should fail because player cannot afford
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient funds');
      expect(mockResourceService.canAfford).toHaveBeenCalledWith('player1', 10000);
      expect(mockResourceService.spendMoney).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('insufficient funds'),
        expect.any(Object)
      );
    });
  });

  describe('CONTRACTOR_UPDATE (CON-INITIATION dice)', () => {
    // Regression for fb:0520fd41. Pre-fix, Quality/Multiplier dice rows fell
    // into EffectFactory's default case and emitted no effects — the whole
    // contractor mechanic was silently dead. These tests pin both ends:
    // (a) the player.contractor field actually gets written
    // (b) Multiplier triggers immediate construction-cost deduction
    const ctx: EffectContext = {
      source: 'dice_roll',
      playerId: 'player1',
      triggerEvent: 'DICE_ROLL' as any,
    };

    it('quality update sets player.contractor.quality from the rolled value', async () => {
      mockStateService.getPlayer.mockReturnValue({
        id: 'player1',
        currentSpace: 'CON-INITIATION',
        contractor: undefined
      });

      const effect: Effect = {
        effectType: 'CONTRACTOR_UPDATE',
        payload: { playerId: 'player1', kind: 'quality', value: 'HIGH', source: 'dice_roll' }
      };

      const result = await effectEngineService.processEffect(effect, ctx);

      expect(result.success).toBe(true);
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'player1',
          contractor: expect.objectContaining({ quality: 'HIGH', hiredAt: 'CON-INITIATION' })
        })
      );
    });

    it('quality update normalizes case (medium → MED, mixed-case input safe)', async () => {
      mockStateService.getPlayer.mockReturnValue({
        id: 'player1', currentSpace: 'CON-INITIATION', contractor: undefined
      });

      const effect: Effect = {
        effectType: 'CONTRACTOR_UPDATE',
        payload: { playerId: 'player1', kind: 'quality', value: 'medium' }
      };

      await effectEngineService.processEffect(effect, ctx);

      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ contractor: expect.objectContaining({ quality: 'MED' }) })
      );
    });

    it('multiplier update saves the multiplier AND deducts construction cost', async () => {
      // Player exists with MED quality already; total work cost is $1M.
      // v3.0.92 terms: price = 1_000_000 × (0.7 + 3×0.1) × 1.0 = 1_000_000
      // (bid centered on the estimate), schedule = 3 × 10 × 1.0 = 30 days.
      const playerInitial = {
        id: 'player1',
        currentSpace: 'CON-INITIATION',
        contractor: { quality: 'MED' as const, multiplier: 1 },
        expenditures: { construction: 0 }
      };
      const playerAfterContractorWrite = {
        ...playerInitial,
        contractor: { quality: 'MED' as const, multiplier: 3, hiredAt: 'CON-INITIATION' }
      };

      // First call (read before write) → initial; second call (after updatePlayer) → updated
      mockStateService.getPlayer
        .mockReturnValueOnce(playerInitial)
        .mockReturnValueOnce(playerAfterContractorWrite)
        .mockReturnValue(playerAfterContractorWrite);

      mockGameRulesService.calculateTotalWorkCost = vi.fn().mockReturnValue(1_000_000);
      mockResourceService.spendMoney.mockReturnValue(true);
      mockStateService.getGameState.mockReturnValue({ globalTurnCount: 4, players: [] });

      const effect: Effect = {
        effectType: 'CONTRACTOR_UPDATE',
        payload: { playerId: 'player1', kind: 'multiplier', value: '3' }
      };

      const result = await effectEngineService.processEffect(effect, ctx);

      expect(result.success).toBe(true);
      expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
        expect.objectContaining({ contractor: expect.objectContaining({ multiplier: 3 }) })
      );
      // allowNegative: the signing charge is a mandatory bill — an unpayable
      // contract charges into the red and bankrupts (v3.0.91 rule extended).
      expect(mockResourceService.spendMoney).toHaveBeenCalledWith(
        'player1',
        1_000_000,
        expect.anything(),
        expect.stringContaining('Contractor hired'),
        undefined,
        true
      );
      // The crew's schedule lands as real days (v3.0.92 — "I want time to vary too").
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1',
        30,
        expect.anything(),
        expect.stringContaining('Construction schedule')
      );
      // Construction cost is recorded via TEMP state (survives turn-commit) with
      // both the expenditures bump and a costHistory entry (feeds end-game Total Spent).
      expect(mockStateService.updateTempState).toHaveBeenCalledWith(
        'player1',
        expect.objectContaining({
          expenditures: expect.objectContaining({ construction: 1_000_000 }),
          costHistory: expect.arrayContaining([
            expect.objectContaining({ category: 'construction', amount: 1_000_000 })
          ])
        })
      );
      // The agreed terms ride back on the result so the dice modal can show
      // the dollar figure + schedule, not just "3×" (fb:40caa223).
      expect(result.data).toEqual({ constructionCost: 1_000_000, scheduleDays: 30 });
    });

    it('multiplier does NOT record the expenditure when the charge fails (ledger-vs-cash guard)', async () => {
      // spendMoney refusing (can't afford) must not book the cost anyway —
      // that would be the fb:f0bdd78a "ledger says spent, cash didn't move"
      // mismatch all over again, and no agreed price should be displayed.
      // The schedule still lands: the work takes the time it takes.
      const player = {
        id: 'player1',
        currentSpace: 'CON-INITIATION',
        contractor: { quality: 'MED' as const, multiplier: 1 },
        expenditures: { construction: 0 }
      };
      mockStateService.getPlayer.mockReturnValue(player);
      mockGameRulesService.calculateTotalWorkCost = vi.fn().mockReturnValue(1_000_000);
      mockResourceService.spendMoney.mockReturnValue(false);

      const effect: Effect = {
        effectType: 'CONTRACTOR_UPDATE',
        payload: { playerId: 'player1', kind: 'multiplier', value: '3' }
      };

      const result = await effectEngineService.processEffect(effect, ctx);

      expect(result.success).toBe(true);
      expect(mockStateService.updateTempState).not.toHaveBeenCalled();
      // (The static getPlayer mock never applies the multiplier write, so the
      // engine reads the pre-existing 1× → 10 days. The point here is only
      // that the schedule lands while the expenditure does not.)
      expect(mockResourceService.addTime).toHaveBeenCalledWith(
        'player1', 10, expect.anything(), expect.stringContaining('Construction schedule')
      );
      expect(result.data).toEqual({ constructionCost: 0, scheduleDays: 10 });
    });

    it('multiplier with no work cost skips spendMoney (no-op until W cards exist)', async () => {
      const player = {
        id: 'player1',
        currentSpace: 'CON-INITIATION',
        contractor: { quality: 'MED' as const, multiplier: 1 },
        expenditures: { construction: 0 }
      };
      mockStateService.getPlayer.mockReturnValue(player);
      mockGameRulesService.calculateTotalWorkCost = vi.fn().mockReturnValue(0);

      const effect: Effect = {
        effectType: 'CONTRACTOR_UPDATE',
        payload: { playerId: 'player1', kind: 'multiplier', value: '6' }
      };

      const result = await effectEngineService.processEffect(effect, ctx);

      expect(result.success).toBe(true);
      expect(mockResourceService.spendMoney).not.toHaveBeenCalled();
    });
  });
});

// v3.0.40 — multi-turn duration cards (Kid C: L002 / L004 / L008) re-fire each
// turn via EffectEngineService.applyActiveEffects. Without these reminders the
// player only sees the resource line in the log with no narrative tie back to
// the card. surfaceRecurringEffect (private, exercised via applyActiveEffects)
// emits a notification + log entry per re-fire.
describe('EffectEngineService.applyActiveEffects — recurring-effect surfacing (v3.0.40)', () => {
  let service: EffectEngineService;
  let mockNotificationService: any;
  let mockLoggingService: any;
  let mockDataService: any;
  let mockStateService: any;
  let beforePlayer: any;
  let afterPlayer: any;

  beforeEach(() => {
    // The active effect re-fires through processEffect → FinancialEffectHandler.
    // For this test we don't care that the effect actually runs — we just need
    // applyActiveEffects to call its surfaceRecurringEffect helper. Mock
    // processEffect on the engine instance after construction.

    mockNotificationService = { notify: vi.fn() };
    mockLoggingService = {
      log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(),
      addLogEntry: vi.fn(), getLogEntries: vi.fn().mockReturnValue([]), clearLogs: vi.fn(),
    };
    mockDataService = {
      getCardById: vi.fn().mockReturnValue({
        card_id: 'L002',
        card_name: 'Sick Kid',
        card_type: 'L',
        description: 'Your kid is sick. Pay for medical bills.',
      }),
    };

    beforePlayer = {
      id: 'p1', name: 'Alice', money: 100000, timeSpent: 0,
      activeEffects: [
        {
          effectId: 'ae-1',
          sourceCardId: 'L002',
          remainingDuration: 3,
          effectData: {
            effectType: 'RESOURCE_CHANGE',
            payload: { playerId: 'p1', resource: 'MONEY', amount: -2000, source: 'card:L002' },
          },
        },
      ],
    };

    // After processEffect the money has dropped $2,000.
    afterPlayer = { ...beforePlayer, money: 98000 };

    mockStateService = {
      getPlayer: vi.fn(),
      updateTempState: vi.fn(),
      getGameState: vi.fn().mockReturnValue({ players: [beforePlayer] }),
      emitGameEvent: vi.fn(),
    };

    // First getPlayer call inside applyActiveEffects loads the player (returns
    // beforePlayer). Second call inside surfaceRecurringEffect (after the
    // processEffect mock has "run") returns afterPlayer. Subsequent calls
    // return afterPlayer too.
    mockStateService.getPlayer
      .mockReturnValueOnce(beforePlayer)
      .mockReturnValueOnce(beforePlayer) // captured for moneyBefore snapshot
      .mockReturnValue(afterPlayer);

    service = new EffectEngineService(
      { adjustResource: vi.fn(), addMoney: vi.fn(), spendMoney: vi.fn(), canAfford: vi.fn(), addTime: vi.fn(), spendTime: vi.fn(), updateResources: vi.fn(), getResourceHistory: vi.fn(), validateResourceChange: vi.fn(), takeOutLoan: vi.fn() } as any,
      { setEffectEngineService: vi.fn() } as any,
      { createChoice: vi.fn(), resolveChoice: vi.fn(), getActiveChoice: vi.fn(), clearChoice: vi.fn() } as any,
      mockStateService,
      { getValidMoves: vi.fn(), movePlayer: vi.fn(), getDiceDestination: vi.fn(), handleMovementChoice: vi.fn() } as any,
      { setEffectEngineService: vi.fn() } as any,
      { calculateProjectScope: vi.fn() } as any,
      { getTargetPlayers: vi.fn(), resolveTargets: vi.fn() } as any,
      mockLoggingService,
      mockDataService,
      mockNotificationService,
    );

    // Skip the real downstream effect processing — we only care that the
    // surface helper fires with the correct deltas.
    (service as any).processEffect = vi.fn().mockResolvedValue({ success: true, effectType: 'RESOURCE_CHANGE' });
  });

  // Domain-event stage 3: surfaceRecurringEffect now emits ONE
  // 'recurring_card_effect_applied' GameEvent instead of separately calling
  // notificationService.notify + loggingService.info — LogWriter/ToastWriter
  // (unit-tested independently) derive the toast/log entry from it.
  it('emits a recurring_card_effect_applied event naming the source card and the delta', async () => {
    await service.applyActiveEffects('p1');

    expect(mockStateService.emitGameEvent).toHaveBeenCalled();
    const [event] = mockStateService.emitGameEvent.mock.calls[0];
    expect(event.type).toBe('recurring_card_effect_applied');
    expect(event.headline).toMatch(/Sick Kid/);
    expect(event.headline).toMatch(/-\$2,000/);
  });

  it('carries the fields LogWriter needs to tie the resource change back to the card', async () => {
    await service.applyActiveEffects('p1');

    const [event] = mockStateService.emitGameEvent.mock.calls[0];
    expect(event.headline).toMatch(/Sick Kid/);
    expect(event.headline).toMatch(/-\$2,000/);
    expect(event.sourceCardId).toBe('L002');
    expect(event.moneyDelta).toBe(-2000);
  });

  it('says "more turns to go" when remainingDuration > 0 after decrement', async () => {
    // remainingDuration starts at 3, decrements to 2 → "2 more turns to go".
    await service.applyActiveEffects('p1');

    const [event] = mockStateService.emitGameEvent.mock.calls[0];
    expect(event.headline).toMatch(/2 more turns to go/);
  });

  it('says "last one" when this re-fire was the final turn', async () => {
    // Set duration to 1 so it decrements to 0.
    beforePlayer.activeEffects[0].remainingDuration = 1;

    await service.applyActiveEffects('p1');

    const [event] = mockStateService.emitGameEvent.mock.calls[0];
    expect(event.headline).toMatch(/last one/i);
  });

  it('skips the surface helper entirely when there is no money/time delta', async () => {
    // afterPlayer money == beforePlayer money → moneyDelta=0, timeDelta=0.
    afterPlayer.money = beforePlayer.money;
    mockStateService.getPlayer
      .mockReset()
      .mockReturnValueOnce(beforePlayer)
      .mockReturnValueOnce(beforePlayer)
      .mockReturnValue(afterPlayer);

    await service.applyActiveEffects('p1');

    expect(mockStateService.emitGameEvent).not.toHaveBeenCalled();
  });
});

// v3.0.41 — Kid C follow-up: apply-time phase gate. The v3.0.39 N×N fix
// emitted ONE effect at parser time for global+duration cards (L002/L004/
// L008) and let the engine fan it across players — but in doing so, the
// parser-side affected_phase filter was bypassed for L004 (CONSTRUCTION-
// only). These tests pin the new gate at applyActiveEffects.
describe('EffectEngineService.applyActiveEffects — Kid C apply-time phase gate (v3.0.41)', () => {
  let service: EffectEngineService;
  let mockStateService: any;
  let mockDataService: any;
  // Fresh per test — applyActiveEffects mutates remainingDuration on the
  // activeEffect object, so a shared fixture leaks state between tests.
  let playerInConstruction: any;
  let playerInDesign: any;

  beforeEach(() => {
    playerInConstruction = {
      id: 'p1', name: 'Alice', money: 100000, timeSpent: 0, currentSpace: 'CON-INITIATION',
      activeEffects: [
        {
          effectId: 'l004',
          sourceCardId: 'L004',
          remainingDuration: 3,
          effectData: {
            effectType: 'RESOURCE_CHANGE',
            payload: { playerId: 'p1', resource: 'TIME', amount: 2, source: 'card:L004', requiredPhase: 'CONSTRUCTION' },
          },
        },
      ],
    };
    playerInDesign = { ...playerInConstruction, currentSpace: 'ARCH-INITIATION' };
    mockDataService = {
      getCardById: vi.fn().mockReturnValue({ card_id: 'L004', card_name: 'CON Delay', card_type: 'L' }),
      getGameConfigBySpace: vi.fn((space: string) => {
        if (space === 'CON-INITIATION') return { phase: 'CONSTRUCTION' };
        if (space === 'ARCH-INITIATION') return { phase: 'DESIGN' };
        return undefined;
      }),
    };
    mockStateService = {
      getPlayer: vi.fn(),
      updateTempState: vi.fn(),
      getGameState: vi.fn(),
      emitGameEvent: vi.fn(),
    };

    service = new EffectEngineService(
      { adjustResource: vi.fn(), addMoney: vi.fn(), spendMoney: vi.fn(), canAfford: vi.fn(), addTime: vi.fn(), spendTime: vi.fn(), updateResources: vi.fn(), getResourceHistory: vi.fn(), validateResourceChange: vi.fn(), takeOutLoan: vi.fn() } as any,
      { setEffectEngineService: vi.fn() } as any,
      { createChoice: vi.fn(), resolveChoice: vi.fn(), getActiveChoice: vi.fn(), clearChoice: vi.fn() } as any,
      mockStateService,
      { getValidMoves: vi.fn(), movePlayer: vi.fn(), getDiceDestination: vi.fn(), handleMovementChoice: vi.fn() } as any,
      { setEffectEngineService: vi.fn() } as any,
      { calculateProjectScope: vi.fn() } as any,
      { getTargetPlayers: vi.fn(), resolveTargets: vi.fn() } as any,
      { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), addLogEntry: vi.fn(), getLogEntries: vi.fn().mockReturnValue([]), clearLogs: vi.fn() } as any,
      mockDataService,
      { notify: vi.fn() } as any,
    );

    // Capture processEffect so we can assert whether it fired this turn.
    (service as any).processEffect = vi.fn().mockResolvedValue({ success: true, effectType: 'RESOURCE_CHANGE' });
  });

  it('FIRES the active effect when the player IS in the required phase', async () => {
    mockStateService.getPlayer.mockReturnValue(playerInConstruction);

    await service.applyActiveEffects('p1');

    expect((service as any).processEffect).toHaveBeenCalledTimes(1);
    // The effect ticked, so remainingDuration drops from 3 to 2 and the
    // updated active-effects list is written through updateTempState.
    const update = mockStateService.updateTempState.mock.calls[0][1];
    expect(update.activeEffects).toHaveLength(1);
    expect(update.activeEffects[0].remainingDuration).toBe(2);
  });

  it('SKIPS the apply when the player is OUTSIDE the required phase (L004 DESIGN-phase player)', async () => {
    mockStateService.getPlayer.mockReturnValue(playerInDesign);

    await service.applyActiveEffects('p1');

    // Effect did NOT fire — processEffect was not called.
    expect((service as any).processEffect).not.toHaveBeenCalled();
  });

  it('PRESERVES the duration on skip (does not silently burn turns while out-of-phase)', async () => {
    mockStateService.getPlayer.mockReturnValue(playerInDesign);

    await service.applyActiveEffects('p1');

    // The effect must remain in active effects, with its duration intact, so
    // the player still owes the gated tick once they re-enter CONSTRUCTION.
    const update = mockStateService.updateTempState.mock.calls[0][1];
    expect(update.activeEffects).toHaveLength(1);
    expect(update.activeEffects[0].remainingDuration).toBe(3);
  });

  it('applies normally when requiredPhase is undefined (no gate — back-compat with L002/L008)', async () => {
    const ungatedPlayer = {
      ...playerInDesign,
      activeEffects: [
        {
          effectId: 'l002',
          sourceCardId: 'L002',
          remainingDuration: 2,
          effectData: {
            effectType: 'RESOURCE_CHANGE',
            payload: { playerId: 'p1', resource: 'MONEY', amount: -1000, source: 'card:L002' /* no requiredPhase */ },
          },
        },
      ],
    };
    mockStateService.getPlayer.mockReturnValue(ungatedPlayer);

    await service.applyActiveEffects('p1');

    expect((service as any).processEffect).toHaveBeenCalledTimes(1);
  });
});
