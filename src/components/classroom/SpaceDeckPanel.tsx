// src/components/classroom/SpaceDeckPanel.tsx
//
// Your deck of spaces — the left-hand column, and everything you can decide
// BETWEEN spaces: switching one off (with its detour confirm), picking whether
// a space plays the original or your version, and adding a space of your own.
//
// Changing what a space SAYS is not here. There used to be a second, smaller
// editor behind a "Customize" button in these rows, with different fields from
// the real one — the maintainer's report was that there seemed to be "two ways
// of changing the cards" and the fields looked different depending which you
// pressed. Both were right. There is one way now: pick a space, then "Make
// changes" on the screen beside the deck.
//
// Extracted from ClassroomSetup on 2026-08-22 so the merged screen
// (SpaceDeckScreen, CARD_LIBRARY_DESIGN.md "Stage 3's screen: browse, then
// focus") shows the SAME deck rather than a second one that would drift.
// ClassroomSetup is now the chrome around this panel; the merged screen puts
// it beside the player view. Behaviour is unchanged from the version this
// was lifted out of.
//
// Browse the full stock deck (including switched-off spaces — served by
// GET /api/instances/:id/catalog, NOT /data, which only carries the
// resolved board). Every change validates server-side and rebakes the board
// for all future games; running games are untouched.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCatalog, postBoardChange, selectCard,
  createInsertion, updateInsertion, deleteInsertion,
  type CatalogResponse, type CatalogSpace, type ValidationReport, type ValidationIssue,
  type Insertion,
} from './classroomApi';
import {
  YOUR_VERSION, cardsForSpace, cardHasDrift, madeOnLabel, newestFirst, warningsByCard,
  type SpaceCard,
} from './cardRolodex';
import { SwitchOffConfirm } from './SwitchOffConfirm';
import { InsertionEditor, type InsertionDraft } from './InsertionEditor';
import { getNpcCharacterInfo } from '../../constants/characters';
import { colors } from '../../styles/theme';

/**
 * Who does the talking at a space.
 *
 * Ten spaces share a short name — "Scope Check" is the Lender's, the
 * Architect's and the Engineer's; "Initiation" is three more — so a row that
 * showed only a title left the reader to guess which one they were looking at,
 * and the raw id underneath it ("ARCH-FEE-REVIEW") is not something anyone
 * should have to read.
 *
 * getNpcCharacterInfo deliberately answers nothing for the five spaces where
 * the narration is the project manager's own first-person thought ("I pick a
 * direction"), so those must never be labelled with a character who isn't
 * speaking. They get "You", which is exactly who is talking there — as do the
 * couple of spaces with no character attached at all.
 */
function speakerFor(spaceName: string): string {
  return getNpcCharacterInfo(spaceName)?.shortLabel ?? 'You';
}

interface RolodexChipProps {
  /** null for "the original" chip. */
  name: string | null;
  role: string | undefined;
  /** "Made 20 Aug", or null for the original (which was never "made"). */
  madeOn: string | null;
  isPlaying: boolean;
  drift: boolean;
  busy: boolean;
  onUse: () => void;
}

function RolodexChip({ name, role, madeOn, isPlaying, drift, busy, onUse }: RolodexChipProps): JSX.Element {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.15rem',
      border: isPlaying ? '2px solid #7c3aed' : '1px solid #e9ecef',
      background: isPlaying ? '#faf5ff' : '#fff',
      borderRadius: 10, padding: '0.35rem 0.6rem', fontSize: '0.78rem', maxWidth: 260,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: isPlaying ? 700 : 500, color: isPlaying ? '#6d28d9' : '#495057' }}>
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
        {!isPlaying && (
          <button
            type="button"
            onClick={onUse}
            disabled={busy}
            style={{
              fontSize: '0.72rem', border: 'none', background: 'none', color: '#7c3aed',
              cursor: busy ? 'not-allowed' : 'pointer', textDecoration: 'underline', padding: 0,
            }}
          >
            {name ? 'Go back to this one' : 'Go back to the original'}
          </button>
        )}
      </div>
      {role && (
        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{role}</div>
      )}
      {madeOn && (
        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{madeOn}</div>
      )}
      {drift && (
        <div style={{ fontSize: '0.72rem', color: '#92400e' }}>
          ⚠️ The original changed since you made this — worth a look
        </div>
      )}
    </div>
  );
}

