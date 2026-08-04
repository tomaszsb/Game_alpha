// src/components/board/RestorablePillDropdown.tsx
//
// A pill button (matching BoardToggle's existing "N hidden/redirected ·
// restore" style) that, instead of restoring everything in one click,
// opens a small list so the admin can pick a SPECIFIC connector to
// restore (2026-08-04 — "restore lines restores all lines, I need to be
// able to pick which one gets restored"). "Restore all" stays available
// at the bottom of the list for when that's genuinely what's wanted.
//
// Shared between BoardToggle.tsx (in-game) and BoardLayoutEditor.tsx (the
// standalone layout tool) — both had their own copy of this pill's markup
// before; this replaces both so the picker behaves identically everywhere.

import React, { useEffect, useRef, useState } from 'react';
import { formatEdgeLabel } from '../../utils/boardCommon';

interface RestorablePillDropdownProps {
  icon: string;
  /** e.g. "hidden", "redirected" — used in both the pill label and the tooltip. */
  label: string;
  itemIds: string[];
  background: string;
  borderColor: string;
  /** Optional pill text color, for callers whose surrounding pills each use a distinct one. */
  textColor?: string;
  onRestoreOne: (edgeId: string) => void;
  onRestoreAll: () => void;
  /** The surrounding pill-button base style, so this matches its siblings exactly. */
  baseButtonStyle: React.CSSProperties;
}

export function RestorablePillDropdown({
  icon,
  label,
  itemIds,
  background,
  borderColor,
  textColor,
  onRestoreOne,
  onRestoreAll,
  baseButtonStyle,
}: RestorablePillDropdownProps): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (itemIds.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        style={{ ...baseButtonStyle, background, borderColor, ...(textColor ? { color: textColor } : {}) }}
        onClick={() => setOpen(o => !o)}
        title={`${itemIds.length} connector${itemIds.length === 1 ? '' : 's'} ${label} — click to pick which to restore`}
      >
        {icon} {itemIds.length} {label} · restore
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 240,
            maxHeight: 280,
            overflowY: 'auto',
            zIndex: 2000,
            fontFamily: 'system-ui, sans-serif',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {itemIds.map(id => (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                fontSize: 12,
                borderBottom: '1px solid #f1f3f5',
                gap: 8,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatEdgeLabel(id)}
              </span>
              <button
                type="button"
                onClick={() => onRestoreOne(id)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#0d6efd',
                  fontWeight: 600,
                  flexShrink: 0,
                  padding: 0,
                }}
                title="Restore just this one"
              >
                ↩️ restore
              </button>
            </div>
          ))}
          <div style={{ padding: '6px 10px' }}>
            <button
              type="button"
              onClick={() => { onRestoreAll(); setOpen(false); }}
              style={{
                width: '100%',
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #dee2e6',
                borderRadius: 6,
                background: '#f8f9fa',
                cursor: 'pointer',
              }}
            >
              Restore all {itemIds.length}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
