import React from 'react';

/**
 * Props for the ActionButton component.
 */
interface ActionButtonProps {
  /** The text label displayed on the button. */
  label: string;
  /** The visual style variant of the button. */
  variant: 'primary' | 'secondary' | 'danger';
  /** Callback function to be called when the button is clicked. */
  onClick: () => void;
  /** If true, the button will be disabled. */
  disabled?: boolean;
  /** The ARIA label for accessibility, providing a more descriptive name for screen readers. */
  ariaLabel?: string;
  /** If true, the button will display "Processing..." and be disabled. */
  isLoading?: boolean;
}

/**
 * ActionButton Component
 *
 * A reusable button component with predefined style variants and built-in loading states.
 * It ensures consistent styling and behavior for interactive elements across the UI.
 *
 * @param {ActionButtonProps} props - The props for the component.
 * @returns {JSX.Element} The rendered ActionButton component.
 */
export function ActionButton({
  label,
  variant,
  onClick,
  disabled,
  ariaLabel,
  isLoading,
}: ActionButtonProps) {
  return (
    <button
      className={`action-button action-button--${variant}`}
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label={ariaLabel || label}
    >
      {isLoading ? 'Processing...' : label}
    </button>
  );
}
