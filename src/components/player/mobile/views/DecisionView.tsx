// src/components/player/mobile/views/DecisionView.tsx
//
// View component for DECISION_MODE - displays choice options.
// Created: January 24, 2026

import React from 'react';
import { DecisionChoice } from '../../../../services/PlayerViewStateService';
import { Choice } from '../../../../types/CommonTypes';

export interface DecisionViewProps {
  choices: DecisionChoice[];
  choiceType?: Choice['type'];
  onSelect: (choiceId: string) => void;
}

/**
 * Get prompt text based on choice type.
 */
function getPromptText(choiceType?: Choice['type']): string {
  switch (choiceType) {
    case 'MOVEMENT':
      return 'Choose your destination:';
    case 'CARD_SELECTION':
      return 'Select a card:';
    case 'CARD_DISCARD':
      return 'Choose a card to discard:';
    case 'CARD_GIVE':
      return 'Choose a card to give:';
    case 'CARD_REPLACEMENT':
      return 'Choose a replacement card:';
    case 'PLAYER_TARGET':
      return 'Select a player:';
    case 'TARGET_SELECTION':
      return 'Select a target:';
    default:
      return 'Make your choice:';
  }
}

/**
 * DecisionView - Displays choice options for the player.
 * Shown when player must choose between multiple options.
 */
export const DecisionView: React.FC<DecisionViewProps> = ({
  choices,
  choiceType,
  onSelect
}) => {
  const promptText = getPromptText(choiceType);

  return (
    <div className="mobile-context-decision">
      <div className="decision-prompt">{promptText}</div>
      <div className="decision-options">
        {choices.map((choice) => (
          <button
            key={choice.id}
            onClick={() => onSelect(choice.id)}
            className={`decision-option ${choice.isSelected ? 'decision-option--selected' : ''}`}
          >
            <span className="option-icon">
              {choice.isSelected ? '✅' : '🎯'}
            </span>
            <span className="option-label">{choice.label}</span>
            {choice.description && (
              <span className="option-description">{choice.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
