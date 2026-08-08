import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { CardTypeBadge } from '../../../src/components/common/CardTypeBadge';
import { configureCardTypeLabels } from '../../../src/utils/cardTypeNames';

// 2026-08-03 audit: CardTypeBadge's label came from theme.ts's hardcoded
// cardTypeConfig.label, bypassing the CSV-driven pipeline (getCardTypeName /
// CARD_TYPES.csv) that other components already use. Latent because the
// badge's only caller today (DiscardPileModal) renders with
// showLabel={false}, so the unsafe default never actually reached the
// screen — but any future caller that shows the label would've silently
// disagreed with a reskin CSV.
describe('CardTypeBadge', () => {
  afterEach(() => cleanup());

  it('renders the theme fallback label when no CSV override is configured', () => {
    render(<CardTypeBadge type="I" />);
    expect(screen.getByText('Investment')).toBeInTheDocument();
  });

  it('prefers a CSV-driven label override over the theme.ts default (reskin pipeline)', () => {
    configureCardTypeLabels([{ card_type: 'I', label: 'Backer Capital' } as any]);
    render(<CardTypeBadge type="I" />);
    expect(screen.getByText('Backer Capital')).toBeInTheDocument();
    expect(screen.queryByText('Investment')).not.toBeInTheDocument();
  });

  it('falls back to the raw type code for an unrecognized type', () => {
    render(<CardTypeBadge type="Z" />);
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('renders no label text when showLabel is false (the DiscardPileModal usage)', () => {
    render(<CardTypeBadge type="I" showLabel={false} />);
    expect(screen.queryByText('Investment')).not.toBeInTheDocument();
  });
});
