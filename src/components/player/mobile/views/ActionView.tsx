// src/components/player/mobile/views/ActionView.tsx
//
// View component for ACTION_MODE - displays pending action.
// Created: January 24, 2026

import React from 'react';
import { ActionPrompt } from '../../../../services/PlayerViewStateService';

export interface ActionViewProps {
  actionPrompt: ActionPrompt;
}

/**
 * ActionView - Displays pending action information.
 * Shown when player needs to complete an action (dice roll, manual effect).
 */
export const ActionView: React.FC<ActionViewProps> = ({
  actionPrompt
}) => {
  const icon = actionPrompt.type === 'dice_roll' ? '🎲' : '▶️';

  return (
    <div className="mobile-context-action">
      <div className="action-icon">{icon}</div>
      <div className="action-label">{actionPrompt.label}</div>
      <div className="action-description">{actionPrompt.description}</div>
    </div>
  );
};