interface CardRolodexProps {
  space: CatalogSpace;
  cards: SpaceCard[];
  warningsByCopy: Map<string, ValidationIssue[]>;
  busy: boolean;
  onSelect: (copyId: string | null) => void;
}

/**
 * The original and yours, side by side, with a way to switch.
 *
 * Two chips, normally — a save edits your card rather than making another, so
 * nothing accumulates here and there is nothing to fold away. A classroom
 * saved while that WAS the behaviour can still hold several; those are all
 * shown, newest first, each with the date it was made.
 */
function CardRolodex({ space, cards, warningsByCopy, busy, onSelect }: CardRolodexProps): JSX.Element {
  const playingId = space.copyId;
  const ordered = useMemo(() => [...cards].sort(newestFirst), [cards]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
      <RolodexChip
        name={null}
        role={undefined}
        madeOn={null}
        isPlaying={!playingId}
        drift={false}
        busy={busy}
        onUse={() => onSelect(null)}
      />
      {ordered.map(({ id, copy }) => (
        <RolodexChip
          key={id}
          name={YOUR_VERSION}
          role={copy.role}
          madeOn={madeOnLabel(copy.createdAt)}
          isPlaying={playingId === id}
          drift={cardHasDrift(warningsByCopy.get(id))}
          busy={busy}
          onUse={() => onSelect(id)}
        />
      ))}
    </div>
  );
}

const TIER_LABEL: Record<string, string> = {
  structural: 'core space — the game needs an entrance, exit, and hubs',
  semantic: 'a game mechanic depends on this space',
  'path-choice': 'players make a remembered path choice through this space',
};

interface SpaceDeckPanelProps {
  /** Which classroom's deck this is. */
  instanceId: string;
  /**
   * Browsing: the space currently shown beside the deck. Passing this (even
   * as null) makes each space in the deck pickable. Leave it out and the deck
   * behaves exactly as it always has — a list you act on, with nothing
   * "selected".
   */
  selectedSpaceName?: string | null;
  onSelectSpace?: (space: CatalogSpace) => void;
  /**
   * Fires every time the deck is (re)read from the server, so a screen beside
   * it can keep its own facts about the space you are looking at in step.
   */
  onDeckLoaded?: (catalog: CatalogResponse | null) => void;
  /**
   * Change this to make the deck read itself again. The deck already refreshes
   * after its own changes; this is for changes made SOMEWHERE ELSE — a save in
   * the editor mints a new version of a space, and the deck has to hear about
   * it or it will keep saying the space has only the original.
   */
  reloadToken?: number;
}

