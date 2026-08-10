// src/components/modals/shared/ModalBase.tsx
// Shared modal wrapper component with consistent styling and mobile-friendly design
// Uses framer-motion for entry, exit, and shake animations

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, colors } from '../../../styles/theme';
import { panelPalettes, PanelMode } from '../../player/panelTheme';
import type { SpeechControls } from '../../../hooks/useModalSpeech';

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
  /** If provided, renders speech control buttons in the header */
  speechControls?: SpeechControls;
  /** Fires when the exit animation has fully finished (AnimatePresence
   *  onExitComplete). Lets callers sequence a reopen deterministically
   *  instead of re-toggling mid-exit (fb:ac29b623). */
  onExitComplete?: () => void;
  /** Light/dark shell following the new panel's mode (redesign §4 — both modes
   *  first-class). Defaults to 'light', which renders exactly the pre-existing
   *  shell, so classic callers are unaffected. An explicit `headerColor` (e.g.
   *  the card-type tint) keeps its light header + dark title in both modes. */
  mode?: PanelMode;
}

// Check reduced motion preference once at module level
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Click-through protection window (fb:ac29b623). When a result modal opens
// UNDER a click the player already committed (rapid clicking through
// actions), that in-flight click lands on the backdrop and instantly
// dismisses the modal — it flashes and the player never reads the outcome.
// Verified with a live repro 2026-06-12: trailing click ~110ms after open
// backdrop-closed the modal. Backdrop clicks within this window of opening
// are ignored; deliberate dismissals (read first, then click away) take far
// longer. The ✕ button, Escape, and footer buttons are unaffected.
export const BACKDROP_GRACE_MS = 500;

// Focus trap (Fire TV D-pad report-form bug: the remote sends Arrow keys,
// never Tab, and ModalBase had no focus management at all — focus could
// wander onto the page behind the modal with no way back).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Arrow keys have native meaning inside text-editable controls (move the
// caret, change a <select>'s value) — only treat them as focus-trap
// navigation outside those, so typing in a report-form text field isn't
// hijacked. Tab always navigates focus regardless of this check.
function isTextEditable(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName === 'INPUT') {
    const nonTextTypes = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];
    return !nonTextTypes.includes((el as HTMLInputElement).type);
  }
  return el.isContentEditable;
}

// Animation variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

const shakeTransition = prefersReducedMotion
  ? {}
  : {
      x: {
        type: 'keyframes' as const,
        values: [0, -8, 8, -8, 8, -6, 6, -4, 4, 0],
        duration: 0.4,
        delay: 0.15,
      },
    };

