import React, { useState } from 'react';
import { Card } from '../../../types/DataTypes';
import { ActionButton } from '../../common/ActionButton';
import { ExpandableSection } from '../../common/ExpandableSection';

/**
 * Props for the CurrentCardSection component.
 */
interface CurrentCardSectionProps {
  /** The card data to display in the section. */
  card: Card;
  /** Callback function to handle a choice made by the player. */
  onChoice: (choiceId: string) => Promise<void>;
}

function getChoiceVariant(label: string) {
  if (label.toLowerCase().includes('accept')) return 'primary';
  if (label.toLowerCase().includes('reject')) return 'danger';
  return 'secondary';
}

/**
 * CurrentCardSection Component
 *
 * Displays the details of the player's current card, including its story,
 * action required, potential outcomes, and dynamic choice buttons (if available).
 * This component is self-managed for its expanded state.
 *
 * @param {CurrentCardSectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered CurrentCardSection component.
 */
export function CurrentCardSection({ card, onChoice }: CurrentCardSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const choices = card.effect?.type === 'choice'
    ? (card.effect.choices || [])
    : [];

  const handleChoice = async (choiceId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await onChoice(choiceId);
    } catch (err) {
      setError('Failed to process choice. Please try again.');
      console.error('Choice error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ExpandableSection
      title={card.name || card.card_name}
      icon="📋"
      hasAction={choices.length > 0}
      isExpanded={isExpanded}
      onToggle={() => setIsExpanded(!isExpanded)}
      ariaControls="current-card-content"
      defaultExpandedOnDesktop={true}
      isLoading={isLoading}
      error={error || undefined}
    >
      <div className="card-content">
        <div className="card-story">{card.story || card.description}</div>
        <div className="card-action-required">{card.actionRequired}</div>
        <div className="card-outcomes">{card.potentialOutcomes}</div>

        {choices.length > 0 && (
          <div className="card-choices">
            {choices.map((choice: any, idx: number) => (
              <ActionButton
                key={idx}
                label={choice.label}
                variant={getChoiceVariant(choice.label)}
                onClick={() => handleChoice(choice.id)}
                disabled={isLoading}
                isLoading={isLoading}
                ariaLabel={choice.description}
              />
            ))}
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}