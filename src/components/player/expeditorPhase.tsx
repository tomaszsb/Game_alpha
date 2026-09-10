import React from 'react';
import { PHASE_COLORS } from '../../utils/boardCommon';
import { useGameContext } from '../../context/GameContext';

/**
 * Expeditor phase chip (fb:f8dc7c38, extended to the replace/return/give picker
 * for fb:76fa69c7). A player with many filing reps couldn't tell which phase
 * each serves; this maps an E card's `phase_restriction` to a colored label so
 * duplicates are easy to spot when deciding which to let go. Colors reuse the
 * board's PHASE_COLORS so the chip matches the tile/phase-bar palette.
 *
 * Which phases exist comes from GAME_CONFIG (dataService.getPhaseOrder()).
 * v3.2.56 (Workstream 6 audit II, A3): this file used to carry its own
 * four-phase table with its own sort order — the order was no longer read by
 * anything, and a reskin's phases could never appear here.
 *
 * Originally extracted from the classic panel's CardsSection (since deleted);
 * now used by CardReplacementModal's replace/return/give picker.
 */
const NEUTRAL_PHASE = { border: '#9e9e9e', text: '#616161' };

// 'REGULATORY' → 'Regulatory'
const titleCase = (phase: string): string => phase.charAt(0) + phase.slice(1).toLowerCase();

export function expeditorPhaseInfo(phaseRestriction: string | undefined, phaseOrder: string[]): { label: string; border: string; text: string } {
  const raw = (phaseRestriction || 'Any').toUpperCase();
  if (!phaseOrder.includes(raw)) return { label: 'Any phase', ...NEUTRAL_PHASE };
  const c = PHASE_COLORS[raw] || NEUTRAL_PHASE;
  return { label: titleCase(raw), border: c.border, text: c.text };
}

export function PhaseChip({ phaseRestriction }: { phaseRestriction?: string }): JSX.Element {
  const { dataService } = useGameContext();
  const p = expeditorPhaseInfo(phaseRestriction, dataService.getPhaseOrder());
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
