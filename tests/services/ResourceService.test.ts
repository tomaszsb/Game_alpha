import { describe, it, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResourceService } from '../../src/services/ResourceService';
import { IStateService, ResourceChange, ResourceValidation } from '../../src/types/ServiceContracts';
import { Player, GameState } from '../../src/types/StateTypes';
import { createMockStateService } from '../mocks/mockServices';

describe('ResourceService', () => {
  let resourceService: ResourceService;
  let mockStateService: any;
  
  const mockPlayer: Player = {
    id: 'player1',
    name: 'Test Player',
    currentSpace: 'TEST-SPACE',
    visitType: 'First',
    money: 1000,
    timeSpent: 5,
    projectScope: 0,
    score: 0,
    hand: [],
    activeCards: [],
    turnModifiers: { skipTurns: 0 },
    activeEffects: [],
    loans: []
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockStateService = createMockStateService();
    mockStateService.getPlayer.mockReturnValue(mockPlayer);
    mockStateService.updatePlayer.mockReturnValue({} as any); // Mock return value
    
    resourceService = new ResourceService(mockStateService);
  });

  describe('Money Operations', () => {
    describe('addMoney', () => {
      it('should add money successfully with valid amount', () => {
        const result = resourceService.addMoney('player1', 500, 'test:add_money', 'Test addition');

        expect(result).toBe(true);
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 1500,
          timeSpent: 5,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 500
          }
        });
      });

      it('should fail with invalid amount (zero)', () => {
        const result = resourceService.addMoney('player1', 0, 'test:add_money');
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail with invalid amount (negative)', () => {
        const result = resourceService.addMoney('player1', -100, 'test:add_money');
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });
    });

    describe('spendMoney', () => {
      it('should spend money successfully when player has enough funds', () => {
        const result = resourceService.spendMoney('player1', 300, 'test:spend_money', 'Test spending');

        expect(result).toBe(true);
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 700,
          timeSpent: 5,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 0
          }
        });
      });

      it('should fail when player has insufficient funds', () => {
        const result = resourceService.spendMoney('player1', 1500, 'test:spend_money');
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail with invalid amount (zero)', () => {
        const result = resourceService.spendMoney('player1', 0, 'test:spend_money');
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });
    });

    describe('canAfford', () => {
      it('should return true when player can afford the amount', () => {
        const result = resourceService.canAfford('player1', 800);
        expect(result).toBe(true);
      });

      it('should return false when player cannot afford the amount', () => {
        const result = resourceService.canAfford('player1', 1200);
        expect(result).toBe(false);
      });

      it('should throw an error when player is not found', () => {
        mockStateService.getPlayer.mockReturnValue(undefined);
        expect(() => resourceService.canAfford('nonexistent', 100)).toThrow(/Player nonexistent not found/);
      });
    });
  });

  describe('Time Operations', () => {
    describe('addTime', () => {
      it('should add time successfully', () => {
        resourceService.addTime('player1', 3, 'test:add_time', 'Test time addition');

        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 1000,
          timeSpent: 8,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 0
          }
        });
      });
    });

    describe('spendTime', () => {
      it('should spend time successfully', () => {
        resourceService.spendTime('player1', 2, 'test:spend_time', 'Test time spending');

        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 1000,
          timeSpent: 3,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 0
          }
        });
      });

      it('should prevent time from going negative', () => {
        resourceService.spendTime('player1', 10, 'test:spend_time', 'Excessive time spending');

        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 1000,
          timeSpent: 0,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 0
          }
        });
      });
    });
  });

  describe('Combined Operations', () => {
    describe('updateResources', () => {
      it('should update both money and time', () => {
        const changes: ResourceChange = {
          money: 200,
          timeSpent: -1,
          source: 'test:combined',
          reason: 'Combined update'
        };

        const result = resourceService.updateResources('player1', changes);

        expect(result).toBe(true);
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 1200,
          timeSpent: 4,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 200
          }
        });
      });

      it('should update only money when timeSpent is not provided', () => {
        const changes: ResourceChange = {
          money: -300,
          source: 'test:money_only',
          reason: 'Money only update'
        };

        const result = resourceService.updateResources('player1', changes);

        expect(result).toBe(true);
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          money: 700,
          timeSpent: 5,
          moneySources: {
            ownerFunding: 0,
            bankLoans: 0,
            investmentDeals: 0,
            other: 0
          }
        });
      });

      it('should fail validation for insufficient funds', () => {
        const changes: ResourceChange = {
          money: -1500,
          source: 'test:insufficient_funds'
        };

        const result = resourceService.updateResources('player1', changes);
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });
    });
  });

  describe('Validation', () => {
    describe('validateResourceChange', () => {
      it('should validate successful change', () => {
        const changes: ResourceChange = {
          money: 100,
          timeSpent: 1,
          source: 'test:validation'
        };

        const validation: ResourceValidation = resourceService.validateResourceChange('player1', changes);
        
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });

      it('should fail validation when source is missing', () => {
        const changes: ResourceChange = {
          money: 100,
          source: ''
        };

        const validation = resourceService.validateResourceChange('player1', changes);
        
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Source is required for all resource changes');
      });

      it('should fail validation for insufficient funds', () => {
        const changes: ResourceChange = {
          money: -1500,
          source: 'test:insufficient'
        };

        const validation = resourceService.validateResourceChange('player1', changes);
        
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Insufficient funds: trying to spend $1,500, but player only has $1,000');
      });

      it('should warn about large transactions', () => {
        const changes: ResourceChange = {
          money: 2000000,
          source: 'test:large_transaction'
        };

        const validation = resourceService.validateResourceChange('player1', changes);
        
        expect(validation.valid).toBe(true);
        expect(validation.warnings).toContain('Large money transaction: +$2,000,000');
      });

      it('should fail validation when player does not exist', () => {
        mockStateService.getPlayer.mockReturnValue(undefined);
        
        const changes: ResourceChange = {
          money: 100,
          source: 'test:nonexistent'
        };

        const validation = resourceService.validateResourceChange('nonexistent', changes);
        
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Player nonexistent does not exist');
      });
    });
  });

  describe('Loan Operations', () => {
    const mockGameState: GameState = {
      turn: 10,
      players: [mockPlayer],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      isGameOver: false,
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      requiredActions: 1,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      decks: { W: [], B: [], E: [], L: [], I: [] },
      discardPiles: { W: [], B: [], E: [], L: [], I: [] }
    };

    beforeEach(() => {
      // Reset mockPlayer to initial state for loan tests
      mockPlayer.money = 1000;
      mockPlayer.timeSpent = 5;
      mockPlayer.loans = [];
      mockPlayer.moneySources = {
        ownerFunding: 0,
        bankLoans: 0,
        investmentDeals: 0,
        other: 0
      };

      mockStateService.getGameState.mockReturnValue(mockGameState);

      // Make mock stateful: update mockPlayer when updatePlayer is called
      mockStateService.updatePlayer.mockImplementation((updates) => {
        Object.assign(mockPlayer, updates);
        return mockGameState;
      });
    });

    describe('takeOutLoan', () => {
      it('should successfully take out a loan', () => {
        const result = resourceService.takeOutLoan('player1', 5000, 0.05);
        
        expect(result).toBe(true);
        
        // Check that loan was added to player's loans array
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          loans: expect.arrayContaining([
            expect.objectContaining({
              principal: 5000,
              interestRate: 0.05,
              startTurn: 10
            })
          ])
        });
        
        // Check that money was added via updateResources call (loan amount)
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'player1',
            money: 6000, // 1000 + 5000 loan amount
            timeSpent: 5,
            moneySources: expect.objectContaining({
              bankLoans: 5000
            })
          })
        );

        // Check that interest fee was deducted (two-transaction model)
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'player1',
            money: 5750, // 6000 - 250 interest fee (5000 * 0.05)
            timeSpent: 5,
            moneySources: expect.objectContaining({
              bankLoans: 5000  // Money sources don't change when spending
            })
          })
        );
      });

      it('should fail with invalid amount (zero)', () => {
        const result = resourceService.takeOutLoan('player1', 0, 0.05);
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail with invalid amount (negative)', () => {
        const result = resourceService.takeOutLoan('player1', -1000, 0.05);
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail with invalid interest rate (negative)', () => {
        const result = resourceService.takeOutLoan('player1', 1000, -0.01);
        
        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail when player is not found', () => {
        mockStateService.getPlayer.mockReturnValue(undefined);
        
        expect(() => resourceService.takeOutLoan('nonexistent', 1000, 0.05)).toThrow(/Player nonexistent not found/);
        
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should rollback loan if money addition fails', () => {
        // Mock addMoney to return false
        vi.spyOn(resourceService, 'addMoney').mockReturnValue(false);

        const result = resourceService.takeOutLoan('player1', 1000, 0.05);
        
        expect(result).toBe(false);
        
        // Should have attempted to rollback the loan by restoring original loans array
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith({
          id: 'player1',
          loans: [] // Original loans array (empty)
        });
      });
    });

  });

  describe('Cost Tracking Operations', () => {
    const playerWithFinances: Player = {
      ...mockPlayer,
      money: 10000,
      costHistory: [],
      costs: {
        bank: 0,
        investor: 0,
        expeditor: 0,
        architectural: 0,
        engineering: 0,
        regulatory: 0,
        miscellaneous: 0,
        total: 0
      },
      expenditures: {
        design: 0,
        fees: 0,
        construction: 0
      }
    };

    const mockGameStateWithTurn: GameState = {
      turn: 15,
      globalTurnCount: 15,
      players: [playerWithFinances],
      currentPlayerId: 'player1',
      gamePhase: 'PLAY',
      isGameOver: false,
      activeModal: null,
      awaitingChoice: null,
      hasPlayerMovedThisTurn: false,
      hasPlayerRolledDice: false,
      requiredActions: 1,
      completedActions: 0,
      availableActionTypes: [],
      hasCompletedManualActions: false,
      activeNegotiation: null,
      globalActionLog: [],
      preSpaceEffectState: null,
      decks: { W: [], B: [], E: [], L: [], I: [] },
      discardPiles: { W: [], B: [], E: [], L: [], I: [] }
    };

    beforeEach(() => {
      mockStateService.getPlayer.mockReturnValue(playerWithFinances);
      mockStateService.getGameState.mockReturnValue(mockGameStateWithTurn);
      mockStateService.updatePlayer.mockReturnValue(mockGameStateWithTurn);
    });

    describe('recordCost', () => {
      it('should successfully record a bank fee cost', () => {
        const result = resourceService.recordCost('player1', 'regulatory', 500, 'Bank processing fee', 'BANK-FEE');

        expect(result).toBe(true);

        // Verify the cost entry was created and added to costHistory
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'player1',
            money: 9500, // 10000 - 500
            costHistory: expect.arrayContaining([
              expect.objectContaining({
                category: 'regulatory',
                amount: 500,
                description: 'Bank processing fee',
                turn: 15,
                spaceName: 'TEST-SPACE'
              })
            ]),
            costs: expect.objectContaining({
              regulatory: 500,
              total: 500
            }),
            expenditures: expect.objectContaining({
              fees: 500 // regulatory maps to fees
            })
          })
        );
      });

      it('should successfully record an architectural fee', () => {
        const result = resourceService.recordCost('player1', 'architectural', 2000, 'Architect review', 'ARCH-FEE');

        expect(result).toBe(true);

        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            money: 8000,
            costs: expect.objectContaining({
              architectural: 2000,
              total: 2000
            }),
            expenditures: expect.objectContaining({
              design: 2000 // architectural maps to design
            })
          })
        );
      });

      it('should successfully record an engineering fee', () => {
        const result = resourceService.recordCost('player1', 'engineering', 1500, 'Engineer review', 'ENG-FEE');

        expect(result).toBe(true);

        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            costs: expect.objectContaining({
              engineering: 1500
            }),
            expenditures: expect.objectContaining({
              design: 1500 // engineering maps to design
            })
          })
        );
      });

      it('should successfully record a regulatory fee', () => {
        const result = resourceService.recordCost('player1', 'regulatory', 800, 'DOB filing fee', 'DOB-FEE');

        expect(result).toBe(true);

        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            costs: expect.objectContaining({
              regulatory: 800
            }),
            expenditures: expect.objectContaining({
              fees: 800 // regulatory maps to fees
            })
          })
        );
      });

      it('should accumulate multiple costs in the same category', () => {
        // First cost
        resourceService.recordCost('player1', 'expeditor', 300, 'Expeditor fee 1', 'EXPEDITOR');

        // Mock the updated player state with first cost
        const playerAfterFirstCost = {
          ...playerWithFinances,
          money: 9700,
          costHistory: [{
            id: 'cost1',
            category: 'expeditor' as const,
            amount: 300,
            description: 'Expeditor fee 1',
            turn: 15,
            timestamp: new Date(),
            spaceName: 'TEST-SPACE'
          }],
          costs: {
            ...playerWithFinances.costs,
            expeditor: 300,
            total: 300
          }
        };
        mockStateService.getPlayer.mockReturnValue(playerAfterFirstCost);

        // Second cost
        const result = resourceService.recordCost('player1', 'expeditor', 200, 'Expeditor fee 2', 'EXPEDITOR');

        expect(result).toBe(true);
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            money: 9500, // 9700 - 200
            costs: expect.objectContaining({
              expeditor: 500, // 300 + 200
              total: 500
            })
          })
        );
      });

      it('should fail when player cannot afford the cost', () => {
        const poorPlayer = { ...playerWithFinances, money: 100 };
        mockStateService.getPlayer.mockReturnValue(poorPlayer);

        const result = resourceService.recordCost('player1', 'regulatory', 500, 'Expensive fee', 'BANK-FEE');

        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail with invalid amount (zero)', () => {
        const result = resourceService.recordCost('player1', 'regulatory', 0, 'Invalid cost', 'TEST');

        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail with invalid amount (negative)', () => {
        const result = resourceService.recordCost('player1', 'regulatory', -100, 'Invalid cost', 'TEST');

        expect(result).toBe(false);
        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should fail when player is not found', () => {
        mockStateService.getPlayer.mockReturnValue(undefined);

        expect(() => resourceService.recordCost('nonexistent', 'regulatory', 100, 'Fee', 'TEST')).toThrow(/Player nonexistent not found/);

        expect(mockStateService.updatePlayer).not.toHaveBeenCalled();
      });

      it('should handle backward compatibility (player without cost structures)', () => {
        const legacyPlayer = {
          ...mockPlayer,
          money: 5000
          // No costHistory, costs, or expenditures fields
        };
        mockStateService.getPlayer.mockReturnValue(legacyPlayer);

        const result = resourceService.recordCost('player1', 'regulatory', 100, 'Fee', 'BANK-FEE');

        expect(result).toBe(true);

        // Should initialize empty structures
        expect(mockStateService.updatePlayer).toHaveBeenCalledWith(
          expect.objectContaining({
            costHistory: expect.arrayContaining([
              expect.objectContaining({
                category: 'regulatory',
                amount: 100
              })
            ]),
            costs: expect.objectContaining({
              bank: 0,
              investor: 0,
              expeditor: 0,
              architectural: 0,
              engineering: 0,
              regulatory: 100,
              miscellaneous: 0,
              total: 100
            })
          })
        );
      });
    });
  });

  describe('Transaction History', () => {
    it('should maintain transaction history', () => {
      // Perform some operations to create history
      resourceService.addMoney('player1', 500, 'test:history_1');
      resourceService.spendMoney('player1', 200, 'test:history_2');

      const history = resourceService.getResourceHistory('player1');

      expect(history).toHaveLength(2);
      expect(history[0].changes.money).toBe(500);
      expect(history[0].changes.source).toBe('test:history_1');
      expect(history[1].changes.money).toBe(-200);
      expect(history[1].changes.source).toBe('test:history_2');
    });

    it('should return empty history for player with no transactions', () => {
      const history = resourceService.getResourceHistory('unused_player');
      expect(history).toHaveLength(0);
    });
  });

  describe('Debug Helpers', () => {
    it('should provide transaction summary', () => {
      resourceService.addMoney('player1', 100, 'test:summary');
      
      const summary = resourceService.getTransactionSummary();
      
      expect(summary).toHaveProperty('player1');
      expect(summary['player1'].totalTransactions).toBe(1);
      expect(summary['player1'].lastTransaction).toBeDefined();
    });

    it('should clear transaction history', () => {
      resourceService.addMoney('player1', 100, 'test:clear');
      
      expect(resourceService.getResourceHistory('player1')).toHaveLength(1);
      
      resourceService.clearTransactionHistory('player1');
      
      expect(resourceService.getResourceHistory('player1')).toHaveLength(0);
    });

    it('should clear all transaction history', () => {
      resourceService.addMoney('player1', 100, 'test:clear_all_1');
      resourceService.addMoney('player2', 200, 'test:clear_all_2');
      
      resourceService.clearTransactionHistory(); // Clear all
      
      expect(resourceService.getResourceHistory('player1')).toHaveLength(0);
      expect(resourceService.getResourceHistory('player2')).toHaveLength(0);
    });
  });
});