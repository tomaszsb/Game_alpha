// src/components/help/HelpCard.tsx
//
// The one card a "?" opens (Onboarding Phase C, "one ? everywhere", v3.2.71).
// Same box, same type, same light/dark behaviour everywhere help appears; only
// the words inside change. See HelpButton.tsx for why this is shared.
//
// It is given SECTIONS instead of a single string because the two things that
// open it have different shapes: an action explains itself in a main line plus a
// smaller grey line, and a space explains "What to do:" and "Why:".

import React from 'react';
import { TextWithTerms } from '../../dictionary';
import type { HelpPalette } from './HelpButton';

export interface HelpSection {
  /** Bold lead-in, e.g. "What to do:". */
  label?: string;
  text: string;
  /** The smaller grey line under the main text. */
  muted?: boolean;
}

export interface HelpCardProps {
  /** Matches the opening button's `cardId`, for aria-controls. */
  id: string;
  kind: string;
  sections: HelpSection[];
  palette: HelpPalette;
  /**
   * When given, glossary words inside the text become tappable links. Omit it
   * for surfaces outside the dictionary provider (the editor's live preview),
   * which then render plain text.
   */
  onTermClick?: React.ComponentProps<typeof TextWithTerms>['onTermClick'];
}

export function HelpCard({ id, kind, sections, palette: p, onTermClick }: HelpCardProps): JSX.Element | null {
  const shown = sections.filter((s) => s.text && s.text.trim() !== '');
  if (shown.length === 0) return null;

  const words = (text: string): React.ReactNode =>
    onTermClick ? <TextWithTerms text={text} onTermClick={onTermClick} /> : text;

  return (
    <div
      id={id}
      data-testid="help-card"
      data-help-kind={kind}
      style={{
        margin: '4px 0 2px',
        padding: '9px 11px',
        background: p.surf2,
        border: `1px solid ${p.border}`,
        borderRadius: 9,
        fontSize: 12.5,
        lineHeight: 1.45,
        color: p.text,
        // A merged dice button joins two authored explanations with a blank line
        // (v3.2.69); without this the browser folds it to a space and the two
        // read as one run-on. Inherited by every section, including the grey one.
        whiteSpace: 'pre-line',
      }}
    >
      {shown.map((section, i) => (
        <div
          key={i}
          style={
            section.muted
              ? { marginTop: 6, fontSize: 11.5, color: p.muted }
              : i > 0
              ? { marginTop: 6 }
              : undefined
          }
        >
          {section.label && <strong>{section.label} </strong>}
          {words(section.text)}
        </div>
      ))}
    </div>
  );
}
