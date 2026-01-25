// src/components/player/mobile/views/SummaryView.tsx
//
// View component for SUMMARY_MODE - displays turn summary.
// Created: January 24, 2026

import React from 'react';
import { TurnSummary } from '../../../../services/PlayerViewStateService';

export interface SummaryViewProps {
  summaryData?: TurnSummary;
  canEndTurn: boolean;
}

/**
 * SummaryView - Displays turn summary when all actions are complete.
 * Shown when player is ready to end their turn.
 */
export const SummaryView: React.FC<SummaryViewProps> = ({
  summaryData,
  canEndTurn
}) => {
  return (
    <div className="mobile-context-summary">
      <div className="summary-icon">
        {canEndTurn ? '✓' : '⏳'}
      </div>
      <div className="summary-message">
        {canEndTurn ? 'Ready to end turn' : 'Complete remaining actions'}
      </div>

      {/* Show summary details if available */}
      {summaryData && (summaryData.moneyChange !== 0 ||
        summaryData.timeChange !== 0 ||
        summaryData.cardsDrawn.length > 0) && (
        <div className="summary-details">
          {summaryData.moneyChange !== 0 && (
            <div className="summary-detail">
              <span className="detail-icon">💰</span>
              <span className="detail-value" style={{
                color: summaryData.moneyChange > 0 ? '#2e7d32' : '#c62828'
              }}>
                {summaryData.moneyChange > 0 ? '+' : ''}
                ${summaryData.moneyChange.toLocaleString()}
              </span>
            </div>
          )}
          {summaryData.timeChange !== 0 && (
            <div className="summary-detail">
              <span className="detail-icon">⏱️</span>
              <span className="detail-value">
                +{summaryData.timeChange} days
              </span>
            </div>
          )}
          {summaryData.cardsDrawn.length > 0 && (
            <div className="summary-detail">
              <span className="detail-icon">🃏</span>
              <span className="detail-value">
                +{summaryData.cardsDrawn.length} card{summaryData.cardsDrawn.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
