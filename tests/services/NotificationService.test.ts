import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService, NotificationContent, NotificationOptions } from '../../src/services/NotificationService';
import { IStateService, ILoggingService } from '../../src/types/ServiceContracts';
import { createMockStateService, createMockLoggingService } from '../mocks/mockServices';

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockStateService: any;
  let mockLoggingService: any;
  let mockButtonUpdate: any;
  let mockNotificationUpdate: any;

  // Sample notification content
  const sampleContent: NotificationContent = {
    short: '✓',
    medium: '🎲 Rolled 4 → 2 W cards',
    detailed: 'Alice rolled a 4 and gained: 2 W cards'
  };

  const sampleOptions: NotificationOptions = {
    playerId: 'player1',
    playerName: 'Alice',
    actionType: 'dice_roll'
  };

  beforeEach(() => {
    // Use fake timers to control setTimeout calls
    vi.useFakeTimers();

    // Create mocks for dependencies
    mockStateService = createMockStateService();
    mockLoggingService = createMockLoggingService();

    // Create mocks for UI callbacks
    mockButtonUpdate = vi.fn();
    mockNotificationUpdate = vi.fn();

    // Initialize the NotificationService
    notificationService = new NotificationService(mockStateService, mockLoggingService);
    notificationService.setUpdateCallbacks(mockButtonUpdate, mockNotificationUpdate);
  });

  afterEach(() => {
    // Restore real timers after each test
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('notify lifecycle', () => {
    it('should display and then clear feedback over time', async () => {
      // Call notify with sample data
      notificationService.notify(sampleContent, sampleOptions);

      // Assert Immediate State: Check button feedback and notification updates
      expect(mockButtonUpdate).toHaveBeenCalledWith({
        dice_roll: '✓'
      });
      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        player1: '🎲 Rolled 4 → 2 W cards'
      });
      // NotificationService no longer logs - EffectEngine handles logging

      // Clear previous call history
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance Time: Move past button feedback duration (2000ms default)
      vi.advanceTimersByTime(2001);

      // Assert Button Cleared: Button feedback should be cleared
      expect(mockButtonUpdate).toHaveBeenCalledWith({});

      // Clear call history again
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance Time Again: Move past notification duration (4000ms total)
      vi.advanceTimersByTime(2000); // Total: 4001ms

      // Assert Notification Cleared: Notification should be cleared
      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });

    it('should handle custom durations correctly', () => {
      const customOptions: NotificationOptions = {
        ...sampleOptions,
        buttonDuration: 1000,
        notificationDuration: 3000
      };

      notificationService.notify(sampleContent, customOptions);

      // Clear initial calls
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance to custom button duration
      vi.advanceTimersByTime(1001);
      expect(mockButtonUpdate).toHaveBeenCalledWith({});

      // Clear calls
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance to custom notification duration
      vi.advanceTimersByTime(2000); // Total: 3001ms
      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });

    it('should handle multiple concurrent notifications', () => {
      const content1: NotificationContent = {
        short: '4',
        medium: '🎲 Rolled 4',
        detailed: 'Alice rolled a 4'
      };

      const content2: NotificationContent = {
        short: '✓ Card',
        medium: '🃏 Played card',
        detailed: 'Bob played a card'
      };

      const options1: NotificationOptions = {
        playerId: 'player1',
        playerName: 'Alice',
        actionType: 'dice_roll'
      };

      const options2: NotificationOptions = {
        playerId: 'player2',
        playerName: 'Bob',
        actionType: 'card_play'
      };

      // Send both notifications
      notificationService.notify(content1, options1);
      notificationService.notify(content2, options2);

      // Check that both are active
      expect(mockButtonUpdate).toHaveBeenLastCalledWith({
        dice_roll: '4',
        card_play: '✓ Card'
      });

      expect(mockNotificationUpdate).toHaveBeenLastCalledWith({
        player1: '🎲 Rolled 4',
        player2: '🃏 Played card'
      });

      // Clear calls
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance time to clear button feedback
      vi.advanceTimersByTime(2001);

      // Both button feedbacks should be cleared
      expect(mockButtonUpdate).toHaveBeenCalledWith({});

      // Clear calls
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance time to clear notifications
      vi.advanceTimersByTime(2000); // Total: 4001ms

      // Both notifications should be cleared
      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });
  });

  describe('skip options', () => {
    it('should skip button feedback when skipButton is true', () => {
      const options: NotificationOptions = {
        ...sampleOptions,
        skipButton: true
      };

      notificationService.notify(sampleContent, options);

      // Button update should not be called
      expect(mockButtonUpdate).not.toHaveBeenCalled();

      // But notification and log should still work
      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        player1: '🎲 Rolled 4 → 2 W cards'
      });
      // NotificationService no longer logs - EffectEngine handles logging
    });

    it('should skip notification when skipNotification is true', () => {
      const options: NotificationOptions = {
        ...sampleOptions,
        skipNotification: true
      };

      notificationService.notify(sampleContent, options);

      // Notification update should not be called
      expect(mockNotificationUpdate).not.toHaveBeenCalled();

      // But button and log should still work
      expect(mockButtonUpdate).toHaveBeenCalledWith({
        dice_roll: '✓'
      });
      // NotificationService no longer logs - EffectEngine handles logging
    });

    // Replaces a former 'should skip logging when skipLog is true' test. That
    // test asserted mockLoggingService.info was not called with skipLog set —
    // but notify() never logs at all, so it passed whether the flag was set,
    // unset, or absent, and would have kept passing if skipLog stopped working
    // entirely. skipLog itself has been removed from NotificationOptions.
    // This pins the behaviour that is actually real: logging is EffectEngine's
    // job, so notify() must not touch LoggingService no matter what it is given.
    it('never writes GameLog entries — EffectEngine owns logging', () => {
      notificationService.notify(sampleContent, sampleOptions);

      expect(mockLoggingService.info).not.toHaveBeenCalled();

      // The two channels it DOES own still fire, so this is not passing merely
      // because notify() did nothing at all.
      expect(mockButtonUpdate).toHaveBeenCalledWith({
        dice_roll: '✓'
      });
      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        player1: '🎲 Rolled 4 → 2 W cards'
      });
    });

    it('should skip all when all skip options are true', () => {
      const options: NotificationOptions = {
        ...sampleOptions,
        skipButton: true,
        skipNotification: true
      };

      notificationService.notify(sampleContent, options);

      // Nothing should be called
      expect(mockButtonUpdate).not.toHaveBeenCalled();
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
      expect(mockLoggingService.info).not.toHaveBeenCalled();
    });
  });

  describe('clearPlayerNotifications', () => {
    beforeEach(() => {
      // Set up some notifications
      notificationService.notify(sampleContent, sampleOptions);
      notificationService.notify(sampleContent, {
        ...sampleOptions,
        playerId: 'player2',
        playerName: 'Bob'
      });

      // Clear mock call history
      mockNotificationUpdate.mockClear();
    });

    it('should clear specific player notifications', () => {
      notificationService.clearPlayerNotifications('player1');

      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        player2: '🎲 Rolled 4 → 2 W cards'
      });
    });

    it('should clear all player notifications when no playerId specified', () => {
      notificationService.clearPlayerNotifications();

      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });
  });

  describe('clearAllNotifications', () => {
    beforeEach(() => {
      // Set up notifications and button feedback
      notificationService.notify(sampleContent, sampleOptions);
      notificationService.notify(sampleContent, {
        ...sampleOptions,
        actionType: 'card_play'
      });

      // Clear mock call history
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();
    });

    it('should clear all notifications and button feedback', () => {
      notificationService.clearAllNotifications();

      expect(mockButtonUpdate).toHaveBeenCalledWith({});
      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });
  });

  describe('state getters', () => {
    it('should return current button feedback state', () => {
      notificationService.notify(sampleContent, sampleOptions);

      const feedback = notificationService.getButtonFeedback();
      expect(feedback).toEqual({
        dice_roll: '✓'
      });
    });

    it('should return current player notifications state', () => {
      notificationService.notify(sampleContent, sampleOptions);

      const notifications = notificationService.getPlayerNotifications();
      expect(notifications).toEqual({
        player1: '🎲 Rolled 4 → 2 W cards'
      });
    });

    it('should return empty objects when no notifications active', () => {
      const feedback = notificationService.getButtonFeedback();
      const notifications = notificationService.getPlayerNotifications();

      expect(feedback).toEqual({});
      expect(notifications).toEqual({});
    });

    it('should return copies of state (not references)', () => {
      notificationService.notify(sampleContent, sampleOptions);

      const feedback1 = notificationService.getButtonFeedback();
      const feedback2 = notificationService.getButtonFeedback();

      expect(feedback1).not.toBe(feedback2); // Different object references
      expect(feedback1).toEqual(feedback2); // Same content
    });
  });

  describe('callback handling', () => {
    it('should handle missing callbacks gracefully', () => {
      // Create service without setting callbacks
      const serviceWithoutCallbacks = new NotificationService(mockStateService, mockLoggingService);

      // Should not throw error
      expect(() => {
        serviceWithoutCallbacks.notify(sampleContent, sampleOptions);
      }).not.toThrow();

      // NotificationService no longer logs - EffectEngine handles logging
      // Test passes if no exception is thrown
    });

    it('should update callbacks when setUpdateCallbacks is called again', () => {
      const newButtonUpdate = vi.fn();
      const newNotificationUpdate = vi.fn();

      // Set new callbacks
      notificationService.setUpdateCallbacks(newButtonUpdate, newNotificationUpdate);

      // Send notification
      notificationService.notify(sampleContent, sampleOptions);

      // New callbacks should be used
      expect(newButtonUpdate).toHaveBeenCalled();
      expect(newNotificationUpdate).toHaveBeenCalled();

      // Old callbacks should not be used
      expect(mockButtonUpdate).not.toHaveBeenCalled();
      expect(mockNotificationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('timeout management', () => {
    it('should clear existing timeouts when same action type is triggered again', () => {
      // First notification
      notificationService.notify(sampleContent, sampleOptions);

      // Clear call history
      mockButtonUpdate.mockClear();

      // Second notification with same action type before first expires
      notificationService.notify({
        short: '6',
        medium: '🎲 Rolled 6',
        detailed: 'Alice rolled a 6'
      }, sampleOptions);

      // Should update to new value
      expect(mockButtonUpdate).toHaveBeenCalledWith({
        dice_roll: '6'
      });

      // Clear calls
      mockButtonUpdate.mockClear();

      // Advance time past original timeout
      vi.advanceTimersByTime(2001);

      // Should clear (proving the timeout was reset)
      expect(mockButtonUpdate).toHaveBeenCalledWith({});
    });

    it('should clear existing timeouts when same player is notified again', () => {
      // First notification
      notificationService.notify(sampleContent, sampleOptions);

      // Clear call history
      mockNotificationUpdate.mockClear();

      // Second notification for same player before first expires
      notificationService.notify({
        short: '✓',
        medium: '🃏 Played card',
        detailed: 'Alice played a card'
      }, {
        ...sampleOptions,
        actionType: 'card_play'
      });

      // Should update to new value
      expect(mockNotificationUpdate).toHaveBeenCalledWith({
        player1: '🃏 Played card'
      });

      // Clear calls
      mockNotificationUpdate.mockClear();

      // Advance time past original timeout
      vi.advanceTimersByTime(4001);

      // Should clear (proving the timeout was reset)
      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings in content', () => {
      const emptyContent: NotificationContent = {
        short: '',
        medium: '',
        detailed: ''
      };

      expect(() => {
        notificationService.notify(emptyContent, sampleOptions);
      }).not.toThrow();

      expect(mockButtonUpdate).toHaveBeenCalledWith({
        dice_roll: ''
      });
    });

    it('should handle zero durations', () => {
      const options: NotificationOptions = {
        ...sampleOptions,
        buttonDuration: 0,
        notificationDuration: 0
      };

      notificationService.notify(sampleContent, options);

      // Clear initial calls
      mockButtonUpdate.mockClear();
      mockNotificationUpdate.mockClear();

      // Advance minimal time
      vi.advanceTimersByTime(1);

      // Should be cleared immediately
      expect(mockButtonUpdate).toHaveBeenCalledWith({});
      expect(mockNotificationUpdate).toHaveBeenCalledWith({});
    });
  });
});