import React, { useEffect, useRef, useState } from 'react';
import { colors } from '../../styles/theme';
import {
  TV_SCALE_OPTIONS,
  applyTvLayoutWidth,
  writeTvLayoutWidth,
  readTvLayoutWidth,
  indexForLayoutWidth,
  stepTvScaleIndex,
} from '../../utils/tvScale';

/** ~10s (Job 3A, Tom 2026-09-25): long enough to walk back to the couch and
 *  look, short enough that a TV never gets stuck on an untested size. */
const SNAPBACK_SECONDS = 10;

interface TvScaleCalibrationProps {
  onClose: () => void;
  /** Called after "Keep this size" is pressed, so the host screen can re-measure. */
  onApplied?: (layoutWidth: number) => void;
}

/**
 * Bigger / Smaller buttons that resize the REAL screen live, a Keep this
 * size button that is the only thing that writes the choice, and an ~10s
 * snap-back to whatever was showing before if Keep is never pressed.
 *
 * Job 3A (Tom, 2026-09-25, after testing on his real 4K TV: "yes to live
 * buttons"). Replaces the earlier four-sample picker — the browser API that
 * answers "how big is this screen, how far away is the viewer" still doesn't
 * exist, so the viewer still has to judge it themselves, but now against the
 * real board resizing live instead of a lorem-ipsum-style sample line. No
 * backdrop: the whole point is to watch the real screen while pressing the
 * buttons, so this floats over it rather than hiding it.
 */
export function TvScaleCalibration({ onClose, onApplied }: TvScaleCalibrationProps) {
  // The size showing before this dialog opened — what a snap-back or Cancel
  // returns to. Read once, into a plain value rather than a ref read during
  // render: useRef's own argument is only used on the very first render, so
  // passing it here (instead of reading .current back out) is the safe way
  // to seed both the ref and the initial index from the same snapshot.
  const startWidth = readTvLayoutWidth() ?? TV_SCALE_OPTIONS[0].layoutWidth;
  const previousWidthRef = useRef(startWidth);
  const [index, setIndex] = useState(() => indexForLayoutWidth(startWidth));
  const [secondsLeft, setSecondsLeft] = useState(SNAPBACK_SECONDS);
  // Guards against both the snap-back timer and a Keep/Cancel click firing —
  // whichever happens first wins, the other becomes a no-op.
  const settledRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const current = TV_SCALE_OPTIONS[index];
  const atBiggest = index === 0;
  const atSmallest = index === TV_SCALE_OPTIONS.length - 1;

  const step = (delta: -1 | 1) => {
    const next = stepTvScaleIndex(index, delta);
    if (next === index) return;
    setIndex(next);
    applyTvLayoutWidth(TV_SCALE_OPTIONS[next].layoutWidth);
  };

  const keep = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const width = current.layoutWidth;
    writeTvLayoutWidth(width);
    applyTvLayoutWidth(width);
    onApplied?.(width);
    onCloseRef.current();
  };

  const revert = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    applyTvLayoutWidth(previousWidthRef.current);
    onCloseRef.current();
  };

  // Live-applies every Bigger/Smaller press (above), and snaps back to the
  // previous size ~10s after the LAST press if Keep was never pressed — the
  // countdown restarts on every press so a viewer mid-adjustment is never
  // rushed by an earlier press's clock.
  useEffect(() => {
    let remaining = SNAPBACK_SECONDS;
    setSecondsLeft(remaining);
    const tick = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        if (!settledRef.current) {
          settledRef.current = true;
          applyTvLayoutWidth(previousWidthRef.current);
          onCloseRef.current();
        }
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [index]);

  // Belt-and-braces: if this dialog goes away some other way (e.g. TVDisplay
  // itself remounts) without Keep having settled it, don't strand the TV on
  // an untested size.
  useEffect(() => () => {
    if (!settledRef.current) {
      settledRef.current = true;
      applyTvLayoutWidth(previousWidthRef.current);
    }
  }, []);

  return (
    <div style={styles.panel} role="dialog" aria-modal="true" aria-label="Adjust screen size">
      <div style={styles.headerRow}>
        <span style={styles.stepLabel}>
          {current.label}
          {current.id === 'md' && <span style={styles.recommendedTag}>Recommended</span>}
        </span>
        <span style={styles.blurb}>{current.blurb}</span>
      </div>

      <div style={styles.buttonRow}>
        <button
          onClick={() => step(-1)}
          disabled={atBiggest}
          style={{ ...styles.stepButton, ...(atBiggest ? styles.stepButtonDisabled : {}) }}
          aria-label="Bigger — less fits on screen"
        >
          − Bigger
        </button>
        <button
          onClick={() => step(1)}
          disabled={atSmallest}
          style={{ ...styles.stepButton, ...(atSmallest ? styles.stepButtonDisabled : {}) }}
          aria-label="Smaller — more fits on screen"
        >
          + Smaller
        </button>
        <button onClick={keep} style={styles.keepButton}>
          Keep this size
        </button>
        <button onClick={revert} style={styles.cancelButton}>
          Cancel
        </button>
      </div>

      <div style={styles.countdown} aria-live="polite">
        Reverts to the old size in {secondsLeft}s unless you press Keep
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  // Fixed, floating, no backdrop — the real screen behind it is the whole
  // point, since Bigger/Smaller now resize it live instead of a sample.
  panel: {
    position: 'fixed',
    left: '50%',
    bottom: '1.5rem',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    backgroundColor: 'white',
    borderRadius: '14px',
    padding: '1rem 1.25rem',
    maxWidth: '92vw',
    boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.6rem',
    flexWrap: 'wrap',
  },
  stepLabel: { fontSize: '1.05rem', fontWeight: 700, color: '#18181b' },
  recommendedTag: {
    marginLeft: '0.5rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: colors.primary.main,
  },
  blurb: { fontSize: '0.85rem', color: '#71717a' },
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  stepButton: {
    padding: '0.55rem 0.9rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    backgroundColor: '#f4f4f5',
    color: '#18181b',
    border: '2px solid #d4d4d8',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  stepButtonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  keepButton: {
    padding: '0.55rem 1.1rem',
    fontSize: '0.95rem',
    fontWeight: 700,
    backgroundColor: colors.primary.main,
    color: 'white',
    border: '2px solid transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  cancelButton: {
    padding: '0.55rem 0.9rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    backgroundColor: 'white',
    color: '#52525b',
    border: '1px solid #d4d4d8',
    borderRadius: '8px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  countdown: { fontSize: '0.8rem', color: '#a1a1aa' },
};

export default TvScaleCalibration;
