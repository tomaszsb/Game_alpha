// src/components/modals/RoutingExplanationModal.tsx
//
// fb:f1bc011b — after the FDNY logic questions resolve (often entirely
// auto-answered from game state), the player can be routed to a new space
// with no idea why. This display-only modal explains the routing in plain
// language ("You're heading to the FDNY Plan Exam because…"), so the move
// isn't a silent teleport. Non-blocking: it's queued like the LifeEventModal
// and dismissed with a tap — no cross-runtime promise to resolve.

import React from 'react';
import { colors } from '../../styles/theme';

interface RoutingExplanationModalProps {
  /** Authored reason for the routing (the deciding question's branch reason). */
  message: string;
  /** Friendly name of the destination the player is being sent to. */
  toSpaceLabel: string;
  onClose: () => void;
}

export function RoutingExplanationModal({ message, toSpaceLabel, onClose }: RoutingExplanationModalProps): JSX.Element {
  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-label="Where you're headed next">
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>🧭 Where you're headed next</div>
        <div style={styles.destination}>
          Heading to <strong>{toSpaceLabel}</strong>
        </div>
        <p style={styles.message}>{message}</p>
        <button type="button" onClick={onClose} style={styles.button} autoFocus>
          Got it
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1100,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
  },
  card: {
    backgroundColor: '#fff', borderRadius: '14px', padding: '1.5rem', width: 'min(420px, 100%)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)', textAlign: 'center',
  },
  header: { fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.secondary.main },
  destination: { marginTop: '0.5rem', fontSize: '1.15rem', color: colors.text.primary },
  message: { marginTop: '0.75rem', fontSize: '0.95rem', lineHeight: 1.5, color: colors.text.secondary },
  button: {
    marginTop: '1.25rem', padding: '0.6rem 1.4rem', backgroundColor: colors.primary.main, color: 'white',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600,
  },
};
