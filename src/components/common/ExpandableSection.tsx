import React, { ReactNode } from 'react';

/**
 * Props for the ExpandableSection component.
 */
interface ExpandableSectionProps {
  /** The title of the section displayed in the header. */
  title: string;
  /** An icon to display next to the title. */
  icon: string;
  /** If true, a red action indicator (🔴) will be shown in the header. */
  hasAction: boolean;
  /** Controls whether the section content is currently expanded or collapsed. */
  isExpanded: boolean;
  /** Callback function to be called when the section header is clicked to toggle expansion. */
  onToggle: () => void;
  /** The content to be rendered inside the expandable section. */
  children: ReactNode;
  /** The `aria-controls` attribute for accessibility, linking the header button to the content. */
  ariaControls: string;
  /** If true, the section will be expanded by default on desktop viewports. */
  defaultExpandedOnDesktop?: boolean;
  /** If true, a loading skeleton will be displayed instead of the children. */
  isLoading?: boolean;
  /** An error message to display in the section, typically replacing the children. */
  error?: string;
  /** Optional callback function to be called when a retry button is clicked after an error. */
  onRetry?: () => void;
}

/**
 * ExpandableSection Component
 *
 * A reusable UI component that provides an expandable/collapsible section for content.
 * It includes a header with a title, icon, and an optional action indicator.
 * It also supports displaying loading states (skeleton) and error messages.
 *
 * @param {ExpandableSectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered ExpandableSection component.
 */
export function ExpandableSection({
  title,
  icon,
  hasAction,
  isExpanded,
  onToggle,
  children,
  ariaControls,
  defaultExpandedOnDesktop,
  isLoading,
  error,
  onRetry,
}: ExpandableSectionProps) {
  return (
    <div className="expandable-section">
      <button
        className="expandable-section__header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={ariaControls}
      >
        <span className="section-title">{icon} {title}</span>
        {hasAction && (
          <span
            className="action-indicator"
            role="status"
            aria-label="Action available"
          >
            🔴
          </span>
        )}
        <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
      </button>

      <div
        id={ariaControls}
        role="region"
        hidden={!isExpanded}
        className={`expandable-section__content ${isExpanded ? '--expanded' : ''}`}
      >
        {isLoading ? (
          <div className="expandable-section__content--loading">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
          </div>
        ) : error ? (
          <div className="expandable-section__error">
            {error}
            {onRetry && <button onClick={onRetry}>Retry</button>}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
