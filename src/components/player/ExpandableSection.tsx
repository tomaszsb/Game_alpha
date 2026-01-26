import React, { ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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

// Spring physics for expand/collapse animation
const expandSpring = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
};

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

  // Check for desktop mode and reduced motion preference
  const prefersReducedMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Use framer-motion on desktop when reduced motion is not preferred
  const useMotion = isDesktop && !prefersReducedMotion;

  // Handle keyboard navigation for arrow keys
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && !isExpanded) {
      event.preventDefault();
      onToggle();
    } else if (event.key === 'ArrowUp' && isExpanded) {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="expandable-section" data-default-expanded={defaultExpandedOnDesktop}>
      <div className="expandable-section__header-container">
        <button
          id={headerId}
          className="expandable-section__header"
          onClick={onToggle}
          onKeyDown={handleKeyDown}
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
      {useMotion ? (
        // Desktop: Use framer-motion for smooth spring animations
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              id={contentId}
              className="expandable-section__content expandable-section__content--motion"
              role="region"
              aria-labelledby={headerId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={expandSpring}
              style={{ overflow: 'hidden' }}
            >
              <div className="expandable-section__content-inner">
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
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        // Mobile / Reduced motion: Use CSS transitions
        <div
          id={contentId}
          className={`expandable-section__content ${isExpanded ? 'expandable-section__content--expanded' : ''}`}
          role="region"
          aria-labelledby={headerId}
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
      )}
    </div>
  );
};