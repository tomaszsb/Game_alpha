// src/components/classroom/SwitchOffConfirm.tsx
//
// The hybrid confirm flow (spec decision 6): switching a space off shows
// the before/after path with the computed pass-through pre-filled, and the
// teacher can confirm it or pick a different detour before anything saves.

import React, { useState } from 'react';
import type { CatalogSpace, ValidationReport } from './classroomApi';

interface SwitchOffConfirmProps {
  space: CatalogSpace;
  /** dryRun report for this switch-off (suggestions + any errors). */
  report: ValidationReport;
  /** Names of all currently-in-play spaces (detour override choices). */
  activeSpaces: string[];
  busy: boolean;
  onConfirm: (detour: string) => void;
  onCancel: () => void;
}

export function SwitchOffConfirm({
  space, report, activeSpaces, busy, onConfirm, onCancel,
}: SwitchOffConfirmProps): JSX.Element {
  const suggestion = report.suggestions[space.name];
  const suggested = suggestion?.target ?? report.detours[space.name] ?? null;
  const candidates = suggestion?.candidates ?? [];
  const [choice, setChoice] = useState<string>(suggested ?? '');

  // Errors other than "you must choose" (which this dialog exists to solve).
  const blockingErrors = report.errors.filter(
    e => !(e.code === 'DETOUR_AMBIGUOUS' && e.space === space.name)
  );
  const others = activeSpaces.filter(n => n !== space.name && !candidates.includes(n));

  return (
    <div
      role="dialog"
      aria-label={`Switch off ${space.title}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem',
        width: 'min(480px, 92vw)', boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
          Switch off “{space.title}”?
        </h3>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', color: '#495057' }}>
          This space leaves the board for all <strong>new</strong> games.
          Games already running keep the board they started with.
        </p>

        {blockingErrors.length > 0 ? (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '0.6rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#991b1b',
          }}>
            {blockingErrors.map((e, i) => <div key={i}>{e.message}</div>)}
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Players who would land here go to:
            </label>
            <select
              value={choice}
              onChange={e => setChoice(e.target.value)}
              style={{
                width: '100%', padding: '0.5rem', borderRadius: 8,
                border: '1px solid #ced4da', fontSize: '0.9rem', marginBottom: '0.5rem',
              }}
            >
              {!choice && <option value="">— choose a destination —</option>}
              {candidates.length > 0 && (
                <optgroup label="Where this space normally leads">
                  {candidates.map(n => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              )}
              <optgroup label="Other spaces in play">
                {others.map(n => <option key={n} value={n}>{n}</option>)}
              </optgroup>
            </select>
            {choice && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#0a6e46' }}>
                Path preview: <strong>{space.name}</strong> → <strong>{choice}</strong>
              </p>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #dee2e6',
              background: '#f8f9fa', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => choice && onConfirm(choice)}
            disabled={busy || !choice || blockingErrors.length > 0}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
              background: (!choice || blockingErrors.length > 0) ? '#adb5bd' : '#c2410c',
              color: '#fff', cursor: (!choice || blockingErrors.length > 0) ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            {busy ? 'Saving…' : 'Switch off'}
          </button>
        </div>
      </div>
    </div>
  );
}
