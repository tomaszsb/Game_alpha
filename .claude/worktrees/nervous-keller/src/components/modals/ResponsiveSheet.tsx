// src/components/modals/ResponsiveSheet.tsx
// Updated: February 4, 2026 - Added swipe-to-dismiss with framer-motion

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { colors } from '../../styles/theme';
import { haptics } from '../../utils/haptics';

interface ResponsiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * ResponsiveSheet - Adaptive modal component with swipe gestures
 * Desktop (>768px): Centered modal overlay
 * Mobile (<=768px): Bottom sheet that slides up, swipe down to close
 */
export function ResponsiveSheet({ isOpen, onClose, title, children }: ResponsiveSheetProps): JSX.Element | null {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const controls = useAnimation();

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  // Handle swipe gesture end
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100; // Minimum distance to trigger close
    const velocity = 500; // Minimum velocity to trigger close

    if (info.offset.y > threshold || info.velocity.y > velocity) {
      // User swiped down enough - close the sheet
      haptics.lightTap();
      controls.start({ y: '100%', transition: { duration: 0.2 } }).then(onClose);
    } else {
      // Snap back to open position
      controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
    }
  };

  // Backdrop style
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    cursor: 'pointer'
  };

  // Base container style (mobile-first)
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1001,
    backgroundColor: colors.white,
    borderRadius: '16px 16px 0 0',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
    maxHeight: '100dvh',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    bottom: 0,
    left: 0,
    right: 0,
    touchAction: 'none' // Prevent browser gestures
  };

  // Desktop override
  if (isDesktop) {
    Object.assign(containerStyle, {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      borderRadius: '16px',
      maxWidth: '800px',
      width: '90vw',
      maxHeight: '90vh',
      height: 'auto',
      touchAction: 'auto'
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
    lineHeight: 1,
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const contentStyle: React.CSSProperties = {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
    touchAction: 'pan-y' // Allow vertical scrolling in content
  };

  // Handle bar style (mobile only)
  const handleStyle: React.CSSProperties = {
    width: '40px',
    height: '4px',
    backgroundColor: colors.secondary.border,
    borderRadius: '2px',
    margin: '8px auto',
    display: isDesktop ? 'none' : 'block'
  };

  // Drag handle area style (larger touch target)
  const dragHandleAreaStyle: React.CSSProperties = {
    padding: '4px 0',
    cursor: 'grab',
    touchAction: 'none'
  };

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const sheetVariants = isDesktop ? {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, x: '-50%', y: '-50%' }
  } : {
    hidden: { y: '100%' },
    visible: { y: 0 }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            style={backdropStyle}
            onClick={onClose}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: 0.2 }}
          />

          {/* Sheet/Modal Container */}
          <motion.div
            style={containerStyle}
            initial="hidden"
            animate={isDesktop ? "visible" : controls}
            exit="hidden"
            variants={sheetVariants}
            transition={{
              type: isDesktop ? 'tween' : 'spring',
              stiffness: 300,
              damping: 30,
              duration: isDesktop ? 0.2 : undefined
            }}
            drag={isDesktop ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={isDesktop ? undefined : handleDragEnd}
            onAnimationComplete={() => {
              if (isOpen && !isDesktop) {
                controls.set({ y: 0 });
              }
            }}
          >
            {/* Mobile drag handle */}
            {!isDesktop && (
              <div style={dragHandleAreaStyle}>
                <div style={handleStyle} />
              </div>
            )}

            {/* Header */}
            <div style={headerStyle}>
              <h2 style={titleStyle}>{title}</h2>
              <button
                style={closeButtonStyle}
                onClick={() => {
                  haptics.lightTap();
                  onClose();
                }}
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
