import { describe, it, expect } from 'vitest';
import { formatActionDescription, getLogTypeLabel } from '../../src/utils/actionLogFormatting';
import { ActionLogEntry } from '../../src/types/StateTypes';

const BASE_ENTRY = {
  isCommitted: true,
  explorationSessionId: 'session-1',
  gameRound: 1,
  turnWithinRound: 1,
  globalTurnNumber: 1,
  playerTurnNumber: 1,
  visibility: 'player' as const,
};

describe('actionLogFormatting', () => {
  describe('formatActionDescription', () => {
    it('should format dice_roll type with dice emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test1',
        type: 'dice_roll',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Rolled 4 for movement'
      };

      const result = formatActionDescription(entry);
      // Voice rule (no game language): outcome icon 🎯, not a 🎲 die.
      expect(result).toBe('🎯 Rolled 4 for movement');
    });

    it('should format card_draw type with details', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test2',
        type: 'card_draw',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Drew cards',
        details: {
          cardType: 'W',
          cardCount: 2
        }
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('🏗️ Got 2 Work Packages');
    });

    it('should format card_draw type with single card', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test3',
        type: 'card_draw',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Drew card',
        details: {
          cardType: 'B',
          cardCount: 1
        }
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('🏦 Got 1 Bank Loan');
    });

    it('should format card_draw type without details', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test4',
        type: 'card_draw',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Drew some cards'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('Drew some cards');
    });

    it('should format space_effect type and remove prefix', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test5',
        type: 'space_effect',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: '📍 Space Effect: Gained $1000'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('⚡ Gained $1000');
    });

    it('should format space_effect type without prefix', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test6',
        type: 'space_effect',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Applied space effect'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('⚡ Applied space effect');
    });

    it('should format time_effect type and remove prefix', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test7',
        type: 'time_effect',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: '📍 Space Effect: Time penalty applied'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('⏰ Time penalty applied');
    });

    it('should format time_effect type without prefix', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test8',
        type: 'time_effect',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Lost 2 days'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('⏰ Lost 2 days');
    });

    it('should format manual_action type with hand emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test9',
        type: 'manual_action',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Player clicked manual effect button'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('✋ Player clicked manual effect button');
    });

    it('should format resource_change type with money emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test10',
        type: 'resource_change',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Gained $500'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('💰 Gained $500');
    });

    it('should format space_entry type with location emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test11',
        type: 'space_entry',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Entered OWNER-SCOPE-INITIATION'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('📍 Entered OWNER-SCOPE-INITIATION');
    });

    it('should format game_start type with flag emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test12',
        type: 'game_start',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Game started with 3 players'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('🏁 Game started with 3 players');
    });

    it('should format game_end type with trophy emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test13',
        type: 'game_end',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Alice won the game!'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('🏆 Alice won the game!');
    });

    it('should format error_event type with X emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test14',
        type: 'error_event',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Invalid move attempted'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('❌ Invalid move attempted');
    });

    it('should format choice_made type with pointing finger emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test15',
        type: 'choice_made',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Selected movement destination'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('👉 Selected movement destination');
    });

    it('should format negotiation_resolved type with handshake emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test16',
        type: 'negotiation_resolved',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Negotiation completed successfully'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('🤝 Negotiation completed successfully');
    });

    it('should format system_log type with gear emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test17',
        type: 'system_log',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'System notification'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('⚙️ System notification');
    });

    it('should format turn_start type with play emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test18',
        type: 'turn_start',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Alice started their turn'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('▶️ Alice started their turn');
    });

    it('should format turn_end type with stop emoji', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test19',
        type: 'turn_end',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Alice ended their turn'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('⏹️ Alice ended their turn');
    });

    it('should handle unknown types by returning original description', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test20',
        type: 'unknown_type' as any,
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Unknown action occurred'
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('Unknown action occurred');
    });

    it('should handle missing details in card_draw gracefully', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test21',
        type: 'card_draw',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Drew cards',
        details: {
          cardType: 'W'
          // Missing cardCount
        }
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('Drew cards');
    });

    it('should handle partial details in card_draw gracefully', () => {
      const entry: ActionLogEntry = {
        ...BASE_ENTRY,
        id: 'test22',
        type: 'card_draw',
        timestamp: new Date(),
        playerId: 'player1',
        playerName: 'Alice',
        description: 'Drew cards',
        details: {
          cardCount: 3
          // Missing cardType
        }
      };

      const result = formatActionDescription(entry);
      expect(result).toBe('Drew cards');
    });
  });

  describe('getLogTypeLabel', () => {
    it('should return a human-readable label for every ActionLogEntry.type', () => {
      // Raw snake_case enum values read as "directly from a CSV" when shown
      // verbatim in the post-game log's type filter dropdown (fb:69fe31a4).
      expect(getLogTypeLabel('manual_action')).toBe('Action taken');
      expect(getLogTypeLabel('space_entry')).toBe('Arrived at a space');
      expect(getLogTypeLabel('card_draw')).toBe('Card drawn');
      expect(getLogTypeLabel('player_movement')).toBe('Moved');
    });

    it('should fall back to the raw type for an unmapped value', () => {
      expect(getLogTypeLabel('made_up_type' as ActionLogEntry['type'])).toBe('made_up_type');
    });
  });
});