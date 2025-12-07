import React, { useState } from 'react';
import { ExpandableSection } from '../../common/ExpandableSection';

/**
 * Props for the StorySection component.
 */
interface StorySectionProps {
  /** The story text to display */
  story: string;
  /** The space name for context */
  spaceName: string;
}

/**
 * StorySection Component
 *
 * Displays the narrative/story for the current space.
 * This helps players understand the context and significance of their current location.
 *
 * @param {StorySectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered StorySection component.
 */
export function StorySection({ story, spaceName }: StorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded so players see it

  if (!story || story.trim() === '') {
    return null; // Don't render if there's no story
  }

  return (
    <ExpandableSection
      title="📖 Story"
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      actionIndicator={null}
    >
      <div style={{
        fontSize: '1.1rem', // Slightly larger font as requested
        lineHeight: '1.6',
        color: '#2c3e50',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        border: '2px solid #4caf50',
        fontWeight: '500' // Make it slightly bold for prominence
      }}>
        {story}
      </div>
    </ExpandableSection>
  );
}
