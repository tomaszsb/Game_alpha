// src/components/classroom/SpaceDeckPanel.tsx
//
// Your deck of spaces — the left-hand column, and everything you can decide
// BETWEEN spaces: switching one off (with its detour confirm), picking which
// version of a space plays, making a copy, and adding a space of your own.
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
  fetchCatalog, postBoardChange, createCopy, updateCopy, unselectCopy, selectCard,
  createInsertion, updateInsertion, deleteInsertion,
  type CatalogResponse, type CatalogSpace, type ValidationReport, type ValidationIssue,
  type Insertion, type TeacherCopy, type CardOwner,
} from './classroomApi';
import { SwitchOffConfirm } from './SwitchOffConfirm';
import { CopyEditor } from './CopyEditor';
import { InsertionEditor, type InsertionDraft } from './InsertionEditor';
import { colors } from '../../styles/theme';

// The rolodex (CARD_LIBRARY_DESIGN.md "the model"): every copy visible for a
// space, alongside the original. Plain-language tier words — "tier" itself
// never appears in the UI. `official`/`group` are shown for completeness
// (a maintainer using the content editor already mints `official` copies),
// even though only `individual` is reachable from this screen today.
const TIER_WORD: Record<CardOwner['tier'], string> = {
  official: 'Official',
  group: 'Shared',
  individual: 'Your copy',
};

/** One space's cards, beyond the original: every teacherCopy whose slot matches. */
function cardsForSpace(catalog: CatalogResponse | null, spaceName: string): Array<{ id: string; copy: TeacherCopy }> {
  if (!catalog) return [];
  return Object.entries(catalog.copies)
    .filter(([, copy]) => copy.slot === spaceName)
    .map(([id, copy]) => ({ id, copy }));
}

/** True when a copy-keyed warning says the card's original moved since it was made. */
function cardHasDrift(warnings: ValidationIssue[] | undefined): boolean {
  return !!warnings?.some(w => w.code === 'COPY_STOCK_UPDATED' || w.code === 'COPY_SCHEMA_DRIFT');
}

/**
 * "Made 20 Aug" — when this version was saved.
 *
 * A space can hold several versions now that editing makes a new card instead
 * of writing over the old one, so each one needs to be tellable from the
 * others at a glance. The role note is a version's name; the date is how you
 * tell two unnamed ones apart. The year only appears when it isn't this one.
 */
function madeOnLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  const thisYear = when.getFullYear() === new Date().getFullYear();
  return `Made ${when.toLocaleDateString(undefined, thisYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Newest first — the order a rolodex of versions is read in. */
function newestFirst(a: { copy: TeacherCopy }, b: { copy: TeacherCopy }): number {
  return (b.copy.createdAt || '').localeCompare(a.copy.createdAt || '');
}

/**
 * How many versions stay on screen without asking. The original and whatever
 * is playing are always shown on top of these, so a space that has been
 * edited once or twice never hides anything.
 */
const VERSIONS_SHOWN_INLINE = 3;

interface RolodexChipProps {
  /** null for "the original" chip, which has no tier/role/edit affordance. */
  tierWord: string | null;
  role: string | undefined;
  /** "Made 20 Aug", or null for the original (which was never "made"). */
  madeOn: string | null;
  isPlaying: boolean;
  drift: boolean;
  busy: boolean;
  onUse: () => void;
  onEdit?: () => void;
}

function RolodexChip({ tierWord, role, madeOn, isPlaying, drift, busy, onUse, onEdit }: RolodexChipProps): JSX.Element {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.15rem',
      border: isPlaying ? '2px solid #7c3aed' : '1px solid #e9ecef',
      background: isPlaying ? '#faf5ff' : '#fff',
      borderRadius: 10, padding: '0.35rem 0.6rem', fontSize: '0.78rem', maxWidth: 260,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: isPlaying ? 700 : 500, color: isPlaying ? '#6d28d9' : '#495057' }}>
          {tierWord ?? 'The original'}
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
            {tierWord ? 'Go back to this one' : 'Go back to the original'}
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            // Names the VERSION, not just the space: several versions of one
            // card can be on screen at once, and the note plus the date is
            // what tells them apart out loud as well as on screen.
            aria-label={`Edit ${role || tierWord || 'this copy'}${madeOn ? `, ${madeOn.toLowerCase()}` : ''}`}
            style={{
              fontSize: '0.78rem', border: 'none', background: 'none', color: '#6b7280',
              cursor: busy ? 'not-allowed' : 'pointer', padding: 0,
            }}
          >
            ✏️
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
  cards: Array<{ id: string; copy: TeacherCopy }>;
  warningsByCopy: Map<string, ValidationIssue[]>;
  busy: boolean;
  onSelect: (copyId: string | null) => void;
  /** null means "start a brand-new copy". */
  onEdit: (copyId: string | null) => void;
}

function CardRolodex({ space, cards, warningsByCopy, busy, onSelect, onEdit }: CardRolodexProps): JSX.Element {
  const playingId = space.copyId;
  // Editing a space makes a new card rather than writing over the old one
  // (CARD_LIBRARY_DESIGN.md stage 2), so this list grows as the maintainer
  // works. Newest versions and whatever is playing stay on screen; the rest
  // fold away behind one plain-language line so a much-edited space doesn't
  // bury the space below it.
  const [showEarlier, setShowEarlier] = useState(false);
  const { recent, earlier } = useMemo(() => {
    const sorted = [...cards].sort(newestFirst);
    const shown: typeof sorted = [];
    const hidden: typeof sorted = [];
    for (const card of sorted) {
      if (shown.length < VERSIONS_SHOWN_INLINE || card.id === playingId) shown.push(card);
      else hidden.push(card);
    }
    return { recent: shown, earlier: hidden };
  }, [cards, playingId]);

  const chipFor = ({ id, copy }: { id: string; copy: TeacherCopy }): JSX.Element => (
    <RolodexChip
      key={id}
      tierWord={TIER_WORD[copy.owner?.tier ?? 'individual']}
      role={copy.role}
      madeOn={madeOnLabel(copy.createdAt)}
      isPlaying={playingId === id}
      drift={cardHasDrift(warningsByCopy.get(id))}
      busy={busy}
      onUse={() => onSelect(id)}
      onEdit={() => onEdit(id)}
    />
  );

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.4rem' }}>
      <RolodexChip
        tierWord={null}
        role={undefined}
        madeOn={null}
        isPlaying={!playingId}
        drift={false}
        busy={busy}
        onUse={() => onSelect(null)}
      />
      {recent.map(chipFor)}
      {showEarlier && earlier.map(chipFor)}
      {earlier.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEarlier(v => !v)}
          style={{
            alignSelf: 'flex-start', padding: '0.35rem 0.6rem', borderRadius: 10, fontSize: '0.78rem',
            border: '1px solid #e9ecef', background: '#fff', color: '#495057', cursor: 'pointer',
          }}
        >
          {showEarlier
            ? 'Hide earlier versions'
            : `Show earlier versions (${earlier.length})`}
        </button>
      )}
      <button
        type="button"
        onClick={() => onEdit(null)}
        disabled={busy || !space.used}
        title="Make another copy of this space"
        style={{
          alignSelf: 'flex-start', padding: '0.35rem 0.6rem', borderRadius: 10, fontSize: '0.78rem',
          border: '1px dashed #a78bfa', background: '#faf5ff', color: '#6d28d9',
          cursor: busy || !space.used ? 'not-allowed' : 'pointer',
        }}
      >
        ➕ Add a copy
      </button>
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
  // Which card's editor is open. copyId null = making a brand-new copy of
  // `space`; a copyId edits that specific card from the rolodex — NOT
  // necessarily the one currently playing (CARD_LIBRARY_DESIGN.md stage 2).
  const [editing, setEditing] = useState<{ space: CatalogSpace; copyId: string | null } | null>(null);
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

  const handleSaveCopy = async (overrides: Record<string, Record<string, string>>, role: string) => {
    if (!editing) return;
    setBusy(true);
    try {
      const result = editing.copyId
        ? await updateCopy(instanceId, editing.copyId, { overrides, role })
        : await createCopy(instanceId, { slot: editing.space.name, overrides, role });
      // Editing makes a NEW version and leaves the old one in the rolodex
      // (CARD_LIBRARY_DESIGN.md stage 2), so say so — a maintainer who
      // expects an overwrite should learn from this line that nothing was
      // lost. `branched: false` means the save changed nothing at all.
      const savedNotice = !editing.copyId
        ? `Your copy of “${editing.space.title}” is saved and live for new games.`
        : (result.success && result.branched === false)
          ? `Nothing changed in “${editing.space.title}”, so there's no new version.`
          : `Saved as a new version of “${editing.space.title}”. The one before it is still here if you want to go back.`;
      const ok = await finishMutation(result, savedNotice);
      if (ok) setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  // "Back to the original" from inside the editor — unselects the card being
  // edited (a no-op unless it happens to be the one currently playing; see
  // unselectCopy's own doc comment). The card itself is never removed from
  // the rolodex; switching between EXISTING cards is handleSelectCard below.
  const handleUnselectCopy = async () => {
    if (!editing?.copyId) return;
    setBusy(true);
    try {
      const result = await unselectCopy(instanceId, editing.copyId);
      const ok = await finishMutation(result, `“${editing.space.title}” plays the original again. Your copy is still here if you want it back.`);
      if (ok) setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  // The rolodex picker (CARD_LIBRARY_DESIGN.md stage 2): switch a space to
  // play a different existing card, or `null` for the original. Distinct
  // from handleUnselectCopy above — this can select ANY card, not just clear
  // the one currently playing.
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
  const allWarnings = catalog?.validation?.warnings ?? [];
  const pageWarnings = allWarnings.filter(w => !w.copyId);
  const cardWarningsByCopy = new Map<string, ValidationIssue[]>();
  for (const w of allWarnings) {
    if (!w.copyId) continue;
    const list = cardWarningsByCopy.get(w.copyId) ?? [];
    list.push(w);
    cardWarningsByCopy.set(w.copyId, list);
  }


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
                  <>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: colors.text.primary }}>
                      {space.title}
                      {!space.used && space.detour && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.74rem', color: '#6b7280' }}>
                          off — players go to {space.detour}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{space.name}</div>
                  </>
                );
                return (
                <div
                  key={space.name}
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
                      // The rolodex (CARD_LIBRARY_DESIGN.md stage 2): every
                      // copy available for this space, plus the original,
                      // each with a way to switch to it.
                      <CardRolodex
                        space={space}
                        cards={cards}
                        warningsByCopy={cardWarningsByCopy}
                        busy={busy}
                        onSelect={copyId => void handleSelectCard(space, copyId)}
                        onEdit={copyId => setEditing({ space, copyId })}
                      />
                    )}
                  </div>

                  {cards.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setEditing({ space, copyId: null })}
                      disabled={busy || !space.used}
                      style={{
                        padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.8rem',
                        border: '1px solid #ddd6fe', background: '#fff', color: '#6d28d9',
                        cursor: busy || !space.used ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✏️ Customize
                    </button>
                  )}

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
      {editing && catalog && (
        <CopyEditor
          space={editing.space}
          copy={editing.copyId ? catalog.copies[editing.copyId] ?? null : null}
          editableFields={catalog.editableFields}
          busy={busy}
          onSave={(overrides, role) => void handleSaveCopy(overrides, role)}
          onDelete={() => void handleUnselectCopy()}
          onCancel={() => setEditing(null)}
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
