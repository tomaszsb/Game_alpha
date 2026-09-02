import React from 'react';
import { colors } from '../../styles/theme';
import {
  TV_SCALE_OPTIONS,
  getNativeLayoutWidth,
  getPanelPixelWidth,
  previewFontPx,
  applyTvLayoutWidth,
  writeTvLayoutWidth,
  readTvLayoutWidth,
} from '../../utils/tvScale';

interface TvScaleCalibrationProps {
  onClose: () => void;
  /** Called after a choice is applied, so the host screen can re-measure. */
  onApplied?: (layoutWidth: number) => void;
}

/**
 * Asks the one question no browser API can answer: how big is this screen,
 * and how far away is the person watching it?
 *
 * Everything else about the display we can measure — `screen.width` times
 * `devicePixelRatio` tells us the panel is 4K without asking anyone. But a
 * 32" monitor at arm's length and a 75" TV across a classroom report
 * IDENTICAL numbers, and they need very different text sizes. So rather than
 * collect TV models or ask "does your TV support 4K?" (which people often
 * don't know, and which still wouldn't answer this), we show real samples at
 * the real resulting sizes and let the viewer point at one.
 *
 * Maintainer's own idea, 2026-09-01, aimed at the target it actually fits.
 * Origin: fb:93449bf2.
 */
export function TvScaleCalibration({ onClose, onApplied }: TvScaleCalibrationProps) {
  const nativeWidth = getNativeLayoutWidth();
  const panelWidth = getPanelPixelWidth();
  const current = readTvLayoutWidth();

  const choose = (layoutWidth: number) => {
    writeTvLayoutWidth(layoutWidth);
    applyTvLayoutWidth(layoutWidth);
    onApplied?.(layoutWidth);
    onClose();
  };

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label="Screen size">
      <div style={styles.panel}>
        <h2 style={styles.heading}>How much should fit on this screen?</h2>
        <p style={styles.instruction}>
          Pick the smallest line you can still read comfortably from where you are sitting.
          Smaller text means more of the board fits at once.
        </p>

        <div style={styles.options}>
          {TV_SCALE_OPTIONS.map(opt => {
            const sampleSize = previewFontPx(16, opt.layoutWidth, nativeWidth);
            const isCurrent = current === opt.layoutWidth;
            return (
              <button
                key={opt.id}
                onClick={() => choose(opt.layoutWidth)}
                style={{
                  ...styles.option,
                  borderColor: isCurrent ? colors.primary.main : '#d4d4d8',
                  backgroundColor: isCurrent ? 'rgba(37,99,235,0.06)' : 'white',
                }}
              >
                <div style={styles.optionHeader}>
                  <span style={styles.optionLabel}>
                    {opt.label}
                    {isCurrent && <span style={styles.currentTag}>current</span>}
                  </span>
                  <span style={styles.optionBlurb}>{opt.blurb}</span>
                </div>
                {/* Rendered at the size this choice will actually produce —
                    a real line from the game, not lorem ipsum, so the
                    judgement is made against the thing being judged. */}
                <div style={{ ...styles.sample, fontSize: `${sampleSize}px` }}>
                  The owner opens the books — you have $540,000 of an $825,000 budget.
                </div>
              </button>
            );
          })}
        </div>

        <div style={styles.footerRow}>
          {/* Shown because it is the fact that makes the whole screen make
              sense: the panel is not low-resolution, the layout is small. */}
          <span style={styles.diag}>
            This screen: {panelWidth ? `${panelWidth}px wide panel` : 'unknown panel'}
            {nativeWidth ? `, laid out as ${nativeWidth}px` : ''}
          </span>
          <button onClick={onClose} style={styles.cancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  panel: {
    backgroundColor: 'white',
    borderRadius: '14px',
    padding: '1.25rem 1.5rem',
    maxWidth: '760px',
    width: '100%',
    maxHeight: '92vh',
    overflowY: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  },
  heading: { margin: '0 0 0.35rem', fontSize: '1.4rem', fontWeight: 700 },
  instruction: { margin: '0 0 1rem', fontSize: '1rem', color: '#52525b', lineHeight: 1.4 },
  options: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  option: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: '2px solid #d4d4d8',
    borderRadius: '10px',
    padding: '0.7rem 0.9rem',
    cursor: 'pointer',
  },
  optionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '0.75rem',
    marginBottom: '0.35rem',
  },
  optionLabel: { fontSize: '1rem', fontWeight: 700, color: '#18181b' },
  optionBlurb: { fontSize: '0.85rem', color: '#71717a' },
  currentTag: {
    marginLeft: '0.5rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: colors.primary.main,
  },
  sample: { color: '#27272a', lineHeight: 1.35 },
  footerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginTop: '1rem',
    flexWrap: 'wrap',
  },
  diag: { fontSize: '0.8rem', color: '#a1a1aa' },
  cancel: {
    padding: '0.5rem 1.1rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    backgroundColor: '#f4f4f5',
    border: '1px solid #d4d4d8',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};

export default TvScaleCalibration;
