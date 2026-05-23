import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationUtils } from '../../src/utils/NotificationUtils';
import { FormatUtils } from '../../src/utils/FormatUtils';
import { NOTIF } from '../../src/constants/uiStrings';

// Mock FormatUtils since it's used in some notifications
vi.mock('../../src/utils/FormatUtils', () => ({
  FormatUtils: {
    formatMoney: vi.fn((amount: number) => `$${amount.toLocaleString()}`)
  }
}));

describe('NotificationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createDiceRollNotification', () => {
    it('should create notification for dice roll with card effects', () => {
      const effects = [
        { type: 'cards', cardCount: 2, cardType: 'W' },
        { type: 'money', value: 500 }
      ];

      const result = NotificationUtils.createDiceRollNotification(4, effects, 'Alice');

      expect(result).toEqual({
        short: '4',
        medium: NOTIF.diceRollMedium(4, '2 Work Packages, +$500'),
        detailed: NOTIF.diceRollDetailed('Alice', 4, '2 Work Packages, +$500'),
      });
    });

    it('should create notification for dice roll with time effects', () => {
      const effects = [
        { type: 'time', value: -2 },
        { type: 'money', value: -100 }
      ];

      const result = NotificationUtils.createDiceRollNotification(1, effects, 'Bob');

      expect(result).toEqual({
        short: '1',
        medium: NOTIF.diceRollMedium(1, '--2d, -$100'),
        detailed: NOTIF.diceRollDetailed('Bob', 1, '--2d, -$100'),
      });
    });

    it('should create notification for dice roll with no effects', () => {
      const result = NotificationUtils.createDiceRollNotification(3, [], 'Charlie');

      expect(result).toEqual({
        short: '3',
        medium: NOTIF.diceRollMedium(3, ''),
        detailed: NOTIF.diceRollDetailed('Charlie', 3, ''),
      });
    });

    it('should handle unknown effect types', () => {
      const effects = [
        { type: 'unknown_effect' }
      ];

      const result = NotificationUtils.createDiceRollNotification(5, effects, 'Dave');

      expect(result).toEqual({
        short: '5',
        medium: NOTIF.diceRollMedium(5, 'unknown_effect'),
        detailed: NOTIF.diceRollDetailed('Dave', 5, 'unknown_effect'),
      });
    });
  });

  describe('createManualActionNotification', () => {
    it('should create notification for manual action with outcomes', () => {
      const outcomes = ['Drew 2 cards', 'Gained $300'];

      const result = NotificationUtils.createManualActionNotification('cards', outcomes, 'Alice');

      expect(result).toEqual({
        short: '✓',
        medium: '⚙️ Drew 2 cards, Gained $300',
        detailed: 'Alice completed manual action (cards): Drew 2 cards, Gained $300'
      });
    });

    it('should create notification for manual action with no outcomes', () => {
      const result = NotificationUtils.createManualActionNotification('turn_end', [], 'Bob');

      expect(result).toEqual({
        short: '✓',
        medium: '⚙️ Action completed',
        detailed: 'Bob completed manual action (turn_end): Action completed'
      });
    });
  });

  describe('createTryAgainNotification', () => {
    it('should create notification for successful try again', () => {
      const result = NotificationUtils.createTryAgainNotification(true, 2, 'BANK-SELECTION', 'Alice');

      expect(result).toEqual({
        short: 'Try Again',
        medium: '🔄 Try Again → 2d penalty',
        detailed: 'Alice used Try Again on BANK-SELECTION. Reverted to previous state with 2 day penalty'
      });
    });

    it('should create notification for failed try again', () => {
      const result = NotificationUtils.createTryAgainNotification(false, 0, 'OWNER-SCOPE-INITIATION', 'Bob');

      expect(result).toEqual({
        short: 'Failed',
        medium: '❌ Try Again failed',
        detailed: 'Bob failed to use Try Again on OWNER-SCOPE-INITIATION. No snapshot available'
      });
    });
  });

  describe('createCardPlayNotification', () => {
    it('should create notification for card play with money effects', () => {
      const effects = [
        { type: 'money', value: 1000 },
        { type: 'cards', cardCount: 1, cardType: 'B' }
      ];

      const result = NotificationUtils.createCardPlayNotification('Investment Card', effects, 'Alice');

      expect(result).toEqual({
        short: NOTIF.cardPlayShort,
        medium: NOTIF.cardPlayMedium('Investment Card', '+$1,000, +1 Bank Loan'),
        detailed: NOTIF.cardPlayDetailed('Alice', 'Investment Card', '+$1,000, +1 Bank Loan'),
      });
      expect(FormatUtils.formatMoney).toHaveBeenCalledWith(1000);
    });

    it('should create notification for card play with time effects', () => {
      const effects = [
        { type: 'time', value: -3 }
      ];

      const result = NotificationUtils.createCardPlayNotification('Efficiency Card', effects, 'Bob');

      expect(result).toEqual({
        short: NOTIF.cardPlayShort,
        medium: NOTIF.cardPlayMedium('Efficiency Card', '--3 days'),
        detailed: NOTIF.cardPlayDetailed('Bob', 'Efficiency Card', '--3 days'),
      });
    });

    it('should create notification for card play with no effects', () => {
      const result = NotificationUtils.createCardPlayNotification('Simple Card', [], 'Charlie');

      expect(result).toEqual({
        short: NOTIF.cardPlayShort,
        medium: NOTIF.cardPlayMedium('Simple Card', ''),
        detailed: NOTIF.cardPlayDetailed('Charlie', 'Simple Card', ''),
      });
    });

    it('should handle unknown effect types with description', () => {
      const effects = [
        { type: 'unknown', description: 'Special effect triggered' }
      ];

      const result = NotificationUtils.createCardPlayNotification('Mystery Card', effects, 'Dave');

      expect(result).toEqual({
        short: NOTIF.cardPlayShort,
        medium: NOTIF.cardPlayMedium('Mystery Card', 'Special effect triggered'),
        detailed: NOTIF.cardPlayDetailed('Dave', 'Mystery Card', 'Special effect triggered'),
      });
    });

    it('should handle unknown effect types without description', () => {
      const effects = [
        { type: 'unknown_effect' }
      ];

      const result = NotificationUtils.createCardPlayNotification('Unknown Card', effects, 'Eve');

      expect(result).toEqual({
        short: NOTIF.cardPlayShort,
        medium: NOTIF.cardPlayMedium('Unknown Card', 'unknown_effect'),
        detailed: NOTIF.cardPlayDetailed('Eve', 'Unknown Card', 'unknown_effect'),
      });
    });
  });

  describe('createTurnEndNotification', () => {
    it('should create notification for turn end', () => {
      const result = NotificationUtils.createTurnEndNotification(5, 'Alice');

      expect(result).toEqual({
        short: 'Turn End',
        medium: '🏁 Turn 5 ended',
        detailed: 'Alice ended turn 5'
      });
    });

    it('should handle turn 1', () => {
      const result = NotificationUtils.createTurnEndNotification(1, 'Bob');

      expect(result).toEqual({
        short: 'Turn End',
        medium: '🏁 Turn 1 ended',
        detailed: 'Bob ended turn 1'
      });
    });
  });

  describe('createMovementNotification', () => {
    it('should create notification for player movement', () => {
      const result = NotificationUtils.createMovementNotification(
        'OWNER-SCOPE-INITIATION',
        'BANK-SELECTION',
        'Alice'
      );

      expect(result).toEqual({
        short: 'Moved',
        medium: '🚶 Moved to BANK-SELECTION',
        detailed: 'Alice moved from OWNER-SCOPE-INITIATION to BANK-SELECTION'
      });
    });

    it('should create notification for same space movement', () => {
      const result = NotificationUtils.createMovementNotification(
        'CURRENT-SPACE',
        'CURRENT-SPACE',
        'Bob'
      );

      expect(result).toEqual({
        short: 'Moved',
        medium: '🚶 Moved to CURRENT-SPACE',
        detailed: 'Bob moved from CURRENT-SPACE to CURRENT-SPACE'
      });
    });
  });

  describe('createErrorNotification', () => {
    it('should create notification for action error', () => {
      const result = NotificationUtils.createErrorNotification(
        'card play',
        'Insufficient funds',
        'Alice'
      );

      expect(result).toEqual({
        short: 'Error',
        medium: '❌ card play failed',
        detailed: 'Alice encountered error during card play: Insufficient funds'
      });
    });

    it('should create notification for movement error', () => {
      const result = NotificationUtils.createErrorNotification(
        'movement',
        'Invalid destination',
        'Bob'
      );

      expect(result).toEqual({
        short: 'Error',
        medium: '❌ movement failed',
        detailed: 'Bob encountered error during movement: Invalid destination'
      });
    });
  });

  describe('createSuccessNotification', () => {
    it('should create notification for successful action with details', () => {
      const result = NotificationUtils.createSuccessNotification(
        'loan application',
        'Received $50,000 at 5% interest',
        'Alice'
      );

      expect(result).toEqual({
        short: '✓',
        medium: '✅ loan application complete',
        detailed: 'Alice successfully completed loan application: Received $50,000 at 5% interest'
      });
    });

    it('should create notification for successful action without details', () => {
      const result = NotificationUtils.createSuccessNotification(
        'registration',
        '',
        'Bob'
      );

      expect(result).toEqual({
        short: '✓',
        medium: '✅ registration complete',
        detailed: 'Bob successfully completed registration'
      });
    });

    it('should create notification for successful action with null details', () => {
      const result = NotificationUtils.createSuccessNotification(
        'initialization',
        null as any,
        'Charlie'
      );

      expect(result).toEqual({
        short: '✓',
        medium: '✅ initialization complete',
        detailed: 'Charlie successfully completed initialization'
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty player names', () => {
      const result = NotificationUtils.createTurnEndNotification(1, '');

      expect(result).toEqual({
        short: 'Turn End',
        medium: '🏁 Turn 1 ended',
        detailed: ' ended turn 1'
      });
    });

    it('should handle negative turn numbers', () => {
      const result = NotificationUtils.createTurnEndNotification(-1, 'Alice');

      expect(result).toEqual({
        short: 'Turn End',
        medium: '🏁 Turn -1 ended',
        detailed: 'Alice ended turn -1'
      });
    });

    it('should handle negative money values in dice roll', () => {
      const effects = [
        { type: 'money', value: -500 }
      ];

      const result = NotificationUtils.createDiceRollNotification(2, effects, 'Alice');

      expect(result).toEqual({
        short: '2',
        medium: NOTIF.diceRollMedium(2, '-$500'),
        detailed: NOTIF.diceRollDetailed('Alice', 2, '-$500'),
      });
    });

    it('should handle zero values in effects', () => {
      const effects = [
        { type: 'money', value: 0 },
        { type: 'time', value: 0 }
      ];

      const result = NotificationUtils.createDiceRollNotification(3, effects, 'Bob');

      expect(result).toEqual({
        short: '3',
        medium: NOTIF.diceRollMedium(3, '-$0, -0d'),
        detailed: NOTIF.diceRollDetailed('Bob', 3, '-$0, -0d'),
      });
    });
  });
});