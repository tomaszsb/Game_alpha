/**
 * ApprovalBadges.test.tsx
 *
 * Test suite for the Workstream 7 Phase 7.2 player panel badges.
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { ApprovalBadges } from '../../../src/components/player/ApprovalBadges';

describe('ApprovalBadges', () => {
  afterEach(() => cleanup());

  it('renders nothing when both statuses are none (early-game noise reduction)', () => {
    const { container } = render(<ApprovalBadges />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when both statuses are explicitly "none"', () => {
    const { container } = render(<ApprovalBadges dobStatus="none" fdnyStatus="none" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders both badges once either status leaves "none"', () => {
    render(<ApprovalBadges dobStatus="approved" fdnyStatus="none" />);
    expect(screen.getByText('DOB')).toBeInTheDocument();
    expect(screen.getByText('FDNY')).toBeInTheDocument();
  });

  it('shows the approved icon (✓) for approved status', () => {
    render(<ApprovalBadges dobStatus="approved" />);
    const dobBadge = screen.getByText('DOB').closest('.action-center__approval-badge');
    expect(dobBadge).toHaveTextContent('✓');
    expect(dobBadge).toHaveAttribute('title', expect.stringContaining('Approved'));
  });

  it('shows the denied icon (✗) for denied status', () => {
    render(<ApprovalBadges dobStatus="denied" />);
    const dobBadge = screen.getByText('DOB').closest('.action-center__approval-badge');
    expect(dobBadge).toHaveTextContent('✗');
    expect(dobBadge).toHaveAttribute('title', expect.stringContaining('Denied'));
  });

  it('shows the objection icon (!) for minor-objection status', () => {
    render(<ApprovalBadges fdnyStatus="minor-objection" />);
    const fdnyBadge = screen.getByText('FDNY').closest('.action-center__approval-badge');
    expect(fdnyBadge).toHaveTextContent('!');
    expect(fdnyBadge).toHaveAttribute('title', expect.stringContaining('Minor objection'));
  });

  it('shows the unvisited indicator (…) for "none" when the OTHER badge is non-none', () => {
    render(<ApprovalBadges dobStatus="approved" fdnyStatus="none" />);
    const fdnyBadge = screen.getByText('FDNY').closest('.action-center__approval-badge');
    expect(fdnyBadge).toHaveTextContent('…');
    expect(fdnyBadge).toHaveAttribute('title', expect.stringContaining('Not visited yet'));
  });

  it('applies the per-status modifier class for styling', () => {
    render(<ApprovalBadges dobStatus="approved" fdnyStatus="denied" />);
    const dobBadge = screen.getByText('DOB').closest('.action-center__approval-badge');
    const fdnyBadge = screen.getByText('FDNY').closest('.action-center__approval-badge');
    expect(dobBadge).toHaveClass('action-center__approval-badge--approved');
    expect(fdnyBadge).toHaveClass('action-center__approval-badge--denied');
  });

  it('includes the DOB emoji 🪪 and FDNY emoji 🚒', () => {
    render(<ApprovalBadges dobStatus="approved" fdnyStatus="approved" />);
    const dobBadge = screen.getByText('DOB').closest('.action-center__approval-badge');
    const fdnyBadge = screen.getByText('FDNY').closest('.action-center__approval-badge');
    expect(dobBadge).toHaveTextContent('🪪');
    expect(fdnyBadge).toHaveTextContent('🚒');
  });
});