export function SpaceDeckPanel({
  instanceId,
  selectedSpaceName,
  onSelectSpace,
  onDeckLoaded,
  reloadToken = 0,
}: SpaceDeckPanelProps): JSX.Element {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ space: CatalogSpace; report: ValidationReport } | null>(null);
  // Phase 4a: authoring a space. null = closed; { existing: null } = new;
  // { existing } = editing an authored space.
  const [insertionEdit, setInsertionEdit] = useState<{ existing: Insertion | null } | null>(null);

  const reload = useCallback(async () => {
    try {
      setCatalog(await fetchCatalog(instanceId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the catalog.');
    }
  }, [instanceId]);

  useEffect(() => { void reload(); }, [reload, reloadToken]);

  // Tell the screen around us whenever the deck changes, so the space it is
  // showing on the right stays true to what the deck now says.
  useEffect(() => { onDeckLoaded?.(catalog); }, [catalog, onDeckLoaded]);

  const phases = useMemo(() => {
    const groups: Array<{ phase: string; spaces: CatalogSpace[] }> = [];
    for (const space of catalog?.spaces ?? []) {
      const last = groups[groups.length - 1];
      if (last && last.phase === space.phase) last.spaces.push(space);
      else groups.push({ phase: space.phase, spaces: [space] });
    }
    return groups;
  }, [catalog]);

  const activeSpaces = useMemo(
    () => (catalog?.spaces ?? []).filter(s => s.used).map(s => s.name),
    [catalog]
  );

  const finishMutation = async (result: { success: boolean; report?: ValidationReport; error?: string; detail?: string }, successNotice: string) => {
    if (result.success) {
      setNotice(successNotice);
      await reload();
      return true;
    }
    const detail = result.report?.errors?.map(e => e.message).join(' · ')
      ?? result.detail ?? result.error ?? 'The server rejected the change.';
    setNotice(`⚠️ ${detail}`);
    return false;
  };

  const handleToggle = async (space: CatalogSpace) => {
    setBusy(true);
    setNotice(null);
    try {
      if (!space.used) {
        // Switching back ON needs no confirmation — nothing can break.
        const result = await postBoardChange(instanceId, { space: space.name, used: true });
        await finishMutation(result, `“${space.title}” is back on the board.`);
        return;
      }
      // Hybrid confirm: dry-run first, show the preview, then save.
      const preview = await postBoardChange(instanceId, { space: space.name, used: false, dryRun: true });
      if (preview.success && preview.report) {
        setConfirm({ space, report: preview.report });
      } else {
        await finishMutation(preview, '');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmOff = async (detour: string) => {
    if (!confirm) return;
    setBusy(true);
    try {
      const result = await postBoardChange(instanceId, { space: confirm.space.name, used: false, detour });
      const ok = await finishMutation(result, `“${confirm.space.title}” switched off — players go to ${detour} instead.`);
      if (ok) setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  // The picker: switch a space to play a different card it already has, or
  // `null` for the original. Never creates, edits, or removes a card.
  const handleSelectCard = async (space: CatalogSpace, copyId: string | null) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await selectCard(instanceId, { slot: space.name, copyId });
      await finishMutation(
        result,
        copyId ? `“${space.title}” now plays that copy.` : `“${space.title}” plays the original again.`
      );
    } finally {
      setBusy(false);
    }
  };

  const nameToTitle = useCallback(
    (name: string) => catalog?.spaces.find(s => s.name === name)?.title || name,
    [catalog]
  );

  const insertions = useMemo(() => Object.values(catalog?.insertions ?? {}), [catalog]);

  const handleSaveInsertion = async (draft: InsertionDraft) => {
    if (!insertionEdit) return;
    setBusy(true);
    setNotice(null);
    try {
      const existing = insertionEdit.existing;
      const result = existing
        ? await updateInsertion(instanceId, existing.id, {
            displayName: draft.displayName, story: draft.story, time: draft.time, fee: draft.fee,
            feePercent: draft.feePercent ?? null,
            feeBasis: draft.feeBasis ?? 'loans',
            cardDraw: draft.cardDraw ?? null,
            diceOutcomes: draft.diceOutcomes ?? null,
          })
        : await createInsertion(instanceId, draft);
      const ok = await finishMutation(
        result,
        existing
          ? `“${draft.displayName}” updated and live for new games.`
          : `“${draft.displayName}” added between ${nameToTitle(draft.from)} and ${nameToTitle(draft.to)}.`
      );
      if (ok) setInsertionEdit(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteInsertion = async () => {
    if (!insertionEdit?.existing) return;
    setBusy(true);
    try {
      const result = await deleteInsertion(instanceId, insertionEdit.existing.id);
      const ok = await finishMutation(result, `“${insertionEdit.existing.displayName}” removed — the path closes back up.`);
      if (ok) setInsertionEdit(null);
    } finally {
      setBusy(false);
    }
  };

  // Warnings split by whether they're about one specific card (Card Library
  // stage 2: attach those to the card they concern, in its rolodex chip)
  // or about the classroom generally (those stay in this page-level banner).
  const pageWarnings = (catalog?.validation?.warnings ?? []).filter(w => !w.copyId);
  const cardWarningsByCopy = warningsByCard(catalog);


  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 1.25rem' }}>
        {notice && (
          <div style={{
            marginBottom: '0.75rem', padding: '0.55rem 0.8rem', borderRadius: 8, fontSize: '0.85rem',
            background: notice.startsWith('⚠️') ? '#fef2f2' : '#ecfdf5',
            border: `1px solid ${notice.startsWith('⚠️') ? '#fecaca' : '#a7f3d0'}`,
            color: notice.startsWith('⚠️') ? '#991b1b' : '#065f46',
          }}>
            {notice}
          </div>
        )}
        {pageWarnings.length > 0 && (
          <div style={{
            marginBottom: '0.75rem', padding: '0.55rem 0.8rem', borderRadius: 8, fontSize: '0.82rem',
            background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
          }}>
            {pageWarnings.map((w, i) => <div key={i}>💡 {w.message}</div>)}
          </div>
        )}

        {loadError && (
          <p style={{ color: '#991b1b', fontSize: '0.9rem' }}>
            ⚠️ {loadError}
          </p>
        )}
        {!catalog && !loadError && (
          <p style={{ color: colors.text.secondary, fontSize: '0.95rem' }}>⏳ Loading your deck…</p>
        )}

        {/* Nothing in the deck LOOKED clickable: the space name was a button
            with no border, no background and no padding, so the eye read it as
            a label and the maintainer could not find how to pick a space at
            all. These rules give a pickable row a pointer, a hover lift and a
            chevron, so the affordance is visible rather than merely present. */}
        <style>{`
          .us-deck-pick { cursor: pointer; transition: background 120ms ease, border-color 120ms ease; }
          .us-deck-pick:hover { background: #f8f5ff !important; border-color: #c4b5fd !important; }
          .us-deck-pick:hover .us-deck-title { text-decoration: underline; }
          .us-deck-pick:hover .us-deck-chev { transform: translateX(2px); color: #7c3aed; }
          .us-deck-chev { transition: transform 120ms ease, color 120ms ease; }
        `}</style>

        {phases.map(group => (
          <section key={group.phase} style={{ marginBottom: '1.1rem' }}>
            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', margin: '0 0 0.4rem' }}>
              {group.phase || 'Other'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {group.spaces.map(space => {
                const cards = cardsForSpace(catalog, space.name);
                const isLookingAt = !!onSelectSpace && selectedSpaceName === space.name;
                // The name block is what you press to look at a space. It is
                // only a button when there is somewhere for the space to be
                // shown — otherwise the deck stays the plain list it was.
                const nameBlock = (
                  <div className="us-deck-title" style={{ fontSize: '0.92rem', fontWeight: 600, color: colors.text.primary }}>
                    {onSelectSpace && (
                      <span className="us-deck-chev" aria-hidden="true" style={{ display: 'inline-block', color: '#a78bfa', marginRight: '0.35rem' }}>›</span>
                    )}
                    {/* Who does the talking, ahead of what they say —
                        "Architect · Let's talk about my fee". The internal id
                        used to sit under the title; it answered the wrong
                        question, and ten spaces share a short name so the
                        title alone could not tell them apart either. */}
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>{speakerFor(space.name)}</span>
                    <span style={{ color: '#c4b5fd', margin: '0 0.35rem' }} aria-hidden="true">·</span>
                    {space.title}
                    {!space.used && space.detour && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.74rem', color: '#6b7280' }}>
                        off — players go to {space.detour}
                      </span>
                    )}
                  </div>
                );
                return (
                <div
                  key={space.name}
                  className={onSelectSpace ? 'us-deck-pick' : undefined}
                  onClick={onSelectSpace ? (e) => {
                    // Anything genuinely interactive inside the row keeps its
                    // own job — only bare space in the row selects.
                    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
                    onSelectSpace(space);
                  } : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: isLookingAt ? '#faf5ff' : space.used ? '#fff' : '#f1f3f5',
                    border: `1px solid ${isLookingAt ? '#a78bfa' : '#e9ecef'}`,
                    borderRadius: 10, padding: '0.55rem 0.9rem',
                    opacity: space.used ? 1 : 0.8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {onSelectSpace ? (
                      <button
                        type="button"
                        onClick={() => onSelectSpace(space)}
                        aria-pressed={isLookingAt}
                        aria-label={`Look at ${space.title}`}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                        }}
                      >
                        {nameBlock}
                      </button>
                    ) : nameBlock}
                    {space.protection && (
                      // fb:a5d4ae45 — say WHY a space is locked, inline, not
                      // only in the chip's hover tooltip (invisible on touch).
                      <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.15rem' }}>
                        🔒 Always on — {TIER_LABEL[space.protection.tier] ?? space.protection.reason}
                      </div>
                    )}
                    {cards.length > 0 && (
                      // The original and yours, with a way to switch between
                      // them. Only shown once this space HAS a version of
                      // yours — until then there is nothing to choose.
                      <CardRolodex
                        space={space}
                        cards={cards}
                        warningsByCopy={cardWarningsByCopy}
                        busy={busy}
                        onSelect={copyId => void handleSelectCard(space, copyId)}
                      />
                    )}
                  </div>

                  {space.protection ? (
                    <span
                      title={TIER_LABEL[space.protection.tier] ?? space.protection.reason}
                      style={{
                        fontSize: '0.74rem', color: '#6b7280', border: '1px dashed #d1d5db',
                        borderRadius: 8, padding: '0.3rem 0.6rem', whiteSpace: 'nowrap',
                      }}
                    >
                      🔒 always on
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleToggle(space)}
                      disabled={busy}
                      aria-label={space.used ? `Switch off ${space.title}` : `Switch on ${space.title}`}
                      style={{
                        padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600,
                        border: 'none', cursor: busy ? 'wait' : 'pointer',
                        background: space.used ? '#fee2e2' : '#d1fae5',
                        color: space.used ? '#b91c1c' : '#065f46',
                      }}
                    >
                      {space.used ? 'Switch off' : 'Switch on'}
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          </section>
        ))}

        {catalog && (
          <section style={{ marginBottom: '1.1rem' }}>
            <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', margin: '1rem 0 0.4rem' }}>
              Your own spaces
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0 0 0.5rem' }}>
              Add a brand-new step to the path — a beat that isn’t in the standard deck.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {insertions.map(ins => (
                <div
                  key={ins.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: '#fff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '0.55rem 0.9rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: colors.text.primary }}>
                      {ins.displayName}
                      <span style={{
                        marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                        background: '#ede9fe', color: '#6d28d9', borderRadius: 999, padding: '0.1rem 0.5rem',
                      }}>
                        your space
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                      between {nameToTitle(ins.from)} and {nameToTitle(ins.to)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInsertionEdit({ existing: ins })}
                    disabled={busy}
                    style={{
                      padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.8rem',
                      border: '1px solid #ddd6fe', background: '#fff', color: '#6d28d9',
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ✏️ Edit
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setInsertionEdit({ existing: null })}
                disabled={busy || (catalog.edges?.length ?? 0) === 0}
                style={{
                  alignSelf: 'flex-start', padding: '0.45rem 0.9rem', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                  border: '1px dashed #a78bfa', background: '#faf5ff', color: '#6d28d9',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                ➕ Add a space
              </button>
            </div>
          </section>
        )}
      </div>


      {confirm && (
        <SwitchOffConfirm
          space={confirm.space}
          report={confirm.report}
          activeSpaces={activeSpaces}
          busy={busy}
          onConfirm={detour => void handleConfirmOff(detour)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {insertionEdit && catalog && (
        <InsertionEditor
          existing={insertionEdit.existing}
          edges={catalog.edges ?? []}
          destinations={(catalog.spaces ?? []).filter(s => s.used).map(s => ({ name: s.name, title: s.title }))}
          nameToTitle={nameToTitle}
          busy={busy}
          onSave={draft => void handleSaveInsertion(draft)}
          onDelete={insertionEdit.existing ? () => void handleDeleteInsertion() : undefined}
          onCancel={() => setInsertionEdit(null)}
        />
      )}
    </>
  );
}
