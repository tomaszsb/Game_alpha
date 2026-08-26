// src/components/classroom/ClassroomSetup.tsx
//
// Teacher instance layer, Phase 2 — the Classroom Setup screen, behind a
// teacher's classroom sign-in (TeacherClassroomPanel).
//
// The deck itself, and every decision you make between spaces, now lives in
// SpaceDeckPanel — the same panel the admin's merged screen puts beside the
// player view (CARD_LIBRARY_DESIGN.md, "Stage 3's screen"). This file is the
// full-screen chrome around it: the title, the explanation, and the way out.

import React, { useEffect, useRef, useState } from 'react';
import { SpaceDeckPanel } from './SpaceDeckPanel';
import { SpaceEditor, SAFE_FIELD_SUBSET } from '../editor/SpaceEditor';
import { useEditorSource, type SaveStatus } from '../editor/useEditorSource';
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

export function ClassroomSetup({ onClose, instanceId = 'classroom-1', classroomName }: ClassroomSetupProps): JSX.Element {
  const [selectedSpace, setSelectedSpace] = useState<string | null>(null);
  // Bumped after a save so the deck re-reads: a save mints or updates a card,
  // and the deck's version count for that space is stale until it hears.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '0.75rem', padding: '0 0.75rem 0.75rem' }}>
        <div style={{ flex: '0 0 320px', minWidth: 0, overflowY: 'auto' }}>
          <SpaceDeckPanel
            instanceId={instanceId}
            selectedSpaceName={selectedSpace}
            onSelectSpace={(space) => setSelectedSpace(space.name)}
            reloadToken={reloadToken}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <TeacherSpaceWording
            instanceId={instanceId}
            selectedSpace={selectedSpace}
            onSaved={() => setReloadToken(t => t + 1)}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * What a teacher may change about a space: its words, its time, its fee.
 *
 * This is the way back in that v3.2.29 took away — CopyEditor was a teacher's
 * only editor, and removing it left the one save route admin-only (the
 * regression recorded in TODO.md, fixed server-side in v3.2.41).
 *
 * `SAFE_FIELD_SUBSET` is what the teacher SEES. It is not what makes the edit
 * safe: the server rebuilds every row from the classroom's own board and takes
 * only the wording columns from the payload, so structure cannot ride in even
 * from a client that has been tampered with. Showing the same six fields here
 * simply means the screen does not offer what the save would silently drop.
 */
function TeacherSpaceWording({ instanceId, selectedSpace, onSaved }: {
  instanceId: string;
  selectedSpace: string | null;
  onSaved: () => void;
}): JSX.Element {
  const editor = useEditorSource(selectedSpace, 0, { instanceId, auth: 'teacher' });
  const [visitType, setVisitType] = useState<'First' | 'Subsequent'>('First');
  const savedRef = useRef<SaveStatus | null>(null);

  useEffect(() => {
    // Tell the deck to re-read only when a save actually succeeded — a card
    // has been minted or updated and its version count is now stale.
    if (editor.saveStatus?.type === 'success' && editor.saveStatus !== savedRef.current) {
      savedRef.current = editor.saveStatus;
      onSaved();
    }
  }, [editor.saveStatus, onSaved]);

  if (!selectedSpace) {
    return (
      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: colors.text.secondary, fontSize: '0.9rem' }}>
        Pick a space from your deck to change what it says.
      </div>
    );
  }
  if (editor.isLoading) {
    return <div style={{ padding: '1rem', color: colors.text.secondary, fontSize: '0.9rem' }}>Loading…</div>;
  }
  if (editor.error) {
    return <div style={{ padding: '1rem', color: colors.danger.main, fontSize: '0.9rem' }}>{editor.error}</div>;
  }
  const displayLabelOverride =
    (editor.spaceFirst?._extraColumns?.display_label_override
      ?? editor.spaceSubsequent?._extraColumns?.display_label_override
      ?? '');

  if (!editor.spaceFirst && !editor.spaceSubsequent) {
    // A switched-off space has no row in the baked board at all — there is
    // nothing to read, so say so rather than showing an empty form.
    return (
      <div style={{ padding: '1rem', color: colors.text.secondary, fontSize: '0.9rem' }}>
        This space is switched off in your classroom, so there is nothing to edit.
      </div>
    );
  }

  return (
    <div>
      <SpaceEditor
        spaceFirst={editor.spaceFirst}
        spaceSubsequent={editor.spaceSubsequent}
        visitType={visitType}
        allSpaceNames={editor.allSpaceNames}
        diceRollData={editor.diceRollData}
        modalConfigData={editor.modalConfigData}
        visibleFields={SAFE_FIELD_SUBSET}
        displayLabelOverride={displayLabelOverride}
        onVisitTypeChange={setVisitType}
        onFieldChange={editor.handleFieldChange}
        onDisplayLabelChange={editor.handleDisplayLabelChange}
        onUpdateDiceRoll={editor.handleDiceRollUpdate}
        onAddDiceRoll={editor.handleAddDiceRoll}
        onDeleteDiceRoll={editor.handleDeleteDiceRoll}
        onModalConfigChange={editor.handleModalConfigChange}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0' }}>
        <button
          type="button"
          onClick={() => void editor.handleSave()}
          disabled={!editor.hasUnsavedChanges || editor.isSaving}
          style={{
            padding: '0.5rem 1.1rem',
            background: editor.hasUnsavedChanges ? colors.primary.main : '#e9ecef',
            color: editor.hasUnsavedChanges ? '#fff' : '#868e96',
            border: 'none', borderRadius: 6, fontSize: '0.9rem',
            cursor: editor.hasUnsavedChanges && !editor.isSaving ? 'pointer' : 'default',
          }}
        >
          {editor.isSaving ? 'Saving…' : 'Save my wording'}
        </button>
        {editor.saveStatus && (
          <span style={{
            fontSize: '0.85rem',
            color: editor.saveStatus.type === 'success' ? colors.success.main : colors.danger.main,
          }}>
            {editor.saveStatus.message}
          </span>
        )}
      </div>
    </div>
  );
}
