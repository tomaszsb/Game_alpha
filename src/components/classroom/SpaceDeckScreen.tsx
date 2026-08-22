// src/components/classroom/SpaceDeckScreen.tsx
//
// One screen for your spaces, with two jobs (CARD_LIBRARY_DESIGN.md, "Stage
// 3's screen: browse, then focus"). Two MODES, not two screens — which is the
// actual fix for the complaint that started this arc, that the old pair of
// screens had overlapping jobs and neither said which was which.
//
// BROWSING. The deck runs down the left, exactly the deck Classroom Setup has
// always shown (SpaceDeckPanel — the same component, not a second copy). The
// space you land on shows on the right the way a player meets it, with a
// short strip of facts underneath for scanning and comparing. Decisions
// BETWEEN spaces — switching one off, adding one of your own — stay in the
// deck, because that is what they are about.
//
// MAKING CHANGES. "Make changes" doesn't go anywhere: this same screen gives
// the space the whole width. The deck collapses to a rolodex button, top
// left; every version of the space runs full width across the top, where they
// finally get real room; the editing fields sit beside the player view.
// Pressing the rolodex button slides the deck back out OVER the card instead
// of navigating away — "minimise" implies it comes back, and it means you
// keep your place instead of losing it whenever you want to glance at another
// space. The deck is never unmounted between the two modes; it is the same
// element moving, which is why its scroll position and its notices survive.
//
// Two data sources meet here, and this screen is the one place they are read:
//   • the deck comes from the classroom catalog (SpaceDeckPanel's own
//     fetchCatalog) — the only thing that knows about switched-off spaces,
//     locks, and which versions a space has;
//   • the rows come from the three space CSVs (useEditorSource, shared with
//     the old Space Data Editor), which the server serves from the
//     classroom's baked board — so what is previewed is the version each
//     space is actually PLAYING, not stock.
// Neither loader is duplicated: the deck owns one, this screen owns the
// other, and both are shared with the screens they came from.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SpaceDeckPanel } from './SpaceDeckPanel';
import { VersionsStrip } from './VersionsStrip';
import { cardsForSpace, warningsByCard } from './cardRolodex';
import { selectCard, type CatalogResponse, type CatalogSpace } from './classroomApi';
import { SpaceEditor } from '../editor/SpaceEditor';
import { PlayerPreviewPanel } from '../editor/PlayerPreviewPanel';
import { useEditorSource } from '../editor/useEditorSource';
import { SpaceRow } from '../editor/types/EditorTypes';
import { shortName } from '../../utils/boardCommon';
import { colors } from '../../styles/theme';

interface SpaceDeckScreenProps {
  onClose: () => void;
  /** Which classroom's deck. Defaults to the public default classroom. */
  instanceId?: string;
}

/** "3 — the original and 2 of yours": how many ways this space can read. */
function versionsLabel(catalog: CatalogResponse | null, spaceName: string): string {
  const mine = cardsForSpace(catalog, spaceName).length;
  if (mine === 0) return '1 — just the original';
  return `${mine + 1} — the original and ${mine === 1 ? 'one of yours' : `${mine} of yours`}`;
}

