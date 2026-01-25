// src/components/player/mobile/views/StoryView.tsx
//
// View component for STORY_MODE - displays narrative content.
// Created: January 24, 2026

import React from 'react';

export interface StoryViewProps {
  storyContent: string;
  onContinue?: () => void;
}

/**
 * StoryView - Displays the space story/narrative content.
 * Shown when player first lands on a space.
 */
export const StoryView: React.FC<StoryViewProps> = ({
  storyContent,
  onContinue
}) => {
  return (
    <div className="mobile-context-story" onClick={onContinue}>
      <div className="story-text">{storyContent}</div>
      <div className="story-hint">Tap Continue to proceed</div>
    </div>
  );
};
