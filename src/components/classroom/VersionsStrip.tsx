// src/components/classroom/VersionsStrip.tsx
//
// Every version of one space, laid out across the top of the screen while you
// are making changes (CARD_LIBRARY_DESIGN.md, "Stage 3's screen: browse, then
// focus" — "versions across the top at full width, where they finally get
// real room").
//
// Same answers as the small chips in the deck — which versions exist, what
// each is called, when it was made, which one is playing, which ones fold
// away — because both ask cardRolodex.ts. Only the shape differs: the deck
// has a narrow column and squeezes them into chips; here there is a whole
// row, so each version gets its note and its date on their own lines and the
// one in play is obvious from across a classroom.

import React, { useState } from 'react';
import type { CatalogSpace, ValidationIssue } from './classroomApi';
import { TIER_WORD, cardHasDrift, madeOnLabel, splitVersions, type SpaceCard } from './cardRolodex';

interface VersionsStripProps {
  space: CatalogSpace;
  cards: SpaceCard[];
  warningsByCopy: Map<string, ValidationIssue[]>;
  busy: boolean;
  /** null switches the space back to the original. */
  onUse: (copyId: string | null) => void;
}

interface VersionCardProps {
  /** null for the original, which has no owner and was never "made". */
  name: string | null;
  note: string | undefined;
  madeOn: string | null;
  isPlaying: boolean;
  drift: boolean;
  busy: boolean;
  onUse: () => void;
}

function VersionCard({ name, note, madeOn, isPlaying, drift, busy, onUse }: VersionCardProps): JSX.Element {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.2rem',
      minWidth: 170, maxWidth: 260,
      border: isPlaying ? '2px solid #7c3aed' : '1px solid #e9ecef',
      background: isPlaying ? '#faf5ff' : '#fff',
      borderRadius: 10, padding: '0.5rem 0.7rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.85rem', fontWeight: isPlaying ? 700 : 600,
          color: isPlaying ? '#6d28d9' : '#495057',
        }}>
          {name ?? 'The original'}
        </span>
        {isPlaying && (
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, color: '#065f46',
            background: '#d1fae5', borderRadius: 999, padding: '0.05rem 0.4rem',
          }}>
            Playing now
          </span>
        )}
      </div>
      {note && <div style={{ fontSize: '0.76rem', color: '#6b7280' }}>{note}</div>}
      {madeOn && <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{madeOn}</div>}
      {drift && (
        <div style={{ fontSize: '0.74rem', color: '#92400e' }}>
          ⚠️ The original changed since you made this — worth a look
        </div>
      )}
      {!isPlaying && (
        <button
          type="button"
          onClick={onUse}
          disabled={busy}
          // Names the VERSION, not just the space: several versions are on
          // screen at once, and the note plus the date is what tells them
          // apart out loud as well as on screen.
          aria-label={`Play ${note || name || 'the original'}${madeOn ? `, ${madeOn.toLowerCase()}` : ''}`}
          style={{
            alignSelf: 'flex-start', marginTop: '0.15rem', padding: 0,
            fontSize: '0.76rem', border: 'none', background: 'none', color: '#7c3aed',
            cursor: busy ? 'not-allowed' : 'pointer', textDecoration: 'underline',
          }}
        >
          {name ? 'Play this one' : 'Go back to the original'}
        </button>
      )}
    </div>
  );
}

export function VersionsStrip({ space, cards, warningsByCopy, busy, onUse }: VersionsStripProps): JSX.Element {
  const [showEarlier, setShowEarlier] = useState(false);
  // A whole row is wider than the deck's column, so more fit before anything
  // has to fold away — four rather than the deck's three, plus whatever is
  // playing. Not five: a space keeps at most five saved versions
  // (MAX_VERSIONS_PER_SLOT), and at five nothing would ever fold, which would
  // leave the control below permanently unreachable — and six tiles in a row
  // is already more than a classroom projector shows without wrapping.
  const { recent, earlier } = splitVersions(cards, space.copyId, 4);

  const cardFor = ({ id, copy }: SpaceCard): JSX.Element => (
    <VersionCard
      key={id}
      name={TIER_WORD[copy.owner?.tier ?? 'individual']}
      note={copy.role}
      madeOn={madeOnLabel(copy.createdAt)}
      isPlaying={space.copyId === id}
      drift={cardHasDrift(warningsByCopy.get(id))}
      busy={busy}
      onUse={() => onUse(id)}
    />
  );

  return (
    <section
      aria-label={`Versions of ${space.title}`}
      style={{
        padding: '0.6rem 1.25rem', background: '#fff', borderBottom: '1px solid #dee2e6',
      }}
    >
      <div style={{
        fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em',
        color: '#9ca3af', fontWeight: 700, marginBottom: '0.35rem',
      }}>
        Versions of this space
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <VersionCard
          name={null}
          note={undefined}
          madeOn={null}
          isPlaying={!space.copyId}
          drift={false}
          busy={busy}
          onUse={() => onUse(null)}
        />
        {recent.map(cardFor)}
        {showEarlier && earlier.map(cardFor)}
        {earlier.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEarlier(v => !v)}
            style={{
              alignSelf: 'center', padding: '0.4rem 0.7rem', borderRadius: 10, fontSize: '0.78rem',
              border: '1px solid #e9ecef', background: '#fff', color: '#495057', cursor: 'pointer',
            }}
          >
            {showEarlier ? 'Hide earlier versions' : `Show earlier versions (${earlier.length})`}
          </button>
        )}
        {cards.length === 0 && (
          <p style={{ margin: 0, alignSelf: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
            Nothing but the original so far. Saving a change keeps a copy of
            what it said before, and it shows up here.
          </p>
        )}
      </div>
    </section>
  );
}