/**
 * ModalBase - Standardized modal wrapper for consistent UI across the app.
 *
 * Features:
 * - Smooth entry and exit animations via framer-motion
 * - Shake animation for negative effects with prefers-reduced-motion support
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
  speechControls,
  onExitComplete,
  mode = 'light',
}: ModalBaseProps): JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  // When this open started — drives the backdrop click-through grace window.
  const openedAtRef = useRef<number>(0);
  // Element that had focus before the modal opened — restored on close.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) openedAtRef.current = Date.now();
  }, [isOpen]);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initial focus + restore-on-close + body scroll lock. Split from the
  // keydown-handling effect below so a parent re-rendering with a new
  // onClose identity (common — inline arrow functions) can't re-steal focus
  // out of the modal mid-interaction.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const container = modalRef.current;
    if (container) {
      const explicitTarget = container.querySelector<HTMLElement>('[data-modal-initial-focus]');
      const [firstFocusable] = getFocusableElements(container);
      (explicitTarget ?? firstFocusable ?? container).focus();
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
  }, [isOpen]);

  // Escape-to-close plus the Tab/Arrow-key focus trap. Focusable elements
  // are re-queried on every key press (not cached) so newly-revealed
  // controls — e.g. a field that appears after another is filled in — are
  // immediately reachable.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      const container = modalRef.current;
      if (!container) return;

      const isTab = e.key === 'Tab';
      const isForward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
      const isBackward = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
      if (!isTab && !isForward && !isBackward) return;

      const active = document.activeElement as HTMLElement | null;
      if ((isForward || isBackward) && isTextEditable(active)) return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const goingBackward = isTab ? e.shiftKey : isBackward;
      const currentIndex = active ? focusable.indexOf(active) : -1;

      let nextIndex: number;
      if (currentIndex === -1) {
        nextIndex = goingBackward ? focusable.length - 1 : 0;
      } else if (goingBackward) {
        nextIndex = currentIndex === 0 ? focusable.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
      }

      e.preventDefault();
      focusable[nextIndex].focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      // Ignore clicks that were already in flight when the modal appeared —
      // see BACKDROP_GRACE_MS above (fb:ac29b623).
      if (Date.now() - openedAtRef.current < BACKDROP_GRACE_MS) return;
      onClose();
    }
  }, [onClose]);

  // Shell surfaces per mode. `headerIsLight` drives the header's TEXT colors:
  // an explicit headerColor is always a light tint (card-type headers), so its
  // title/buttons stay dark even when the body goes dark.
  const dark = mode === 'dark';
  const dp = panelPalettes.dark;
  const headerIsLight = !!headerColor || !dark;
  const shellHoverBg = headerIsLight ? colors.secondary.light : dp.surf2;

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

  const containerStyle: React.CSSProperties = {
    backgroundColor: dark ? dp.bg : theme.modal.container.background,
    borderRadius: isMobile ? theme.mobile.modal.borderRadius : theme.modal.container.borderRadius,
    boxShadow: theme.modal.container.boxShadow,
    maxWidth: isMobile ? `calc(100% - ${theme.mobile.modal.margin} * 2)` : maxWidth,
    width: '100%',
    maxHeight: theme.modal.container.maxHeight,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    padding: isMobile ? '12px 16px' : theme.modal.header.padding,
    backgroundColor: headerColor || (dark ? dp.surf : theme.modal.header.backgroundColor),
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
    color: headerIsLight ? colors.text.primary : dp.text,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const closeButtonColor = headerIsLight ? theme.modal.closeButton.color : dp.muted;
  const closeButtonHoverColor = headerIsLight ? theme.modal.closeButton.hoverColor : dp.text;

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: theme.modal.closeButton.fontSize,
    color: closeButtonColor,
    cursor: 'pointer',
    padding: '8px',
    borderRadius: theme.borderRadius.sm,
    lineHeight: 1,
    minWidth: theme.mobile.minTapTarget,
    minHeight: theme.mobile.minTapTarget,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.fast,
    flexShrink: 0,
  };

  const speechButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: theme.borderRadius.sm,
    lineHeight: 1,
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: theme.transitions.fast,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: isMobile ? '16px' : theme.modal.body.padding,
    WebkitOverflowScrolling: 'touch',
  };

  const footerStyle: React.CSSProperties = {
    padding: isMobile ? '12px 16px' : theme.modal.footer.padding,
    borderTop: `1px solid ${dark ? dp.border : colors.secondary.light}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.modal.footer.gap,
    flexWrap: 'wrap',
  };

  // Transition config (fast for reduced motion)
  const transitionConfig = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

  // Resolve animate/transition once so we don't spread duplicate keys
  const applyShake = shake && !prefersReducedMotion;
  const modalAnimate = applyShake ? { ...modalVariants.visible, x: 0 } : 'visible';
  const modalTransition = applyShake ? { ...transitionConfig, ...shakeTransition } : transitionConfig;

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            style={overlayStyle}
            onClick={handleBackdropClick}
            data-testid={testId ? `${testId}-overlay` : 'modal-overlay'}
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={transitionConfig}
          >
            {/* Modal container */}
            <motion.div
              ref={modalRef}
              style={containerStyle}
              onClick={(e) => e.stopPropagation()}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              data-testid={testId}
              variants={modalVariants}
              initial="hidden"
              animate={modalAnimate}
              exit="exit"
              transition={modalTransition}
            >
              {/* Header */}
              <div style={headerStyle}>
                <h2 id="modal-title" style={titleStyle}>
                  {emoji && <span>{emoji}</span>}
                  {title}
                </h2>
                {speechControls && (
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button
                      onClick={speechControls.isSpeaking ? speechControls.stop : speechControls.replay}
                      style={speechButtonStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = shellHoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      aria-label={speechControls.isSpeaking ? 'Stop speech' : 'Replay speech'}
                      title={speechControls.isSpeaking ? 'Stop' : 'Replay'}
                    >
                      {speechControls.isSpeaking ? '⏹' : '🔄'}
                    </button>
                    <button
                      onClick={speechControls.toggleMute}
                      style={speechButtonStyle}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = shellHoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      aria-label={speechControls.muted ? 'Unmute speech' : 'Mute speech'}
                      title={speechControls.muted ? 'Unmute' : 'Mute'}
                    >
                      {speechControls.muted ? '🔇' : '🔊'}
                    </button>
                  </div>
                )}
                <button
                  onClick={onClose}
                  style={closeButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = shellHoverBg;
                    e.currentTarget.style.color = closeButtonHoverColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = closeButtonColor;
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
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
