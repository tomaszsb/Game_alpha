// src/components/classroom/CopyEditor.tsx
//
// Teacher copy editor (spec: safe field subset; per-field "differs from
// stock" highlighting with one-click revert; full copies stored
// underneath). Creating a copy never touches the stock card — deleting
// the copy brings the original straight back.

import React, { useState } from 'react';
import type { CatalogSpace, TeacherCopy } from './classroomApi';

const MULTILINE_FIELDS = new Set(['Event', 'Action', 'Outcome']);

interface CopyEditorProps {
  space: CatalogSpace;
  /** Existing copy when editing; null when creating a fresh one. */
  copy: TeacherCopy | null;
  editableFields: string[];
  busy: boolean;
  onSave: (overrides: Record<string, Record<string, string>>, role: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function CopyEditor({
  space, copy, editableFields, busy, onSave, onDelete, onCancel,
}: CopyEditorProps): JSX.Element {
  const visitTypes = Object.keys(space.stock);

  const [values, setValues] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    for (const vt of visitTypes) {
      initial[vt] = {};
      for (const field of editableFields) {
        initial[vt][field] = copy?.rows?.[vt]?.[field] ?? space.stock[vt]?.[field] ?? '';
      }
    }
    return initial;
  });
  // A short note on what this copy is FOR (CARD_LIBRARY_DESIGN.md stage 2,
  // "Role field") — what makes several near-identical copies of the same
  // space tellable apart later. Purely descriptive; never read by the game.
  const [role, setRole] = useState(copy?.role ?? '');

  const setField = (vt: string, field: string, value: string) =>
    setValues(prev => ({ ...prev, [vt]: { ...prev[vt], [field]: value } }));

  const handleSave = () => {
    const overrides: Record<string, Record<string, string>> = {};
    for (const vt of visitTypes) {
      overrides[vt] = { ...values[vt] };
    }
    onSave(overrides, role);
  };

  return (
    <div
      role="dialog"
      aria-label={`Customize ${space.title}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1.25rem 1.5rem',
        width: 'min(640px, 94vw)', maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>
          {copy ? 'Edit your copy of' : 'Make your copy of'} “{space.title}”
        </h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#495057' }}>
          Your classroom plays your copy; the original card stays safe in the
          library and updates from new versions of the game won’t change your
          words. Fields that differ from the original are highlighted.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            Note to yourself (optional)
          </label>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="e.g. Shorter version for a 45-minute period"
            style={{
              width: '100%', padding: '0.45rem 0.6rem', borderRadius: 8, fontSize: '0.88rem',
              border: '1px solid #ced4da', boxSizing: 'border-box',
            }}
          />
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.2rem' }}>
            Helps you tell copies of the same space apart later. Only you see this.
          </div>
        </div>

        {visitTypes.map(vt => (
          <fieldset
            key={vt}
            style={{ border: '1px solid #e9ecef', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}
          >
            <legend style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0 0.4rem' }}>
              {vt === 'First' ? 'First visit' : vt === 'Subsequent' ? 'Return visits' : vt}
            </legend>
            {editableFields.map(field => {
              const stockValue = space.stock[vt]?.[field] ?? '';
              const value = values[vt]?.[field] ?? '';
              const differs = value !== stockValue;
              const inputStyle: React.CSSProperties = {
                width: '100%', padding: '0.45rem 0.6rem', borderRadius: 8, fontSize: '0.88rem',
                border: differs ? '2px solid #7c3aed' : '1px solid #ced4da',
                background: differs ? '#faf5ff' : '#fff',
                boxSizing: 'border-box',
              };
              return (
                <div key={field} style={{ marginBottom: '0.7rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>{field}</label>
                    {differs && (
                      <button
                        type="button"
                        onClick={() => setField(vt, field, stockValue)}
                        style={{
                          fontSize: '0.72rem', color: '#7c3aed', background: 'none',
                          border: 'none', cursor: 'pointer', textDecoration: 'underline',
                        }}
                      >
                        ↩ revert to original
                      </button>
                    )}
                  </div>
                  {MULTILINE_FIELDS.has(field) ? (
                    <textarea
                      value={value}
                      onChange={e => setField(vt, field, e.target.value)}
                      rows={2}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={e => setField(vt, field, e.target.value)}
                      style={inputStyle}
                    />
                  )}
                  {differs && stockValue && (
                    <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '0.15rem' }}>
                      Original: {stockValue.length > 120 ? `${stockValue.slice(0, 120)}…` : stockValue}
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem' }}>
          {copy ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              style={{
                padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #fecaca',
                background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: '0.85rem',
              }}
              title="Stops playing this copy — the original plays instead. Your copy stays saved, so you can use it again later."
            >
              ↩ Back to the original
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: '0.6rem' }}>
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
              onClick={handleSave}
              disabled={busy}
              style={{
                padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
                background: '#7c3aed', color: '#fff', cursor: 'pointer',
                fontSize: '0.9rem', fontWeight: 600,
              }}
            >
              {busy ? 'Saving…' : copy ? 'Save changes' : 'Create my copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
