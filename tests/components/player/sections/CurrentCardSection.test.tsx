import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CurrentCardSection } from '../../../../src/components/player/sections/CurrentCardSection';
import { Card } from '../../../../src/types/DataTypes';

const mockCard: Card = {
  card_id: 'test-card',
  name: 'Test Card',
  story: 'This is a test card.',
  actionRequired: 'Make a choice.',
  potentialOutcomes: 'Something might happen.',
  effect: {
    type: 'choice',
    choices: [
      { id: 'accept', label: 'Accept' },
      { id: 'reject', label: 'Reject' },
    ],
  },
};

describe('CurrentCardSection', () => {
  beforeEach(() => {
    cleanup();
  });

  it('should render the card details', () => {
    const { getByText } = render(
      <CurrentCardSection card={mockCard} onChoice={vi.fn()} />
    );

    expect(getByText((content, element) => content.includes('Test Card'))).toBeInTheDocument();
    expect(getByText('This is a test card.')).toBeInTheDocument();
    expect(getByText('Make a choice.')).toBeInTheDocument();
    expect(getByText('Something might happen.')).toBeInTheDocument();
  });

  it('should render the choice buttons', () => {
    const { getByText } = render(
      <CurrentCardSection card={mockCard} onChoice={vi.fn()} />
    );

    expect(getByText('Accept')).toBeInTheDocument();
    expect(getByText('Reject')).toBeInTheDocument();
  });

  it('should call onChoice with the correct choice id when a button is clicked', async () => {
    const onChoice = vi.fn();
    const { getByText } = render(
      <CurrentCardSection card={mockCard} onChoice={onChoice} />
    );

    fireEvent.click(getByText('Accept'));

    await waitFor(() => {
      expect(onChoice).toHaveBeenCalledWith('accept');
    });
  });

  it('should show a loading skeleton when a choice is being processed', async () => {
    const onChoice = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    const { getByText, container } = render(
      <CurrentCardSection card={mockCard} onChoice={onChoice} />
    );

    const acceptButton = getByText('Accept');
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(container.querySelector('.expandable-section__content--loading')).toBeInTheDocument();
    });

    // After loading, the original button should reappear
    await waitFor(() => {
      expect(getByText('Accept')).toBeInTheDocument();
      expect(container.querySelector('.expandable-section__content--loading')).not.toBeInTheDocument();
    });
  });

  it('should show an error message if onChoice throws an error', async () => {
    const onChoice = vi.fn(() => Promise.reject(new Error('Test error')));
    const { getByText } = render(
      <CurrentCardSection card={mockCard} onChoice={onChoice} />
    );

    fireEvent.click(getByText('Accept'));

    await waitFor(() => {
      expect(getByText('Failed to process choice. Please try again.')).toBeInTheDocument();
    });
  });

  it('should render cards with multiple choices and long descriptions', () => {
    const longDescriptionCard: Card = {
      ...mockCard,
      effect: {
        type: 'choice',
        choices: [
          { id: 'choice1', label: 'Option A' },
          { id: 'choice2', label: 'Option B with a very long description that should be handled gracefully' },
          { id: 'choice3', label: 'Option C' },
        ],
      },
    };
    const onChoice = vi.fn();
    const { getByText } = render(
      <CurrentCardSection card={longDescriptionCard} onChoice={onChoice} />
    );

    expect(getByText('Option A')).toBeInTheDocument();
    expect(getByText('Option B with a very long description that should be handled gracefully')).toBeInTheDocument();
    expect(getByText('Option C')).toBeInTheDocument();

    fireEvent.click(getByText('Option A'));
    expect(onChoice).toHaveBeenCalledWith('choice1');
  });
});
