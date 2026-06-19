// src/components/classroom/ClassroomSetup.tsx
//
// Teacher instance layer, Phase 2 — the Classroom Setup screen (the
// "separate teacher screen" option the maintainer chose 2026-06-12).
//
// Browse the full stock deck (including switched-off spaces — served by
// GET /api/instances/:id/catalog, NOT /data, which only carries the
// resolved board), switch spaces on/off through the hybrid confirm flow,
// and make/edit teacher copies. Every change validates server-side and
// rebakes the board for all future games; running games are untouched.
//
// Full-screen overlay launched from the lobby's Admin Tools, mirroring
// BoardLayoutEditor. Phase 3 turns this into the teacher-facing screen
// behind classroom sign-in.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchCatalog, postBoardChange, createCopy, updateCopy, deleteCopy,
  createInsertion, updateInsertion, deleteInsertion,
  type CatalogResponse, type CatalogSpace, type ValidationReport, type Insertion,
} from './classroomApi';
import { SwitchOffConfirm } from './SwitchOffConfirm';
import { CopyEditor } from './CopyEditor';
import { InsertionEditor, type InsertionDraft } from './InsertionEditor';
import { colors } from '../../styles/theme';

interface ClassroomSetupProps {
  onClose: () => void;
  /** Which classroom to edit. Defaults to the public default classroom so
   *  the existing admin-launched flow is unchanged; a teacher opens it with
   *  their own classroom id. */
  instanceId?: string;
  /** Display name shown in the header (the teacher's classroom name). */
  classroomName?: string;
}

const TIER_LABEL: Record<string, string> = {
  structural: 'core space — the game needs an entrance, exit, and hubs',
  semantic: 'a game mechanic depends on this space',
  'path-choice': 'players make a remembered path choice through this space',
};

export function ClassroomSetup({ onClose, instanceId = 'classroom-1', classroomName }: ClassroomSetupProps): JSX.Element {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ space: CatalogSpace; report: ValidationReport } | null>(null);
  const [editing, setEditing] = useState<CatalogSpace | null>(null);
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

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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

  const handleSaveCopy = async (overrides: Record<string, Record<string, string>>) => {
    if (!editing) return;
    setBusy(true);
    try {
      const result = editing.copyId
        ? await updateCopy(instanceId, editing.copyId, overrides)
        : await createCopy(instanceId, { slot: editing.name, overrides });
      const ok = await finishMutation(result, `Your copy of “${editing.title}” is saved and live for new games.`);
      if (ok) setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCopy = async () => {
    if (!editing?.copyId) return;
    setBusy(true);
    try {
      const result = await deleteCopy(instanceId, editing.copyId);
      const ok = await finishMutation(result, `Your copy was removed — “${editing.title}” plays the original card again.`);
      if (ok) setEditing(null);
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
            cardDraw: draft.cardDraw ?? null,
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

  const warnings = catalog?.validation?.warnings ?? [];

  return (
    <div
      role="dialog"
      aria-label="Classroom Setup"
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#f8f9fa', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{
        padding: '0.75rem 1.25rem', background: '#fff', borderBottom: '1px solid #dee2e6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: colors.text.primary }}>
            🏫 Classroom Setup{classroomName ? ` — ${classroomName}` : ''}
          </h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: colors.text.secondary }}>
            Your deck of spaces. Switch cards off, or make your own copy of a
            card — the originals always stay in the library. Changes apply to
            new games only.
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
        {warnings.length > 0 && (
          <div style={{
            marginBottom: '0.75rem', padding: '0.55rem 0.8rem', borderRadius: 8, fontSize: '0.82rem',
            background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
          }}>
            {warnings.map((w, i) => <div key={i}>💡 {w.message}</div>)}
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
              {group.spaces.map(space => (
                <div
                  key={space.name}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    background: space.used ? '#fff' : '#f1f3f5',
                    border: '1px solid #e9ecef', borderRadius: 10, padding: '0.55rem 0.9rem',
                    opacity: space.used ? 1 : 0.8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: colors.text.primary }}>
                      {space.title}
                      {space.copyId && (
                        <span style={{
                          marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700,
                          background: '#ede9fe', color: '#6d28d9', borderRadius: 999, padding: '0.1rem 0.5rem',
                        }}>
                          your copy
                        </span>
                      )}
                      {!space.used && space.detour && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.74rem', color: '#6b7280' }}>
                          off — players go to {space.detour}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{space.name}</div>
                    {space.protection && (
                      // fb:a5d4ae45 — say WHY a space is locked, inline, not
                      // only in the chip's hover tooltip (invisible on touch).
                      <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.15rem' }}>
                        🔒 Always on — {TIER_LABEL[space.protection.tier] ?? space.protection.reason}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing(space)}
                    disabled={busy || !space.used}
                    style={{
                      padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.8rem',
                      border: '1px solid #ddd6fe', background: '#fff', color: '#6d28d9',
                      cursor: busy || !space.used ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {space.copyId ? '✏️ Edit my copy' : '✏️ Customize'}
                  </button>

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
              ))}
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
          space={editing}
          copy={editing.copyId ? catalog.copies[editing.copyId] ?? null : null}
          editableFields={catalog.editableFields}
          busy={busy}
          onSave={overrides => void handleSaveCopy(overrides)}
          onDelete={() => void handleDeleteCopy()}
          onCancel={() => setEditing(null)}
        />
      )}
      {insertionEdit && catalog && (
        <InsertionEditor
          existing={insertionEdit.existing}
          edges={catalog.edges ?? []}
          nameToTitle={nameToTitle}
          busy={busy}
          onSave={draft => void handleSaveInsertion(draft)}
          onDelete={insertionEdit.existing ? () => void handleDeleteInsertion() : undefined}
          onCancel={() => setInsertionEdit(null)}
        />
      )}
    </div>
  );
}
