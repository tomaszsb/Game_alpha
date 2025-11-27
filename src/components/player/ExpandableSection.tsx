import React, { ReactNode } from 'react';
import './ExpandableSection.css';

export interface ExpandableSectionProps {
  title: string;
  icon: string;
  hasAction: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  ariaControls: string;
  defaultExpandedOnDesktop?: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  headerActions?: ReactNode;
  summary?: ReactNode;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  icon,
  hasAction,
  isExpanded,
  onToggle,
  children,
  ariaControls,
  defaultExpandedOnDesktop = false,
  isLoading = false,
  error = null,
  onRetry,
  headerActions,
  summary
}) => {
  const headerId = `${ariaControls}-header`;
  const contentId = ariaControls;

  return (
    <div className="expandable-section" data-default-expanded={defaultExpandedOnDesktop}>
      <div className="expandable-section__header-container">
        <button
          id={headerId}
          className="expandable-section__header"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          type="button"
        >
          {/* --- LEFT COLUMN --- */}
          <div className="header-col--left">
            <span className="section-icon" aria-hidden="true">{icon}</span>
            <span className="section-title">{title}</span>
          </div>

          {/* --- RIGHT COLUMN --- */}
          <div className="header-col--right">
            {summary && <span className="section-summary">{summary}</span>}
            <div className="section-controls">
              {hasAction && (
                <span className="action-indicator" role="status" aria-label="Action available"></span>
              )}
              <span className="expand-icon" aria-hidden="true">
                {isExpanded ? '▼' : '▶'}
              </span>
            </div>
          </div>
        </button>

        {/* --- HEADER ACTIONS (outside button) --- */}
        {headerActions && (
          <div className="expandable-section__header-actions">
            {headerActions}
          </div>
        )}
      </div>

      {/* --- COLLAPSIBLE CONTENT --- */}
      <div
        id={contentId}
        className={`expandable-section__content ${isExpanded ? 'expandable-section__content--expanded' : ''}`}
        role="region"
        aria-labelledby={headerId}
        hidden={!isExpanded}
      >
        {isLoading ? (
          <div className="expandable-section__content--loading">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
          </div>
        ) : error ? (
          <div className="expandable-section__error">
            <p>{error}</p>
            {onRetry && (
              <button onClick={onRetry} className="retry-button">
                Retry
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};