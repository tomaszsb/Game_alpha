// src/components/player/mobile/views/StoryView.tsx
//
// View component for STORY_MODE - displays narrative content.
// Created: January 24, 2026
// Updated: January 25, 2026 - Added test IDs, accessibility

import React from 'react';

export interface StoryViewProps {
  storyContent: string;
  onContinue?: () => void;
}

/**
 * StoryView - Displays the space story/narrative content.
 * Shown when player first lands on a space.
 * Supports long stories (300%+ of typical length) with scrollable text.
 */
export const StoryView: React.FC<StoryViewProps> = ({
  storyContent,
  onContinue
}) => {
  return (
    <div
      className="mobile-context-story"
      onClick={onContinue}
      data-testid="story-container"
      role="article"
      aria-label="Story content"
    >
      <div
        className="story-text"
        data-testid="story-text"
      >
        {storyContent}
      </div>
      <div
        className="story-hint"
        data-testid="story-hint"
        aria-live="polite"
      >
        Tap Continue to proceed
      </div>
    </div>
  );
};
