// src/components/player/mobile/ContextArea.tsx
//
// Context-aware content area that renders different views based on state.
// Created: January 24, 2026

import React from 'react';
import { ViewStateContext } from '../../../services/PlayerViewStateService';
import { StoryView } from './views/StoryView';
import { ActionView } from './views/ActionView';
import { DecisionView } from './views/DecisionView';
import { SummaryView } from './views/SummaryView';
import { WaitingView } from './views/WaitingView';

export interface ContextAreaProps {
  viewContext: ViewStateContext;
  onContinueStory?: () => void;
  onChoiceSelect?: (choiceId: string) => void;
}

/**
 * ContextArea - Renders the appropriate view based on the current state.
 * This is the main content area of the mobile player panel.
 */
export const ContextArea: React.FC<ContextAreaProps> = ({
  viewContext,
  onContinueStory,
  onChoiceSelect
}) => {
  const { state } = viewContext;

  switch (state) {
    case 'STORY_MODE':
      if (!viewContext.storyContent) {
        return <WaitingView message="Loading story..." />;
      }
      return (
        <StoryView
          storyContent={viewContext.storyContent}
          onContinue={onContinueStory}
        />
      );

    case 'ACTION_MODE':
      if (!viewContext.actionPrompt) {
        return <WaitingView message="Loading action..." />;
      }
      return <ActionView actionPrompt={viewContext.actionPrompt} />;

    case 'DECISION_MODE':
      if (!viewContext.choices || viewContext.choices.length === 0) {
        return <WaitingView message="Loading choices..." />;
      }
      return (
        <DecisionView
          choices={viewContext.choices}
          choiceType={viewContext.choiceType}
          onSelect={onChoiceSelect || (() => {})}
        />
      );

    case 'SUMMARY_MODE':
      return (
        <SummaryView
          summaryData={viewContext.summaryData}
          canEndTurn={viewContext.canEndTurn}
        />
      );

    case 'WAITING_MODE':
    default:
      return (
        <WaitingView
          message={viewContext.waitingMessage}
          isProcessing={false}
        />
      );
  }
};
