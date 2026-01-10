// src/components/common/Tooltip.tsx

import React, { useState, useRef, useEffect } from 'react';
import { colors } from '../../styles/theme';

interface TooltipProps {
  /** The content to show in the tooltip */
  content: string;
  /** Optional secondary context text */
  context?: string;
  /** The element to wrap with tooltip */
  children: React.ReactNode;
  /** Position of tooltip relative to children */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip in ms */
  delay?: number;
  /** Max width of tooltip */
  maxWidth?: number;
  /** Whether tooltip is disabled */
  disabled?: boolean;
}

/**
 * Tooltip component that shows explanatory text on hover
 * Used to explain "why" an action button needs to be pressed
 */
export function Tooltip({
  content,
  context,
  children,
  position = 'top',
  delay = 300,
  maxWidth = 280,
  disabled = false
}: TooltipProps): JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    if (disabled || !content) return;

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!wrapperRef.current) return;

    // getBoundingClientRect() returns viewport-relative coordinates
    // Since we use position: fixed, we should use these directly (no scroll offset needed)
    const rect = wrapperRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - 8;
        left = rect.left + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + 8;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - 8;
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + 8;
        break;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Position styles based on position prop
  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: 10000,
      pointerEvents: 'none'
    };

    switch (position) {
      case 'top':
        return {
          ...base,
          bottom: `calc(100vh - ${coords.top}px)`,
          left: coords.left,
          transform: 'translateX(-50%)'
        };
      case 'bottom':
        return {
          ...base,
          top: coords.top,
          left: coords.left,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          ...base,
          top: coords.top,
          right: `calc(100vw - ${coords.left}px)`,
          transform: 'translateY(-50%)'
        };
      case 'right':
        return {
          ...base,
          top: coords.top,
          left: coords.left,
          transform: 'translateY(-50%)'
        };
      default:
        return base;
    }
  };

  // Arrow styles
  const getArrowStyles = (): React.CSSProperties => {
    const arrowSize = 6;
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid'
    };

    switch (position) {
      case 'top':
        return {
          ...base,
          bottom: -arrowSize,
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
          borderColor: `${colors.text.primary} transparent transparent transparent`
        };
      case 'bottom':
        return {
          ...base,
          top: -arrowSize,
          left: '50%',
          transform: 'translateX(-50%)',
          borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent ${colors.text.primary} transparent`
        };
      case 'left':
        return {
          ...base,
          right: -arrowSize,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderColor: `transparent transparent transparent ${colors.text.primary}`
        };
      case 'right':
        return {
          ...base,
          left: -arrowSize,
          top: '50%',
          transform: 'translateY(-50%)',
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderColor: `transparent ${colors.text.primary} transparent transparent`
        };
      default:
        return base;
    }
  };

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      style={{ display: 'inline-block', width: '100%' }}
    >
      {children}

      {isVisible && content && (
        <div
          ref={tooltipRef}
          style={getPositionStyles()}
          role="tooltip"
        >
          <div
            style={{
              backgroundColor: colors.text.primary,
              color: colors.white,
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              lineHeight: '1.4',
              maxWidth: maxWidth,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              position: 'relative'
            }}
          >
            {/* Main tooltip text */}
            <div style={{ fontWeight: 500, marginBottom: context ? '6px' : 0 }}>
              {content}
            </div>

            {/* Optional context text */}
            {context && (
              <div style={{
                fontSize: '11px',
                opacity: 0.85,
                borderTop: `1px solid rgba(255, 255, 255, 0.2)`,
                paddingTop: '6px',
                marginTop: '4px'
              }}>
                {context}
              </div>
            )}

            {/* Arrow */}
            <div style={getArrowStyles()} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple title-based tooltip for basic use cases
 * Just wraps children with a title attribute
 */
export function SimpleTooltip({
  content,
  children
}: {
  content: string;
  children: React.ReactElement<{ title?: string }>;
}): JSX.Element {
  return React.cloneElement(children, { title: content });
}
