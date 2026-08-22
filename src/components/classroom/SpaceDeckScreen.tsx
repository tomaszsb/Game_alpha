// src/components/classroom/SpaceDeckScreen.tsx
//
// One screen for your spaces — the browsing half (CARD_LIBRARY_DESIGN.md,
// "Stage 3's screen: browse, then focus").
//
// The deck runs down the left, exactly the deck Classroom Setup has always
// shown (SpaceDeckPanel — the same component, not a second copy). The space
// you land on shows on the right the way a player meets it, with a short
// strip of facts underneath for scanning and comparing. Decisions BETWEEN
// spaces — switching one off, adding one of your own — stay in the deck,
// because that is what they are about.
//
// Two data sources meet here, and this screen is the one place they are read:
//   • the deck comes from the classroom catalog (SpaceDeckPanel's own
//     fetchCatalog) — the only thing that knows about switched-off spaces,
//     locks, and how many versions a space has;
//   • the player view comes from the three space CSVs (loadEditorSource),
//     which the server serves from the classroom's baked board — so what is
//     previewed is the version each space is actually PLAYING, not stock.
// Neither loader is duplicated: the deck owns one, this screen owns the
// other, and both are shared with the screens they came from.
//
// Focus mode — the collapse-to-icon editing view — is stage 3b-ii. Until it
// lands, "Make changes" opens today's Space Data Editor on the space you are
// looking at, and closing it puts you back here on the same space.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SpaceDeckPanel } from './SpaceDeckPanel';
import type { CatalogResponse, CatalogSpace } from './classroomApi';
import { DataEditor } from '../editor/DataEditor';
import { PlayerPreviewPanel } from '../editor/PlayerPreviewPanel';
import { loadEditorSource, type EditorSource } from '../editor/loadEditorSource';
import { SpaceRow } from '../editor/types/EditorTypes';
import { shortName } from '../../utils/boardCommon';
import { colors } from '../../styles/theme';

interface SpaceDeckScreenProps {
  onClose: () => void;
  /** Which classroom's deck. Defaults to the public default classroom. */
  instanceId?: string;
}

const EMPTY_SOURCE: EditorSource = { spaces: [], diceRolls: [], modalConfigs: [] };

/** "3 — the original and 2 of yours": how many ways this space can read. */
function versionsLabel(catalog: CatalogResponse | null, spaceName: string): string {
  const mine = Object.values(catalog?.copies ?? {}).filter(c => c.slot === spaceName).length;
  if (mine === 0) return '1 — just the original';
  return `${mine + 1} — the original and ${mine === 1 ? 'one of yours' : `${mine} of yours`}`;
}

