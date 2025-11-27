import React from 'react';
import './ActionButton.css';

/**
 * Props for the ActionButton component
 */
export interface ActionButtonProps {
  /** Text label displayed on the button */
  label: string;

  /** Visual variant determining the button's color scheme */
  variant: 'primary' | 'secondary' | 'danger';

  /** Callback fired when the button is clicked */
  onClick: () => void;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Custom ARIA label for screen readers (falls back to label if not provided) */
  ariaLabel?: string;

  /** Whether to show loading state with spinner */
  isLoading?: boolean;
}

/**
 * ActionButton Component
 *
 * A reusable button component with multiple visual variants and loading states.
 * Used throughout the Player Panel for actions like "Roll for Money", "Accept", "Reject", etc.
 *
 * **Variants:**
 * - `primary`: Blue background - used for positive/accepting actions (e.g., "Accept", "Roll for Money")
 * - `secondary`: Gray background - used for neutral/negotiating actions (e.g., "Negotiate", "Maybe")
 * - `danger`: Red background - used for negative/rejecting actions (e.g., "Reject", "Decline")
 *
 * **Features:**
 * - Loading state with spinner and "Processing..." text
 * - Disabled state with visual feedback
 * - Full keyboard accessibility
 * - Custom ARIA labels for screen readers
 *
 * **Accessibility:**
 * - Uses `aria-label` for screen reader support
 * - Uses `type="button"` to prevent form submission
 * - Loading spinner hidden from screen readers with `aria-hidden="true"`
 *
 * @example
 * ```tsx
 * <ActionButton
 *   label="Roll for Money"
 *   variant="primary"
 *   onClick={handleRollForMoney}
 *   disabled={isLoading}
 *   isLoading={isLoading}
 *   ariaLabel="Roll dice to gain money resource"
 * />
 * ```
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  variant,
  onClick,
  disabled = false,
  ariaLabel,
  isLoading = false
}) => {
  return (
    <button
      className={`action-button action-button--${variant}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel || label}
      type="button"
    >
      {isLoading ? (
        <>
          <span className="loading-spinner" aria-hidden="true"></span>
          Processing...
        </>
      ) : (
        label
      )}
    </button>
  );
};
