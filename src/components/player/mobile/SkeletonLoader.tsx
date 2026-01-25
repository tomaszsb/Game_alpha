// src/components/player/mobile/SkeletonLoader.tsx
//
// Skeleton loading components for mobile player panel.
// Shows shimmer effect while content is loading.
// Created: January 25, 2026

import React from 'react';
import { motion } from 'framer-motion';
import './SkeletonLoader.css';

export interface SkeletonProps {
  /** Width of the skeleton element (CSS value) */
  width?: string;
  /** Height of the skeleton element (CSS value) */
  height?: string;
  /** Border radius (CSS value) */
  borderRadius?: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Base skeleton element with shimmer animation.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = '4px',
  className = ''
}) => (
  <motion.div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius }}
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    data-testid="skeleton"
  />
);

/**
 * Skeleton for the stats bar (4 stat items).
 */
export const StatsSkeleton: React.FC = () => (
  <div className="stats-skeleton" data-testid="stats-skeleton">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="stats-skeleton__item">
        <Skeleton width="28px" height="28px" borderRadius="50%" />
        <Skeleton width="40px" height="12px" />
        <Skeleton width="32px" height="8px" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton for story content.
 */
export const StorySkeleton: React.FC = () => (
  <div className="story-skeleton" data-testid="story-skeleton">
    <Skeleton width="90%" height="16px" />
    <Skeleton width="100%" height="16px" />
    <Skeleton width="85%" height="16px" />
    <Skeleton width="95%" height="16px" />
    <Skeleton width="60%" height="16px" />
  </div>
);

/**
 * Skeleton for space header.
 */
export const HeaderSkeleton: React.FC = () => (
  <div className="header-skeleton" data-testid="header-skeleton">
    <Skeleton width="32px" height="32px" borderRadius="50%" />
    <div className="header-skeleton__text">
      <Skeleton width="120px" height="14px" />
      <Skeleton width="80px" height="10px" />
    </div>
  </div>
);

/**
 * Skeleton for the primary action button.
 */
export const ActionSkeleton: React.FC = () => (
  <div className="action-skeleton" data-testid="action-skeleton">
    <Skeleton width="100%" height="48px" borderRadius="8px" />
  </div>
);

/**
 * Complete mobile panel skeleton.
 */
export const MobilePanelSkeleton: React.FC = () => (
  <div className="mobile-panel-skeleton" data-testid="mobile-panel-skeleton">
    <HeaderSkeleton />
    <StorySkeleton />
    <StatsSkeleton />
    <ActionSkeleton />
  </div>
);

/**
 * Skeleton for detail sheet content.
 */
export const DetailContentSkeleton: React.FC = () => (
  <div className="detail-content-skeleton" data-testid="detail-content-skeleton">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="detail-content-skeleton__row">
        <Skeleton width="80px" height="14px" />
        <Skeleton width="60px" height="14px" />
      </div>
    ))}
  </div>
);
