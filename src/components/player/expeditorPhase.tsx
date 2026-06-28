import React from 'react';
import { PHASE_COLORS } from '../../utils/boardCommon';

/**
 * Expeditor phase chip (fb:f8dc7c38, extended to the replace/return/give picker
 * for fb:76fa69c7). A player with many filing reps couldn't tell which phase
 * each serves; this maps an E card's `phase_restriction` to a colored label + a
 * sort order so same-phase expeditors cluster and duplicates are easy to spot
 * when deciding which to let go. Colors reuse the board's PHASE_COLORS so the
 * chip matches the tile/phase-bar palette (note E cards spell it
 * REGULATORY_REVIEW where the palette key is REGULATORY).
 *
 * Extracted from CardsSection so the hand list and the replacement picker share
 * one chip (no parallel copy to drift).
 */
const NEUTRAL_PHASE = { border: '#9e9e9e', text: '#616161' };
const EXPEDITOR_PHASES: Record<string, { label: string; colorKey: string; order: number }> = {
  FUNDING: { label: 'Funding', colorKey: 'FUNDING', order: 1 },
  DESIGN: { label: 'Design', colorKey: 'DESIGN', order: 2 },
  REGULATORY_REVIEW: { label: 'Regulatory', colorKey: 'REGULATORY', order: 3 },
  CONSTRUCTION: { label: 'Construction', colorKey: 'CONSTRUCTION', order: 4 },
};

export function expeditorPhaseInfo(phaseRestriction?: string): { label: string; border: string; text: string; order: number } {
  const raw = (phaseRestriction || 'Any').toUpperCase();
  const known = EXPEDITOR_PHASES[raw];
  if (!known) return { label: 'Any phase', ...NEUTRAL_PHASE, order: 5 };
  const c = PHASE_COLORS[known.colorKey] || NEUTRAL_PHASE;
  return { label: known.label, border: c.border, text: c.text, order: known.order };
}

export function PhaseChip({ phaseRestriction }: { phaseRestriction?: string }): JSX.Element {
  const p = expeditorPhaseInfo(phaseRestriction);
  return (
    <span
      title={`Works during the ${p.label} phase`}
      style={{
        marginLeft: '6px', padding: '1px 7px', borderRadius: '9px',
        fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap',
        color: p.text, border: `1px solid ${p.border}`, backgroundColor: `${p.border}1a`,
      }}
    >
      {p.label}
    </span>
  );
}
