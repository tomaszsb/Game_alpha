// src/services/NotificationService.ts

import { IStateService, ILoggingService } from '../types/ServiceContracts';

export interface NotificationContent {
  // Three levels of detail for the same action
  short: string;    // Button feedback (very brief)
  medium: string;   // Player notification area (concise but informative)
  detailed: string; // GameLog (full context and details)
}

export interface NotificationOptions {
  playerId: string;
  playerName: string;
  actionType: string;
  buttonDuration?: number;     // How long to show button feedback (default: 2000ms)
  notificationDuration?: number; // How long to show notification area (default: 4000ms)
  skipButton?: boolean;        // Skip button feedback
  skipNotification?: boolean;  // Skip notification area
  skipLog?: boolean;          // Skip GameLog entry
}

export interface INotificationService {
  notify(content: NotificationContent, options: NotificationOptions): void;
  clearPlayerNotifications(playerId?: string): void;
  clearAllNotifications(): void;
}

export class NotificationService implements INotificationService {
  private stateService: IStateService;
  private loggingService: ILoggingService;

  // Button feedback state
  private buttonFeedback: { [actionType: string]: string } = {};
  private buttonTimeouts: { [actionType: string]: NodeJS.Timeout } = {};

  // Notification area state
  private playerNotifications: { [playerId: string]: string } = {};
  private notificationTimeouts: { [playerId: string]: NodeJS.Timeout } = {};

  // Callbacks to update UI state
  private onButtonFeedbackUpdate?: (feedback: { [actionType: string]: string }) => void;
  private onNotificationUpdate?: (notifications: { [playerId: string]: string }) => void;

  constructor(stateService: IStateService, loggingService: ILoggingService) {
    this.stateService = stateService;
    this.loggingService = loggingService;
  }

  // Set callbacks for UI updates
  setUpdateCallbacks(
    onButtonUpdate: (feedback: { [actionType: string]: string }) => void,
    onNotificationUpdate: (notifications: { [playerId: string]: string }) => void
  ) {
    this.onButtonFeedbackUpdate = onButtonUpdate;
    this.onNotificationUpdate = onNotificationUpdate;
  }

  notify(content: NotificationContent, options: NotificationOptions): void {
    const {
      playerId,
      playerName,
      actionType,
      buttonDuration = 2000,
      notificationDuration = 4000,
      skipButton = false,
      skipNotification = false,
      skipLog = false
    } = options;

    // 1. Button Feedback (shortest) - Updates button text temporarily
    if (!skipButton && this.onButtonFeedbackUpdate) {
      this.setButtonFeedback(actionType, content.short, buttonDuration);
    }

    // 2. Player Notification Area (medium) - Shows in player's notification area
    if (!skipNotification && this.onNotificationUpdate) {
      this.setPlayerNotification(playerId, content.medium, notificationDuration);
    }

    // 3. GameLog (detailed) - EffectEngine handles logging with better context
  }

  private setButtonFeedback(actionType: string, message: string, duration: number): void {
    // Clear existing timeout
    if (this.buttonTimeouts[actionType]) {
      clearTimeout(this.buttonTimeouts[actionType]);
    }

    // Set feedback
    this.buttonFeedback[actionType] = message;
    this.onButtonFeedbackUpdate?.(this.buttonFeedback);

    // Set timeout to clear
    this.buttonTimeouts[actionType] = setTimeout(() => {
      delete this.buttonFeedback[actionType];
      delete this.buttonTimeouts[actionType];
      this.onButtonFeedbackUpdate?.(this.buttonFeedback);
    }, duration);
  }

  private setPlayerNotification(playerId: string, message: string, duration: number): void {
    // Clear existing timeout
    if (this.notificationTimeouts[playerId]) {
      clearTimeout(this.notificationTimeouts[playerId]);
    }

    // Set notification
    this.playerNotifications[playerId] = message;
    this.onNotificationUpdate?.(this.playerNotifications);

    // Set timeout to clear
    this.notificationTimeouts[playerId] = setTimeout(() => {
      delete this.playerNotifications[playerId];
      delete this.notificationTimeouts[playerId];
      this.onNotificationUpdate?.(this.playerNotifications);
    }, duration);
  }

  clearPlayerNotifications(playerId?: string): void {
    if (playerId) {
      // Clear specific player
      if (this.notificationTimeouts[playerId]) {
        clearTimeout(this.notificationTimeouts[playerId]);
        delete this.notificationTimeouts[playerId];
      }
      delete this.playerNotifications[playerId];
    } else {
      // Clear all players
      Object.values(this.notificationTimeouts).forEach(timeout => clearTimeout(timeout));
      this.notificationTimeouts = {};
      this.playerNotifications = {};
    }
    this.onNotificationUpdate?.(this.playerNotifications);
  }

  clearAllNotifications(): void {
    // Clear button feedback
    Object.values(this.buttonTimeouts).forEach(timeout => clearTimeout(timeout));
    this.buttonTimeouts = {};
    this.buttonFeedback = {};
    this.onButtonFeedbackUpdate?.(this.buttonFeedback);

    // Clear player notifications
    this.clearPlayerNotifications();
  }

  // Get current state (for UI components)
  getButtonFeedback(): { [actionType: string]: string } {
    return { ...this.buttonFeedback };
  }

  getPlayerNotifications(): { [playerId: string]: string } {
    return { ...this.playerNotifications };
  }
}