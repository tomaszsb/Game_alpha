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
    render(<CharacterBadge spaceName="ARCH-INITIATION" />);
    expect(screen.getByText('The Architect')).toBeInTheDocument();
    expect(screen.getByText('— Design')).toBeInTheDocument();
  });

  it('should render Engineer badge for ENG- spaces', () => {
    render(<CharacterBadge spaceName="ENG-INITIATION" />);
    expect(screen.getByText('The Engineer')).toBeInTheDocument();
    expect(screen.getByText('— Engineering')).toBeInTheDocument();
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
