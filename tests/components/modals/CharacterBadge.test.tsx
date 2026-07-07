import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { CharacterBadge } from '../../../src/components/modals/shared/CharacterBadge';

describe('CharacterBadge', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render Owner badge for OWNER- spaces', () => {
    render(<CharacterBadge spaceName="OWNER-SCOPE-INITIATION" />);
    expect(screen.getByText('The Owner')).toBeInTheDocument();
    expect(screen.getByText('— Initiation')).toBeInTheDocument();
  });

  it('should render Architect badge for ARCH- spaces', () => {
    // ARCH-FEE-REVIEW, not ARCH-INITIATION — the latter is one of the 5
    // PM-voiced spaces (fb:7065e8df) where the narration is the PM's own
    // first-person thought, not the Architect's, so no badge should render.
    render(<CharacterBadge spaceName="ARCH-FEE-REVIEW" />);
    expect(screen.getByText('The Architect')).toBeInTheDocument();
    expect(screen.getByText('— Design')).toBeInTheDocument();
  });

  it('should render Engineer badge for ENG- spaces', () => {
    // ENG-FEE-REVIEW, not ENG-INITIATION — see ARCH- note above.
    render(<CharacterBadge spaceName="ENG-FEE-REVIEW" />);
    expect(screen.getByText('The Engineer')).toBeInTheDocument();
    expect(screen.getByText('— Engineering')).toBeInTheDocument();
  });

  it('should return null for PM-voiced spaces even though the prefix matches a known NPC (fb:7065e8df)', () => {
    // ARCH-INITIATION's narration is the PM's own first-person thought
    // ("I..."), not the Architect's — showing "The Architect" here read as
    // "the boxes are confused" (the character badge didn't match the voice
    // of the text next to it).
    const { container } = render(<CharacterBadge spaceName="ARCH-INITIATION" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render DOB Examiner badge for REG-DOB- spaces', () => {
    render(<CharacterBadge spaceName="REG-DOB-PLAN-EXAM" />);
    expect(screen.getByText('DOB Examiner')).toBeInTheDocument();
    expect(screen.getByText('— Regulatory')).toBeInTheDocument();
  });

  it('should render FDNY Inspector badge for REG-FDNY- spaces', () => {
    render(<CharacterBadge spaceName="REG-FDNY-INSPECTION" />);
    expect(screen.getByText('FDNY Inspector')).toBeInTheDocument();
    expect(screen.getByText('— Regulatory')).toBeInTheDocument();
  });

  it('should render Contractor badge for CON- spaces', () => {
    render(<CharacterBadge spaceName="CON-INITIATION" />);
    expect(screen.getByText('The Contractor')).toBeInTheDocument();
    expect(screen.getByText('— Construction')).toBeInTheDocument();
  });

  it('should return null for unknown space prefixes', () => {
    const { container } = render(<CharacterBadge spaceName="START-QUICK-PLAY-GUIDE" />);
    expect(container.firstChild).toBeNull();
  });

  it('should return null for empty space name', () => {
    const { container } = render(<CharacterBadge spaceName="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should show character emoji', () => {
    render(<CharacterBadge spaceName="OWNER-FUND-INITIATION" />);
    expect(screen.getByText('👔')).toBeInTheDocument();
  });
});
