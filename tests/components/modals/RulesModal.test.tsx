import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RulesModal } from '../../../src/components/modals/RulesModal';
import { configureUIStrings, _testOnly } from '../../../src/constants/uiStrings';

describe('RulesModal', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    // configureUIStrings mutates module-level state shared across every
    // test in this file — clear any override a test set so it doesn't leak
    // into the next one.
    _testOnly.resetUIStringOverrides();
  });

  it('should not render when isOpen is false', () => {
    render(<RulesModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Your job')).not.toBeInTheDocument();
  });

  it('renders every section heading and the Key Spaces labels with today\'s default text', () => {
    render(<RulesModal isOpen={true} onClose={vi.fn()} />);

    // Headings mix an emoji + heading text as one element's combined
    // textContent (e.g. "🎯 Your job"), so these need a substring
    // match, not an exact-string match.
    expect(screen.getByText(/Your job/)).toBeInTheDocument();
    expect(screen.getByText(/Each turn/)).toBeInTheDocument();
    expect(screen.getByText(/What you are juggling/)).toBeInTheDocument();
    expect(screen.getByText(/The road/)).toBeInTheDocument();
    expect(screen.getByText(/Negotiate for better terms/)).toBeInTheDocument();
    expect(screen.getByText(/Winning and losing/)).toBeInTheDocument();

    // 2026-08-14: the literal space-id labels — these are exactly what a
    // reskin needs to be able to override (see the CSV-override test below).
    expect(screen.getByText('Owner:')).toBeInTheDocument();
    expect(screen.getByText('Architect and engineer:')).toBeInTheDocument();
    expect(screen.getByText('The city (DOB and FDNY):')).toBeInTheDocument();
    expect(screen.getByText('Builder:')).toBeInTheDocument();
    expect(screen.getByText('Finish:')).toBeInTheDocument();

    expect(screen.getByText('Got it!')).toBeInTheDocument();
  });

  it('calls onClose when the footer button is clicked', () => {
    const onClose = vi.fn();
    render(<RulesModal isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Got it!'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 2026-08-14: reskin follow-up (TODO.md, Workstream 6 audit) — this used
  // to be a literal string in the JSX. Proves a reskin CSV can now rename
  // the space referenced in the "Key Spaces" section without a code edit,
  // closing the documentation-drift half of the finding (not just wording).
  it('a reskin CSV can rename the Key Spaces labels, including the literal space ids', () => {
    configureUIStrings([
      { key: 'RULES.keySpaces.item1.label', template: 'CASTLE-QUEST-START:' },
      { key: 'RULES.keySpaces.item1.body', template: 'Accept your quest from the King' },
    ]);

    render(<RulesModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('CASTLE-QUEST-START:')).toBeInTheDocument();
    expect(screen.getByText('Accept your quest from the King')).toBeInTheDocument();
    expect(screen.queryByText('Owner:')).not.toBeInTheDocument();
    // Untouched keys stay at their default.
    expect(screen.getByText('Architect and engineer:')).toBeInTheDocument();
  });

  it('a reskin CSV can override the modal title and footer button', () => {
    configureUIStrings([
      { key: 'RULES.title', template: 'How to Play' },
      { key: 'RULES.footer.gotIt', template: 'Understood' },
    ]);

    render(<RulesModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('How to Play')).toBeInTheDocument();
    expect(screen.getByText('Understood')).toBeInTheDocument();
  });
});
