// src/components/modals/ResponsiveSheet.tsx

import React, { useEffect } from 'react';
import { colors } from '../../styles/theme';

interface ResponsiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * ResponsiveSheet - Adaptive modal component
 * Desktop (>768px): Centered modal overlay
 * Mobile (<=768px): Bottom sheet that slides up
 */
export function ResponsiveSheet({ isOpen, onClose, title, children }: ResponsiveSheetProps): JSX.Element | null {

  // Add CSS animations to document head
  useEffect(() => {
    const styleId = 'responsive-sheet-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Backdrop (dimmed background)
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    animation: 'fadeIn 0.3s ease-out',
    cursor: 'pointer'
  };

  // Container style - responsive
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1001,
    backgroundColor: colors.white,
    borderRadius: '16px 16px 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.3s ease-out',
    // Mobile-first: bottom sheet
    bottom: 0,
    left: 0,
    right: 0
  };

  // Desktop override via inline media query simulation
  const isDesktop = window.innerWidth > 768;
  if (isDesktop) {
    Object.assign(containerStyle, {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      transform: 'translate(-50%, -50%)',
      borderRadius: '16px',
      maxWidth: '800px',
      width: '90vw',
      maxHeight: '90vh'
    });
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px',
    borderBottom: `2px solid ${colors.secondary.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: colors.text.primary,
    margin: 0
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '4px 8px',
    color: colors.secondary.main,
    transition: 'color 0.2s ease',
    lineHeight: 1
  };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    overflowY: 'auto',
    flex: 1
  };

  // Handle for mobile (visual indicator to swipe down)
  const handleStyle: React.CSSProperties = {
    width: '40px',
    height: '4px',
    backgroundColor: colors.secondary.border,
    borderRadius: '2px',
    margin: '8px auto',
    display: isDesktop ? 'none' : 'block'
  };

  return (
    <>
      {/* Backdrop */}
      <div style={backdropStyle} onClick={onClose} />

      {/* Sheet/Modal Container */}
      <div style={containerStyle}>
        {/* Mobile handle */}
        <div style={handleStyle} />

        {/* Header */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = colors.danger.main;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = colors.secondary.main;
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={contentStyle}>
          {children}
        </div>
      </div>
    </>
  );
}
