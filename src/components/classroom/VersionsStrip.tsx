// src/components/classroom/VersionsStrip.tsx
//
// The two things a space can say, across the top of the screen while you are
// making changes: THE ORIGINAL and YOUR VERSION, with a way to switch between
// them.
//
// It used to be an accumulating list with a "show earlier versions" fold,
// because a save minted another card every time. It doesn't any more — a save
// edits your card — so there are two, and two need no list and no fold.
//
// One exception, deliberately kept: a classroom saved while the old behaviour
// was live can still hold several cards for one space. Those are all shown,
// each with the date it was made, rather than quietly hidden. Nothing creates
// a new one.

import React from 'react';
import type { CatalogSpace, ValidationIssue } from './classroomApi';
import { YOUR_VERSION, cardHasDrift, madeOnLabel, newestFirst, type SpaceCard } from './cardRolodex';

interface VersionsStripProps {
  space: CatalogSpace;
  cards: SpaceCard[];
  warningsByCopy: Map<string, ValidationIssue[]>;
  busy: boolean;
  /** null switches the space back to the original. */
  onUse: (copyId: string | null) => void;
}

interface VersionCardProps {
  /** null for the original, which has no note and was never "made". */
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
          // Names WHICH one, not just the space: an old classroom can have
          // more than one of yours on screen, and the note plus the date is
          // what tells them apart out loud as well as on screen.
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
  const ordered = [...cards].sort(newestFirst);

  return (
    <section
      aria-label={`What ${space.title} can say`}
      style={{
        padding: '0.6rem 1.25rem', background: '#fff', borderBottom: '1px solid #dee2e6',
      }}
    >
      <div style={{
        fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em',
        color: '#9ca3af', fontWeight: 700, marginBottom: '0.35rem',
      }}>
        What this space can say
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
        {ordered.map(({ id, copy }) => (
          <VersionCard
            key={id}
            name={YOUR_VERSION}
            note={copy.role}
            madeOn={madeOnLabel(copy.createdAt)}
            isPlaying={space.copyId === id}
            drift={cardHasDrift(warningsByCopy.get(id))}
            busy={busy}
            onUse={() => onUse(id)}
          />
        ))}
        {cards.length === 0 && (
          <p style={{ margin: 0, alignSelf: 'center', fontSize: '0.8rem', color: '#9ca3af' }}>
            Only the original so far. The first time you save a change, your
            own version shows up beside it.
          </p>
        )}
      </div>
    </section>
  );
}
