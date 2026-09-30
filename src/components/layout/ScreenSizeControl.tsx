import React, { useRef, useState } from 'react';
import { TvScaleCalibration } from './TvScaleCalibration';
import { tvScaleIsAvailable } from '../../utils/tvScale';

interface ScreenSizeControlProps {
  /** Look of the button — each screen brings its own (TV header vs setup screen). */
  style?: React.CSSProperties;
  /** Runs when the panel is opened (the TV lobby uses it to stop its first-use pulse). */
  onOpen?: () => void;
  label?: string;
}

/**
 * "Adjust screen size" button + its Bigger/Smaller panel, opening right under the
 * button (fb:54b1056b). One control for every screen that offers it: the TV's
 * header, and the setup screen — before a game starts there was no way to resize
 * at all, only once already in TV mode (fb:ceb1e67c, fb:780c1c73).
 *
 * Renders nothing on a device with no headroom to gain (a laptop, a phone) — the
 * same gate the TV header button has always used, so the setup screen is unchanged
 * on those.
 */
export function ScreenSizeControl({ style, onOpen, label = '🔍 Adjust screen size' }: ScreenSizeControlProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  if (!tvScaleIsAvailable()) return null;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        style={style}
        onClick={() => {
          setOpen(true);
          onOpen?.();
        }}
      >
        {label}
      </button>
      {open && <TvScaleCalibration anchorRef={buttonRef} onClose={() => setOpen(false)} />}
    </>
  );
}

export default ScreenSizeControl;
