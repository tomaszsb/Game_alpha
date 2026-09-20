// src/components/help/HelpButton.tsx
//
// THE "?" — one help gesture for the whole game (Onboarding Phase C, "one ?
// everywhere", v3.2.71).
//
// Why this exists: "explain this to me" used to have five different looks — a
// boxed "?" beside actions, a plain-text "▸ What to do & why" link, underlined
// words that open a separate panel, a header "Rules" button in a different
// voice, and ~53 hover-only tooltips that do nothing on a phone. Of 37 real
// outside games only 8 opened ANY help at all, so a newcomer never learned the
// gesture. Tom (2026-09-19): "we built all the helpful wording in already… maybe
// we just have to unify the help ui / feel." This is the look every explanation
// now wears; the wording behind it is unchanged.
//
// This is the exact look the per-action "?" already had (v3.2.54), lifted out so
// the space's own help and the editor's live preview can wear it too.
//
// Structural, not stylistic: it is a SIBLING of whatever it explains, never a
// child. TextWithTerms renders a glossary term as <span role="button"> with
// stopPropagation(), so a glossary link inside a real <button> swallows the press
// (the reason v3.2.51 took hard words off buttons). And it must never sit inside
// another <button> — the editor's Region is one, so the preview overlays this
// instead of nesting it.

import React from 'react';
import type { PanelPalette } from '../player/panelTheme';

/** The slice of the panel palette the help widgets read. */
export type HelpPalette = Pick<PanelPalette, 'surf2' | 'border' | 'accent' | 'text' | 'muted'>;

export interface HelpButtonProps {
  /** What this explains. Becomes the accessible name: "What's this? <label>". */
  label: string;
  /**
   * Which kind of thing it explains ('action', 'step', …). Carried as
   * `data-help-kind` so the nightly robot and the tests have a handle that is
   * not copy, and used by the panel to label its analytics.
   */
  kind: string;
  isOpen: boolean;
  onToggle: () => void;
  palette: HelpPalette;
  /** Id of the card this opens, so `aria-controls` can point at it. */
  cardId?: string;
  /** Row-height floor. Action rows stretch to their button; a title row needs one. */
  minHeight?: number;
  /** Escape hatch for placement only (the editor preview overlays it). */
  style?: React.CSSProperties;
}

export function HelpButton({
  label, kind, isOpen, onToggle, palette: p, cardId, minHeight, style,
}: HelpButtonProps): JSX.Element {
  return (
    <button
      type="button"
      data-testid="help-button"
      data-help-kind={kind}
      // Named for the question a beginner actually asks. The label says what
      // this explains, per the button rule; the glyph alone would be
      // colour/shape-only signalling.
      aria-label={`What's this? ${label}`}
      aria-expanded={isOpen}
      aria-controls={isOpen ? cardId : undefined}
      onClick={onToggle}
      style={{
        flex: '0 0 auto',
        boxSizing: 'border-box',
        // 44px is the touch-target floor; measured at 34px on a 375px viewport
        // before v3.2.54, which is under it.
        minWidth: 44,
        minHeight,
        padding: '0 9px',
        background: isOpen ? p.surf2 : 'transparent',
        border: `1px solid ${isOpen ? p.accent : p.border}`,
        color: isOpen ? p.text : p.muted,
        borderRadius: 9,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      ?
    </button>
  );
}
