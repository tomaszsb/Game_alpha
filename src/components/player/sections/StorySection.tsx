import React, { useState } from 'react';
import { ExpandableSection } from '../ExpandableSection';

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

  console.log('📖 StorySection render:', { story, spaceName, isEmpty: !story || story.trim() === '' });

  if (!story || story.trim() === '') {
    console.log('📖 StorySection: Returning null (no story)');
    return null; // Don't render if there's no story
  }

  return (
    <ExpandableSection
      title="Story"
      icon="📖"
      hasAction={false}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      ariaControls={`story-section-${spaceName}`}
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
