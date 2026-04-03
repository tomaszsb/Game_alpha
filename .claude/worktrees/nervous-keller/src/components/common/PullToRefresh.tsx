import React, { useState, useRef, useCallback } from 'react';
import { haptics } from '../../utils/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 70;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps): JSX.Element {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [didTriggerHaptic, setDidTriggerHaptic] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
    setDidTriggerHaptic(false);
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }

    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY < 0) {
      setPullDistance(0);
      return;
    }

    // Dampen the pull (feels more natural)
    const dampened = Math.min(deltaY * 0.5, 120);
    setPullDistance(dampened);

    if (dampened >= PULL_THRESHOLD && !didTriggerHaptic) {
      haptics.mediumTap();
      setDidTriggerHaptic(true);
    }
  }, [isRefreshing, didTriggerHaptic]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'auto' }}
    >
      {/* Pull indicator */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: `${pullDistance}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: isPulling.current ? 'none' : 'height 0.25s ease-out',
        zIndex: 10,
        pointerEvents: 'none'
      }}>
        {showIndicator && (
          <span style={{
            fontSize: '14px',
            color: '#495057',
            fontWeight: 'bold',
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            transform: isRefreshing ? 'rotate(360deg)' : `rotate(${(pullDistance / PULL_THRESHOLD) * 360}deg)`,
            transition: isRefreshing ? 'transform 0.8s linear' : 'none',
            animation: isRefreshing ? 'ptr-spin 0.8s linear infinite' : 'none'
          }}>
            {isRefreshing ? '⟳ Refreshing...' : pullDistance >= PULL_THRESHOLD ? '↻ Release to refresh' : '↓ Pull to refresh'}
          </span>
        )}
      </div>

      {/* Content shifted down by pull distance */}
      <div style={{
        transform: `translateY(${pullDistance}px)`,
        transition: isPulling.current ? 'none' : 'transform 0.25s ease-out'
      }}>
        {children}
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
