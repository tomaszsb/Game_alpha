// src/components/modals/shared/ModalBase.tsx
// Shared modal wrapper component with consistent styling and mobile-friendly design

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { theme, colors } from '../../../styles/theme';

export interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  emoji?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  headerColor?: string;
  headerBorderColor?: string;
  testId?: string;
  /** Trigger shake animation for negative effects (L cards, bad outcomes) */
  shake?: boolean;
}

/**
 * ModalBase - Standardized modal wrapper for consistent UI across the app.
 *
 * Features:
 * - Consistent overlay, border radius, and shadows
 * - Standard close button (top-right)
 * - Escape key and click-outside-to-close support
 * - Mobile-responsive design with touch-friendly targets
 * - Accessible with proper focus management
 */
export function ModalBase({
  isOpen,
  onClose,
  title,
  emoji,
  children,
  footer,
  maxWidth = '500px',
  headerColor,
  headerBorderColor,
  testId,
  shake = false,
}: ModalBaseProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Focus trap and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus the modal when it opens
    modalRef.current?.focus();

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  // Responsive styles
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.modal.overlay.backgroundColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: theme.modal.overlay.zIndex,
    padding: isMobile ? theme.mobile.modal.padding : theme.modal.overlay.padding,
  };

  // Determine animation - shake after slide-in for negative effects
  const animationValue = shake
    ? `modalSlideIn ${theme.modal.animation.duration} ${theme.modal.animation.easing}, modalShake 0.4s ease-out 0.15s`
    : `modalSlideIn ${theme.modal.animation.duration} ${theme.modal.animation.easing}`;

  const containerStyle: React.CSSProperties = {
    backgroundColor: theme.modal.container.background,
    borderRadius: isMobile ? theme.mobile.modal.borderRadius : theme.modal.container.borderRadius,
    boxShadow: theme.modal.container.boxShadow,
    maxWidth: isMobile ? `calc(100% - ${theme.mobile.modal.margin} * 2)` : maxWidth,
    width: '100%',
    maxHeight: theme.modal.container.maxHeight,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
    // Animation - with optional shake for negative effects
    animation: animationValue,
  };

  const headerStyle: React.CSSProperties = {
    padding: isMobile ? '12px 16px' : theme.modal.header.padding,
    backgroundColor: headerColor || theme.modal.header.backgroundColor,
    borderBottom: `3px solid ${headerBorderColor || colors.primary.main}`,
    borderRadius: `${isMobile ? theme.mobile.modal.borderRadius : theme.modal.container.borderRadius} ${isMobile ? theme.mobile.modal.borderRadius : theme.modal.container.borderRadius} 0 0`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: isMobile ? theme.mobile.typography.heading : theme.typography.heading.h3.fontSize,
    fontWeight: 'bold',
    color: colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: theme.modal.closeButton.fontSize,
    color: theme.modal.closeButton.color,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: theme.borderRadius.sm,
    lineHeight: 1,
    // Touch-friendly size
    minWidth: theme.mobile.minTapTarget,
    minHeight: theme.mobile.minTapTarget,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.fast,
    flexShrink: 0,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: isMobile ? '16px' : theme.modal.body.padding,
    // Smooth scrolling for touch devices
    WebkitOverflowScrolling: 'touch',
  };

  const footerStyle: React.CSSProperties = {
    padding: isMobile ? '12px 16px' : theme.modal.footer.padding,
    borderTop: `1px solid ${colors.secondary.light}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.modal.footer.gap,
    flexWrap: 'wrap',
  };

  return (
    <>
      {/* Inject animation keyframes */}
      <style>
        {`
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          @keyframes modalShake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
            20%, 40%, 60%, 80% { transform: translateX(8px); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes modalShake {
              0%, 100% { transform: translateX(0); }
            }
          }
        `}
      </style>
      <div
        style={overlayStyle}
        onClick={handleBackdropClick}
        data-testid={testId ? `${testId}-overlay` : 'modal-overlay'}
      >
        <div
          ref={modalRef}
          style={containerStyle}
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          data-testid={testId}
        >
          {/* Header */}
          <div style={headerStyle}>
            <h2 id="modal-title" style={titleStyle}>
              {emoji && <span>{emoji}</span>}
              {title}
            </h2>
            <button
              onClick={onClose}
              style={closeButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.secondary.light;
                e.currentTarget.style.color = theme.modal.closeButton.hoverColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.modal.closeButton.color;
              }}
              aria-label="Close modal"
              title="Close"
            >
              {theme.emoji.close}
            </button>
          </div>

          {/* Body */}
          <div style={bodyStyle}>
            {children}
          </div>

          {/* Footer (optional) */}
          {footer && (
            <div style={footerStyle}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Standard modal button styles - use these for consistent button appearance
 */
export const modalButtonStyles = {
  primary: {
    padding: theme.button.padding.md,
    fontSize: theme.button.fontSize.md,
    fontWeight: '600' as const,
    color: colors.white,
    backgroundColor: colors.success.main,
    border: 'none',
    borderRadius: theme.button.borderRadius,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    minHeight: theme.mobile.minTapTarget,
    minWidth: '80px',
  },
  secondary: {
    padding: theme.button.padding.md,
    fontSize: theme.button.fontSize.md,
    fontWeight: '500' as const,
    color: colors.text.primary,
    backgroundColor: colors.secondary.light,
    border: `1px solid ${colors.secondary.border}`,
    borderRadius: theme.button.borderRadius,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    minHeight: theme.mobile.minTapTarget,
    minWidth: '80px',
  },
  danger: {
    padding: theme.button.padding.md,
    fontSize: theme.button.fontSize.md,
    fontWeight: '600' as const,
    color: colors.white,
    backgroundColor: colors.danger.main,
    border: 'none',
    borderRadius: theme.button.borderRadius,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    minHeight: theme.mobile.minTapTarget,
    minWidth: '80px',
  },
};

export default ModalBase;