export function SpaceDeckScreen({ onClose, instanceId = 'classroom-1' }: SpaceDeckScreenProps): JSX.Element {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selected, setSelected] = useState<CatalogSpace | null>(null);
  const [visitType, setVisitType] = useState<'First' | 'Subsequent'>('First');
  const [isMakingChanges, setIsMakingChanges] = useState(false);
  // The deck slid out over the card while making changes. Meaningless while
  // browsing, where the deck is simply there.
  const [isDeckOut, setIsDeckOut] = useState(false);
  // Bumped when something outside the deck changes the classroom, so the deck
  // reads itself again — a save mints a new version without going through it.
  const [deckReloads, setDeckReloads] = useState(0);
  // Bumped to make the three CSVs be read again. Kept apart from the deck's
  // own token because re-reading throws away anything typed and not saved.
  const [sourceReloads, setSourceReloads] = useState(0);
  const [versionBusy, setVersionBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const editor = useEditorSource(selected?.name ?? null, sourceReloads);

  // The deck's own version stamp. It changes whenever anything about the
  // classroom is saved, which is exactly when the rows need re-reading.
  const configVersion = catalog?.configVersion;
  const lastConfigVersion = useRef<number | null>(null);
  useEffect(() => {
    if (configVersion === undefined) return;
    if (lastConfigVersion.current === null) {
      // First sight of the deck. The rows are already being read; nothing to do.
      lastConfigVersion.current = configVersion;
      return;
    }
    if (lastConfigVersion.current !== configVersion) {
      lastConfigVersion.current = configVersion;
      setSourceReloads(n => n + 1);
    }
  }, [configVersion]);

  const discardsChanges = useCallback((question: string): boolean => {
    if (!editor.hasUnsavedChanges) return true;
    return window.confirm(`${question}\n\nYou have changes here that aren't saved yet. They will be thrown away.`);
  }, [editor.hasUnsavedChanges]);

  const leaveMakingChanges = useCallback(() => {
    if (!discardsChanges('Go back to your deck?')) return;
    if (editor.hasUnsavedChanges) setSourceReloads(n => n + 1);
    setIsMakingChanges(false);
    setIsDeckOut(false);
    setNotice(null);
  }, [discardsChanges, editor.hasUnsavedChanges]);

  useEffect(() => {
    // Esc backs out one step at a time: the deck slides away, then you go
    // back to browsing, then the screen closes.
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isDeckOut) { setIsDeckOut(false); return; }
      if (isMakingChanges) { leaveMakingChanges(); return; }
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, isMakingChanges, isDeckOut, leaveMakingChanges]);

  const handleDeckLoaded = useCallback((next: CatalogResponse | null) => {
    setCatalog(next);
    // Keep the space on the right honest: after a change it may have been
    // switched off, or now play a different version.
    setSelected(prev => (prev ? next?.spaces.find(s => s.name === prev.name) ?? prev : prev));
  }, []);

  // Picking a space out of the slid-out deck keeps you where you were: you
  // were making changes, so you carry on making changes, now on that space.
  // Sending you back to browsing would eject you from the job you were doing
  // and hide the fields you had open — and making changes shows the player
  // view too, so nothing browsing offers is lost by staying.
  const handleSelectSpace = useCallback((space: CatalogSpace) => {
    if (isMakingChanges) {
      if (!discardsChanges(`Move to “${space.title}”?`)) return;
      if (editor.hasUnsavedChanges) setSourceReloads(n => n + 1);
      setIsDeckOut(false);
    }
    setSelected(space);
    setNotice(null);
  }, [isMakingChanges, discardsChanges, editor.hasUnsavedChanges]);

  const handleSave = useCallback(async () => {
    await editor.handleSave();
    // A save mints a new version without the deck hearing about it, so the
    // deck (and the versions across the top, which read from it) must look
    // again or they will keep saying the space has only the original.
    setDeckReloads(n => n + 1);
  }, [editor]);

  const handleUseVersion = useCallback(async (copyId: string | null) => {
    if (!selected) return;
    if (!discardsChanges('Switch this space to another version?')) return;
    setVersionBusy(true);
    setNotice(null);
    try {
      const result = await selectCard(instanceId, { slot: selected.name, copyId });
      if (result.success) {
        setNotice(copyId
          ? `“${selected.title}” now plays that version.`
          : `“${selected.title}” plays the original again.`);
        setDeckReloads(n => n + 1);
        setSourceReloads(n => n + 1);
      } else {
        const detail = result.report?.errors?.map(e => e.message).join(' · ')
          ?? result.detail ?? result.error ?? 'The server turned that down.';
        setNotice(`⚠️ ${detail}`);
      }
    } finally {
      setVersionBusy(false);
    }
  }, [selected, instanceId, discardsChanges]);

  const row: SpaceRow | null = useMemo(() => {
    if (!selected) return null;
    return editor.spacesData.find(
      s => s.space_name === selected.name && s.visit_type === visitType
    ) ?? null;
  }, [selected, editor.spacesData, visitType]);

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

  const cardWarnings = useMemo(() => warningsByCard(catalog), [catalog]);

  const deckWidth = 'min(46%, 560px)';

  // Hung off <body> rather than left where it sits in the tree. The setup
  // screen around it is itself a stacked layer, which boxes in everything
  // inside it: the board's floating "Edit / Edges" strip, which stacks HIGHER
  // than that whole box, was painting over this screen's top-right corner and
  // swallowing the clicks meant for its way out. Verified in the browser
  // 2026-08-22 — the click on "Back to your deck" was landing on "Edges on".
  // The same corner was already swallowing "✕ Close" before this slice.
  return createPortal(
    <div
      role="dialog"
      aria-label="Your deck of spaces"
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        padding: '0.75rem 1.25rem', background: '#fff', borderBottom: '1px solid #dee2e6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          {isMakingChanges && (
            // The rolodex, top left. Pressing it slides the deck back out
            // over the card rather than leaving this space behind.
            <button
              type="button"
              onClick={() => setIsDeckOut(v => !v)}
              aria-expanded={isDeckOut}
              title={isDeckOut ? 'Put your deck away' : 'Look at your deck without leaving this space'}
              style={{
                flexShrink: 0, width: 40, height: 40, borderRadius: 10, fontSize: '1.15rem',
                border: `1px solid ${isDeckOut ? '#a78bfa' : '#dee2e6'}`,
                background: isDeckOut ? '#faf5ff' : '#fff',
                cursor: 'pointer', lineHeight: 1,
              }}
            >
              <span aria-hidden>🗂️</span>
              <span style={srOnly}>{isDeckOut ? 'Put your deck away' : 'Show your deck'}</span>
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: colors.text.primary }}>
              {isMakingChanges && selected
                ? `✏️ ${selected.title}`
                : '🏫 Your deck of spaces'}
            </h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: colors.text.secondary }}>
              {isMakingChanges
                ? 'Change what this space says. Saving keeps the version before it, so you can always go back. Changes apply to new games only.'
                : 'Pick a space on the left to meet it the way a player does. Switch a space off, or add one of your own, from the deck — the originals always stay in the library. Changes apply to new games only.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          {isMakingChanges && editor.hasUnsavedChanges && (
            <span style={{
              fontSize: '0.74rem', fontWeight: 600, padding: '0.2rem 0.5rem',
              background: '#fff3cd', color: '#856404', borderRadius: 6,
            }}>
              Not saved yet
            </span>
          )}
          {isMakingChanges && editor.saveStatus && (
            <span style={{
              fontSize: '0.78rem', padding: '0.3rem 0.6rem', borderRadius: 6, maxWidth: 380,
              background: editor.saveStatus.type === 'success' ? '#d4edda' : '#f8d7da',
              color: editor.saveStatus.type === 'success' ? '#155724' : '#721c24',
            }}>
              {editor.saveStatus.message}
            </span>
          )}
          {isMakingChanges && (
            <>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={editor.isLoading || !!editor.error || editor.isSaving}
                style={{
                  padding: '0.5rem 1rem', background: '#28a745', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: editor.isSaving ? 'wait' : 'pointer', fontSize: '0.9rem', fontWeight: 600,
                }}
              >
                {editor.isSaving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={leaveMakingChanges}
                style={{
                  padding: '0.5rem 1rem', background: '#f8f9fa', color: '#495057',
                  border: '1px solid #dee2e6', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem',
                }}
              >
                ← Back to your deck
              </button>
            </>
          )}
          {!isMakingChanges && (
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
          )}
        </div>
      </div>

      {isMakingChanges && selected && (
        <VersionsStrip
          space={selected}
          cards={cardsForSpace(catalog, selected.name)}
          warningsByCopy={cardWarnings}
          busy={versionBusy}
          onUse={copyId => void handleUseVersion(copyId)}
        />
      )}

      {isMakingChanges && notice && (
        <div style={{
          padding: '0.5rem 1.25rem', fontSize: '0.85rem',
          background: notice.startsWith('⚠️') ? '#fef2f2' : '#ecfdf5',
          borderBottom: `1px solid ${notice.startsWith('⚠️') ? '#fecaca' : '#a7f3d0'}`,
          color: notice.startsWith('⚠️') ? '#991b1b' : '#065f46',
        }}>
          {notice}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', position: 'relative' }}>
        {/* The deck. One element in both modes — while browsing it is the
            left-hand column; while making changes it becomes a drawer that
            slides over the card. Never unmounted, so it keeps its scroll
            position and you keep your place. */}
        <div
          aria-hidden={isMakingChanges && !isDeckOut}
          style={isMakingChanges ? {
            position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 20,
            width: deckWidth, minWidth: 320, display: 'flex', flexDirection: 'column',
            borderRight: '1px solid #dee2e6', background: '#f8f9fa',
            boxShadow: '4px 0 16px rgba(0,0,0,0.15)',
            transform: isDeckOut ? 'translateX(0)' : 'translateX(-102%)',
            visibility: isDeckOut ? 'visible' : 'hidden',
            transition: 'transform 0.22s ease, visibility 0.22s',
          } : {
            width: deckWidth, minWidth: 320, display: 'flex', flexDirection: 'column',
            minHeight: 0, borderRight: '1px solid #dee2e6', background: '#f8f9fa',
          }}
        >
          <SpaceDeckPanel
            instanceId={instanceId}
            selectedSpaceName={selected?.name ?? null}
            onSelectSpace={handleSelectSpace}
            onDeckLoaded={handleDeckLoaded}
            reloadToken={deckReloads}
          />
        </div>

        {isMakingChanges && isDeckOut && (
          <button
            type="button"
            aria-label="Put your deck away"
            onClick={() => setIsDeckOut(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 15, border: 'none',
              background: 'rgba(0,0,0,0.25)', cursor: 'pointer',
            }}
          />
        )}

        {isMakingChanges ? (
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
            {editor.isLoading ? (
              <div style={centered}>Reading what this space says…</div>
            ) : editor.error ? (
              <div style={{ ...centered, color: '#991b1b' }}>⚠️ {editor.error}</div>
            ) : !selected?.used ? (
              <div style={centered}>
                This space is switched off, so there is nothing for players to
                read here. Switch it back on in your deck first.
              </div>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', background: '#f8f9fa' }}>
                  {/* The very same fields the Space Data Editor has always
                      shown — reused whole, not rebuilt. */}
                  <SpaceEditor
                    spaceFirst={editor.spaceFirst}
                    spaceSubsequent={editor.spaceSubsequent}
                    visitType={visitType}
                    allSpaceNames={editor.allSpaceNames}
                    diceRollData={editor.diceRollData}
                    modalConfigData={editor.modalConfigData}
                    onVisitTypeChange={setVisitType}
                    onFieldChange={editor.handleFieldChange}
                    displayLabelOverride={
                      editor.spaceFirst?._extraColumns?.display_label_override
                      ?? editor.spaceSubsequent?._extraColumns?.display_label_override
                      ?? ''
                    }
                    onDisplayLabelChange={editor.handleDisplayLabelChange}
                    onUpdateDiceRoll={editor.handleDiceRollUpdate}
                    onAddDiceRoll={editor.handleAddDiceRoll}
                    onDeleteDiceRoll={editor.handleDeleteDiceRoll}
                    onModalConfigChange={editor.handleModalConfigChange}
                  />
                </div>
                <div style={{
                  width: 360, minWidth: 300, height: '100%', overflow: 'hidden',
                  borderLeft: '2px solid #e0e0e0', background: '#fff',
                }}>
                  <PlayerPreviewPanel
                    currentSpace={visitType === 'First' ? editor.spaceFirst : editor.spaceSubsequent}
                    visitType={visitType}
                    diceRollData={editor.diceRollData}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
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
                      onClick={() => { setIsMakingChanges(true); setNotice(null); }}
                      disabled={!selected.used}
                      style={{
                        padding: '0.4rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                        border: 'none', background: selected.used ? '#7c3aed' : '#d1d5db', color: '#fff',
                        cursor: selected.used ? 'pointer' : 'not-allowed',
                      }}
                      title={selected.used
                        ? 'Work on this space — your deck folds away to make room'
                        : 'Switch this space back on before changing what it says'}
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
                ) : editor.error ? (
                  <div style={{
                    padding: '0.8rem 1rem', borderRadius: 10, fontSize: '0.85rem',
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                  }}>
                    ⚠️ Could not read what players see for these spaces.
                  </div>
                ) : (
                  <>
                    <div style={{
                      maxWidth: 460, border: '1px solid #dee2e6', borderRadius: 12, overflow: 'hidden',
                    }}>
                      <PlayerPreviewPanel
                        currentSpace={row}
                        visitType={visitType}
                        diceRollData={editor.diceRollData}
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
        )}
      </div>
    </div>,
    document.body
  );
}

const factLabel: React.CSSProperties = {
  margin: 0, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#9ca3af', fontWeight: 700, alignSelf: 'center',
};

const factValue: React.CSSProperties = {
  margin: 0, color: colors.text.primary,
};

const centered: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '2rem', textAlign: 'center', fontSize: '0.9rem', color: colors.text.secondary,
};

// Visible to a screen reader, invisible on screen — the rolodex button is an
// icon, and an icon on its own says nothing out loud.
const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};
