// src/components/classroom/ClassroomSetup.tsx
//
// Teacher instance layer, Phase 2 — the Classroom Setup screen, behind a
// teacher's classroom sign-in (TeacherClassroomPanel).
//
// The deck itself, and every decision you make between spaces, now lives in
// SpaceDeckPanel — the same panel the admin's merged screen puts beside the
// player view (CARD_LIBRARY_DESIGN.md, "Stage 3's screen"). This file is the
// full-screen chrome around it: the title, the explanation, and the way out.

import React, { useEffect } from 'react';
import { SpaceDeckPanel } from './SpaceDeckPanel';
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

      <SpaceDeckPanel instanceId={instanceId} />
    </div>
  );
}
