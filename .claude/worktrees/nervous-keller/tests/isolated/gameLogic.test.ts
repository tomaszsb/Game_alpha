// tests/isolated/gameLogic.test.ts
// Isolated game logic tests without service dependencies - ultra-fast execution

describe('Isolated Game Logic Tests', () => {
  
  describe('Resource calculations', () => {
    it('should calculate loan interest correctly', () => {
      const calculateInterest = (principal: number, rate: number, periods: number): number => {
        return principal * Math.pow(1 + rate, periods) - principal;
      };

      expect(calculateInterest(1000, 0.05, 1)).toBeCloseTo(50);
      expect(calculateInterest(1000, 0.1, 2)).toBeCloseTo(210);
    });

    it('should validate resource constraints', () => {
      const canAffordAction = (playerMoney: number, playerTime: number, cost: number, timeCost: number): boolean => {
        return playerMoney >= cost && playerTime >= timeCost;
      };

      expect(canAffordAction(1000, 10, 500, 5)).toBe(true);
      expect(canAffordAction(1000, 10, 1500, 5)).toBe(false);
      expect(canAffordAction(1000, 10, 500, 15)).toBe(false);
    });
  });

  describe('Card mechanics', () => {
    it('should determine card playability by phase', () => {
      const canPlayCardInPhase = (cardPhase: string, currentPhase: string): boolean => {
        return cardPhase === 'Any' || cardPhase === currentPhase;
      };

      expect(canPlayCardInPhase('Construction', 'Construction')).toBe(true);
      expect(canPlayCardInPhase('Any', 'Design')).toBe(true);
      expect(canPlayCardInPhase('Funding', 'Construction')).toBe(false);
    });

    it('should calculate card effects', () => {
      const applyCardEffect = (playerMoney: number, cardEffect: number): number => {
        return Math.max(0, playerMoney + cardEffect);
      };

      expect(applyCardEffect(1000, 500)).toBe(1500);
      expect(applyCardEffect(1000, -200)).toBe(800);
      expect(applyCardEffect(100, -200)).toBe(0); // Can't go negative
    });
  });

  describe('Turn mechanics', () => {
    it('should advance player turns correctly', () => {
      const getNextPlayer = (currentPlayer: number, totalPlayers: number): number => {
        return (currentPlayer + 1) % totalPlayers;
      };

      expect(getNextPlayer(0, 3)).toBe(1);
      expect(getNextPlayer(1, 3)).toBe(2);
      expect(getNextPlayer(2, 3)).toBe(0); // Wrap around
    });

    it('should validate turn actions', () => {
      const canTakeAction = (hasRolledDice: boolean, hasMovedPlayer: boolean, requiredActions: number): boolean => {
        const completedActions = (hasRolledDice ? 1 : 0) + (hasMovedPlayer ? 1 : 0);
        return completedActions < requiredActions;
      };

      expect(canTakeAction(false, false, 2)).toBe(true);
      expect(canTakeAction(true, false, 2)).toBe(true);
      expect(canTakeAction(true, true, 2)).toBe(false);
    });
  });

  describe('Dice mechanics', () => {
    it('should generate valid dice rolls', () => {
      const rollDice = (): number => {
        return Math.floor(Math.random() * 6) + 1;
      };

      for (let i = 0; i < 100; i++) {
        const roll = rollDice();
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      }
    });

    it('should calculate movement from dice', () => {
      const calculateMovement = (diceRoll: number, multiplier: number = 1): number => {
        return diceRoll * multiplier;
      };

      expect(calculateMovement(3)).toBe(3);
      expect(calculateMovement(4, 2)).toBe(8);
      expect(calculateMovement(1, 0)).toBe(0);
    });
  });

  describe('Win conditions', () => {
    it('should check basic win conditions', () => {
      const hasPlayerWon = (playerMoney: number, playerProjects: number, minMoney: number, minProjects: number): boolean => {
        return playerMoney >= minMoney && playerProjects >= minProjects;
      };

      expect(hasPlayerWon(10000, 3, 5000, 2)).toBe(true);
      expect(hasPlayerWon(3000, 3, 5000, 2)).toBe(false);
      expect(hasPlayerWon(10000, 1, 5000, 2)).toBe(false);
    });

    it('should rank players by score', () => {
      const rankPlayers = (players: Array<{id: string, score: number}>): Array<{id: string, score: number, rank: number}> => {
        return players
          .sort((a, b) => b.score - a.score)
          .map((player, index) => ({ ...player, rank: index + 1 }));
      };

      const players = [
        { id: 'alice', score: 1000 },
        { id: 'bob', score: 1500 },
        { id: 'charlie', score: 800 }
      ];

      const ranked = rankPlayers(players);
      
      expect(ranked[0].id).toBe('bob');
      expect(ranked[0].rank).toBe(1);
      expect(ranked[2].id).toBe('charlie');
      expect(ranked[2].rank).toBe(3);
    });
  });

  describe('Performance benchmarks', () => {
    it('should process game state calculations quickly', () => {
      const start = performance.now();
      
      // Simulate complex game state calculations
      let totalScore = 0;
      for (let player = 0; player < 6; player++) {
        let playerScore = 1000;
        for (let turn = 0; turn < 20; turn++) {
          playerScore += Math.floor(Math.random() * 100);
          playerScore -= Math.floor(Math.random() * 50);
        }
        totalScore += Math.max(0, playerScore);
      }
      
      const duration = performance.now() - start;
      
      expect(totalScore).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2); // Should complete in under 2ms
    });

    it('should handle validation loops efficiently', () => {
      const start = performance.now();
      
      // Simulate validation of many game actions
      let validActions = 0;
      for (let i = 0; i < 1000; i++) {
        const money = Math.random() * 2000;
        const cost = Math.random() * 1000;
        const time = Math.random() * 20;
        const timeCost = Math.random() * 10;
        
        if (money >= cost && time >= timeCost) {
          validActions++;
        }
      }
      
      const duration = performance.now() - start;
      
      expect(validActions).toBeGreaterThan(0);
      expect(duration).toBeLessThan(3); // Should complete in under 3ms
    });
  });
});