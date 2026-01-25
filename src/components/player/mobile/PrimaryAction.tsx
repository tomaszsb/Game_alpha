// src/components/player/mobile/PrimaryAction.tsx
//
// Sticky primary action button for mobile player panel.
// Context-aware - shows different actions based on view state.
// Created: January 24, 2026
// Updated: January 25, 2026 - Added CSS classes, theme support, touch-action, haptics

import React from 'react';
import { PlayerViewState, ActionPrompt } from '../../../services/PlayerViewStateService';
import { haptics } from '../../../utils/haptics';
import './PrimaryAction.css';

export interface PrimaryActionProps {
  viewState: PlayerViewState;
  actionPrompt?: ActionPrompt;
  canEndTurn: boolean;
  isMyTurn: boolean;
  hasSelectedChoice: boolean;
  isLoading?: boolean;

  // Action handlers
  onContinueStory?: () => void;
  onPerformAction?: () => void;
  onEndTurn?: () => void;
  onConfirmChoice?: () => void;
}

interface ButtonConfig {
  label: string;
  icon: string;
  className: string;
  disabled: boolean;
}

/**
 * Get button configuration based on view state.
 */
function getButtonConfig(
  viewState: PlayerViewState,
  actionPrompt?: ActionPrompt,
  canEndTurn: boolean = false,
  hasSelectedChoice: boolean = false
): ButtonConfig {
  switch (viewState) {
    case 'STORY_MODE':
      return {
        label: 'Continue',
        icon: '📖',
        className: 'mobile-primary-action__button--story',
        disabled: false
      };

    case 'ACTION_MODE':
      if (actionPrompt) {
        const icon = actionPrompt.type === 'dice_roll' ? '🎲' : '▶️';
        return {
          label: actionPrompt.label,
          icon,
          className: 'mobile-primary-action__button--action',
          disabled: false
        };
      }
      return {
        label: 'Complete Action',
        icon: '▶️',
        className: 'mobile-primary-action__button--action',
        disabled: false
      };

    case 'DECISION_MODE':
      return {
        label: hasSelectedChoice ? 'Confirm Choice' : 'Select an Option',
        icon: hasSelectedChoice ? '✅' : '🎯',
        className: hasSelectedChoice
          ? 'mobile-primary-action__button--decision-ready'
          : 'mobile-primary-action__button--decision-pending',
        disabled: !hasSelectedChoice
      };

    case 'SUMMARY_MODE':
      return {
        label: canEndTurn ? 'End Turn' : 'Complete Actions',
        icon: canEndTurn ? '✓' : '⏳',
        className: canEndTurn
          ? 'mobile-primary-action__button--summary-ready'
          : 'mobile-primary-action__button--summary-pending',
        disabled: !canEndTurn
      };

    case 'WAITING_MODE':
    default:
      return {
        label: 'Waiting...',
        icon: '⏳',
        className: '',
        disabled: true
      };
  }
}

/**
 * PrimaryAction - Sticky action button at bottom of mobile panel.
 * Shows context-appropriate action based on current view state.
 */
export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  viewState,
  actionPrompt,
  canEndTurn,
  isMyTurn,
  hasSelectedChoice,
  isLoading = false,
  onContinueStory,
  onPerformAction,
  onEndTurn,
  onConfirmChoice
}) => {
  const config = getButtonConfig(viewState, actionPrompt, canEndTurn, hasSelectedChoice);

  const handleClick = () => {
    if (isLoading || config.disabled || !isMyTurn) return;

    // Haptic feedback on button press
    haptics.buttonPress();

    switch (viewState) {
      case 'STORY_MODE':
        onContinueStory?.();
        break;
      case 'ACTION_MODE':
        onPerformAction?.();
        break;
      case 'DECISION_MODE':
        haptics.success(); // Extra feedback for confirming choice
        onConfirmChoice?.();
        break;
      case 'SUMMARY_MODE':
        haptics.success(); // Extra feedback for ending turn
        onEndTurn?.();
        break;
    }
  };

  const isDisabled = config.disabled || isLoading || !isMyTurn;
  const buttonClassName = `mobile-primary-action__button ${config.className}`;

  return (
    <div className="mobile-primary-action" data-testid="primary-action-container">
      <button
        className={buttonClassName}
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={config.label}
        data-testid="primary-action-button"
      >
        {isLoading ? (
          <>
            <span className="mobile-primary-action__icon mobile-primary-action__spinner">
              ⏳
            </span>
            <span className="mobile-primary-action__label">Processing...</span>
          </>
        ) : (
          <>
            <span className="mobile-primary-action__icon">{config.icon}</span>
            <span className="mobile-primary-action__label">{config.label}</span>
          </>
        )}
      </button>

      {/* Not your turn indicator */}
      {!isMyTurn && (
        <div className="mobile-primary-action__waiting">
          Waiting for other player...
        </div>
      )}
    </div>
  );
};