export function SpaceDeckScreen({ onClose, instanceId = 'classroom-1' }: SpaceDeckScreenProps): JSX.Element {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [source, setSource] = useState<EditorSource>(EMPTY_SOURCE);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogSpace | null>(null);
  const [visitType, setVisitType] = useState<'First' | 'Subsequent'>('First');
  const [isEditing, setIsEditing] = useState(false);
  // Bumped when the editor closes. A save in there changes the space without
  // going through the deck, so the deck has to be told to look again.
  const [deckReloads, setDeckReloads] = useState(0);

  // The deck's own version stamp. It changes whenever anything about the
  // classroom is saved, which is exactly when the player view needs re-reading.
  const configVersion = catalog?.configVersion;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await loadEditorSource();
        if (!cancelled) { setSource(next); setSourceError(null); }
      } catch {
        if (!cancelled) setSourceError('Could not read what players see for these spaces.');
      }
    })();
    return () => { cancelled = true; };
    // Re-read after a deck change, and again after the editor closes — a save
    // in there changes what the space says.
  }, [configVersion, isEditing]);

  useEffect(() => {
    // Esc closes the screen — but not while the editor is open on top of it,
    // where Esc is the editor's own way out.
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isEditing) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isEditing]);

  const handleDeckLoaded = useCallback((next: CatalogResponse | null) => {
    setCatalog(next);
    // Keep the space on the right honest: after a change it may have been
    // switched off, or now play a different version.
    setSelected(prev => (prev ? next?.spaces.find(s => s.name === prev.name) ?? prev : prev));
  }, []);

  const row: SpaceRow | null = useMemo(() => {
    if (!selected) return null;
    return source.spaces.find(
      s => s.space_name === selected.name && s.visit_type === visitType
    ) ?? null;
  }, [selected, source.spaces, visitType]);

  // Where players go next. The space's own destination cells answer this for
  // most spaces; a space whose next step is decided by an outcome leaves them
  // blank, and the deck's own edge list is what knows those.
  const destinations = useMemo(() => {
    if (!selected) return [] as string[];
    const cells: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const v = row ? (row[`space_${i}` as keyof SpaceRow] as string | undefined) : undefined;
      if (v) cells.push(...(v.match(/[A-Z][A-Z0-9-]{2,}/g) ?? []));
    }
    const fromEdges = (catalog?.edges ?? [])
      .filter(e => e.from === selected.name)
      .map(e => e.to);
    const all = cells.length > 0 ? cells : fromEdges;
    return [...new Set(all)];
  }, [selected, row, catalog]);

  const titleFor = useCallback(
    (name: string) => catalog?.spaces.find(s => s.name === name)?.title || shortName(name),
    [catalog]
  );

  return (
    <div
      role="dialog"
      aria-label="Your deck of spaces"
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        padding: '0.75rem 1.25rem', background: '#fff', borderBottom: '1px solid #dee2e6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: colors.text.primary }}>
            🏫 Your deck of spaces
          </h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: colors.text.secondary }}>
            Pick a space on the left to meet it the way a player does. Switch a
            space off, or add one of your own, from the deck — the originals
            always stay in the library. Changes apply to new games only.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '0.5rem 1rem', background: '#f8f9fa', color: '#495057',
            border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem',
          }}
          title="Close (Esc)"
        >
          ✕ Close
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
        <div style={{
          width: 'min(46%, 560px)', minWidth: 320, display: 'flex', flexDirection: 'column',
          minHeight: 0, borderRight: '1px solid #dee2e6', background: '#f8f9fa',
        }}>
          <SpaceDeckPanel
            instanceId={instanceId}
            selectedSpaceName={selected?.name ?? null}
            onSelectSpace={setSelected}
            onDeckLoaded={handleDeckLoaded}
            reloadToken={deckReloads}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {!selected ? (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2.2rem' }} aria-hidden>👀</div>
              <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: colors.text.primary }}>
                Nothing picked yet
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: colors.text.secondary, maxWidth: 380 }}>
                Pick a space from your deck and it shows up here the way your
                players will meet it.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: colors.text.primary }}>
                    {selected.title}
                  </h3>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                    What players see
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {(['First', 'Subsequent'] as const).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVisitType(v)}
                      aria-pressed={visitType === v}
                      style={{
                        padding: '0.3rem 0.65rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
                        border: `1px solid ${visitType === v ? '#a78bfa' : '#e9ecef'}`,
                        background: visitType === v ? '#faf5ff' : '#fff',
                        color: visitType === v ? '#6d28d9' : '#6b7280',
                        cursor: 'pointer',
                      }}
                    >
                      {v === 'First' ? 'First time here' : 'Coming back'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                      border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer',
                    }}
                    title="Open the editor on this space"
                  >
                    ✏️ Make changes
                  </button>
                </div>
              </div>

              {!selected.used ? (
                <div style={{
                  padding: '0.8rem 1rem', borderRadius: 10, fontSize: '0.85rem',
                  background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
                }}>
                  This space is switched off, so players never reach it
                  {selected.detour ? ` — they go to ${titleFor(selected.detour)} instead` : ''}.
                  Switch it back on in your deck to see it here.
                </div>
              ) : sourceError ? (
                <div style={{
                  padding: '0.8rem 1rem', borderRadius: 10, fontSize: '0.85rem',
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                }}>
                  ⚠️ {sourceError}
                </div>
              ) : (
                <>
                  <div style={{
                    maxWidth: 460, border: '1px solid #dee2e6', borderRadius: 12, overflow: 'hidden',
                  }}>
                    <PlayerPreviewPanel
                      currentSpace={row}
                      visitType={visitType}
                      diceRollData={source.diceRolls}
                    />
                  </div>

                  <dl style={{
                    display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.35rem 0.9rem',
                    margin: '0.9rem 0 0', maxWidth: 560, fontSize: '0.84rem',
                  }}>
                    <dt style={factLabel}>Time</dt>
                    <dd style={factValue}>{row?.Time?.trim() || 'No time cost'}</dd>
                    <dt style={factLabel}>Fee</dt>
                    <dd style={factValue}>{row?.Fee?.trim() || 'No fee'}</dd>
                    <dt style={factLabel}>Leads to</dt>
                    <dd style={factValue}>
                      {destinations.length > 0
                        ? destinations.map(titleFor).join(', ')
                        : 'Nowhere — this is the end of the path'}
                    </dd>
                    <dt style={factLabel}>Versions</dt>
                    <dd style={factValue}>{versionsLabel(catalog, selected.name)}</dd>
                  </dl>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isEditing && selected && (
        <DataEditor
          initialSpaceName={selected.name}
          onClose={() => { setIsEditing(false); setDeckReloads(n => n + 1); }}
        />
      )}
    </div>
  );
}

const factLabel: React.CSSProperties = {
  margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#9ca3af', fontWeight: 700, alignSelf: 'center',
};

const factValue: React.CSSProperties = {
  margin: 0, color: colors.text.primary,
};
