// src/components/player/mobile/views/WaitingView.tsx
//
// View component for WAITING_MODE - displays waiting state.
// Created: January 24, 2026

import React from 'react';

export interface WaitingViewProps {
  message?: string;
  isProcessing?: boolean;
}

/**
 * WaitingView - Displays waiting state.
 * Shown when waiting for other players or processing.
 */
export const WaitingView: React.FC<WaitingViewProps> = ({
  message = 'Waiting...',
  isProcessing = false
}) => {
  return (
    <div className="mobile-context-waiting">
      <div className="waiting-icon">
        {isProcessing ? '⚙️' : '⏳'}
      </div>
      <div className="waiting-message">{message}</div>
    </div>
  );
};
