// src/components/player/mobile/PrimaryAction.tsx
//
// Sticky primary action button for mobile player panel.
// Context-aware - shows different actions based on view state.
// Created: January 24, 2026

import React from 'react';
import { PlayerViewState, ActionPrompt } from '../../../services/PlayerViewStateService';

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

/**
 * Get button configuration based on view state.
 */
function getButtonConfig(
  viewState: PlayerViewState,
  actionPrompt?: ActionPrompt,
  canEndTurn: boolean = false,
  hasSelectedChoice: boolean = false
): { label: string; icon: string; color: string; disabled: boolean } {
  switch (viewState) {
    case 'STORY_MODE':
      return {
        label: 'Continue',
        icon: '📖',
        color: '#2196f3',
        disabled: false
      };

    case 'ACTION_MODE':
      if (actionPrompt) {
        const icon = actionPrompt.type === 'dice_roll' ? '🎲' : '▶️';
        return {
          label: actionPrompt.label,
          icon,
          color: '#ff9800',
          disabled: false
        };
      }
      return {
        label: 'Complete Action',
        icon: '▶️',
        color: '#ff9800',
        disabled: false
      };

    case 'DECISION_MODE':
      return {
        label: hasSelectedChoice ? 'Confirm Choice' : 'Select an Option',
        icon: hasSelectedChoice ? '✅' : '🎯',
        color: hasSelectedChoice ? '#4caf50' : '#9e9e9e',
        disabled: !hasSelectedChoice
      };

    case 'SUMMARY_MODE':
      return {
        label: canEndTurn ? 'End Turn' : 'Complete Actions',
        icon: canEndTurn ? '✓' : '⏳',
        color: canEndTurn ? '#4caf50' : '#9e9e9e',
        disabled: !canEndTurn
      };

    case 'WAITING_MODE':
    default:
      return {
        label: 'Waiting...',
        icon: '⏳',
        color: '#9e9e9e',
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

    switch (viewState) {
      case 'STORY_MODE':
        onContinueStory?.();
        break;
      case 'ACTION_MODE':
        onPerformAction?.();
        break;
      case 'DECISION_MODE':
        onConfirmChoice?.();
        break;
      case 'SUMMARY_MODE':
        onEndTurn?.();
        break;
    }
  };

  const isDisabled = config.disabled || isLoading || !isMyTurn;

  return (
    <div
      className="mobile-primary-action"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        backgroundColor: '#fff',
        borderTop: '1px solid #e0e0e0',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
        zIndex: 100
      }}
    >
      <button
        onClick={handleClick}
        disabled={isDisabled}
        style={{
          width: '100%',
          padding: '14px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          backgroundColor: isDisabled ? '#e0e0e0' : config.color,
          color: isDisabled ? '#9e9e9e' : '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transition: 'all 0.2s ease',
          minHeight: '48px',
          boxShadow: isDisabled ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}
        aria-label={config.label}
      >
        {isLoading ? (
          <>
            <span
              style={{
                display: 'inline-block',
                animation: 'spin 1s linear infinite'
              }}
            >
              ⏳
            </span>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </>
        )}
      </button>

      {/* Not your turn indicator */}
      {!isMyTurn && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '11px',
            color: '#666',
            marginTop: '4px'
          }}
        >
          Waiting for other player...
        </div>
      )}

      {/* Inline keyframes for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
