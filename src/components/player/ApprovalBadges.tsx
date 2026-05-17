// src/components/player/ApprovalBadges.tsx
//
// Workstream 7 Phase 7.2 — Player panel badges showing DOB and FDNY approval
// status. Reads `dobApprovalStatus` and `fdnyApprovalStatus` from the player.
// Renders nothing if both statuses are 'none' (unvisited) to avoid clutter at
// game start; once a player has interacted with either examiner, both badges
// appear together so the player can see the full regulatory picture.

import React from 'react';
import { ApprovalStatus } from '../../types/DataTypes';

interface ApprovalBadgesProps {
  dobStatus?: ApprovalStatus;
  fdnyStatus?: ApprovalStatus;
}

interface BadgeStyle {
  background: string;
  color: string;
  icon: string;
  tooltipSuffix: string;
}

const STATUS_STYLES: Record<ApprovalStatus, BadgeStyle> = {
  'none': {
    background: '#e0e0e0',
    color: '#666',
    icon: '…',
    tooltipSuffix: 'Not visited yet',
  },
  'minor-objection': {
    background: '#fff3cd',
    color: '#856404',
    icon: '!',
    tooltipSuffix: 'Minor objection — re-submit',
  },
  'approved': {
    background: '#d4edda',
    color: '#155724',
    icon: '✓',
    tooltipSuffix: 'Approved',
  },
  'denied': {
    background: '#f8d7da',
    color: '#721c24',
    icon: '✗',
    tooltipSuffix: 'Denied — fix issues and re-apply',
  },
};

interface SingleBadgeProps {
  label: string;
  emoji: string;
  status: ApprovalStatus;
}

function ApprovalBadge({ label, emoji, status }: SingleBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`action-center__approval-badge action-center__approval-badge--${status}`}
      title={`${label}: ${style.tooltipSuffix}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '0.65rem',
        fontWeight: 'bold',
        background: style.background,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{label}</span>
      <span aria-hidden="true">·</span>
      <span aria-label={style.tooltipSuffix}>{style.icon}</span>
    </span>
  );
}

export function ApprovalBadges({ dobStatus = 'none', fdnyStatus = 'none' }: ApprovalBadgesProps) {
  // Hide entirely until the player has interacted with at least one examiner.
  // Reduces noise during early game when both badges would just show "…".
  if (dobStatus === 'none' && fdnyStatus === 'none') {
    return null;
  }

  return (
    <div
      className="action-center__approval-badges"
      style={{
        display: 'inline-flex',
        gap: '4px',
        alignItems: 'center',
        marginLeft: '6px',
      }}
    >
      <ApprovalBadge label="DOB" emoji="🪪" status={dobStatus} />
      <ApprovalBadge label="FDNY" emoji="🚒" status={fdnyStatus} />
    </div>
  );
}
