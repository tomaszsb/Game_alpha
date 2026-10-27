// PlayerPawn — a player's piece on the town board: a pixel-art pawn body in the
// player's colour with their face (PlayerAvatar) as the head (fb:fefe42f8,
// "hard to find the small player figurines ... make them much larger and maybe
// look like pawns", Tom 10-27).
//
// The body picture is one white pawn (PixelLab, `public/images/pawns/`). It is
// tinted per player in the browser: a block of the player's colour cut to the
// pawn's shape (CSS mask), with the white picture laid over it in `multiply`,
// so white becomes the colour, the grey shading becomes a darker colour and
// the black outline stays black. Any colour works without a picture per colour.

import React from 'react';
import { PlayerAvatar } from '../common/PlayerAvatar';

export const PAWN_BODY_SRC = '/images/pawns/pawn_body.png';
/** The body picture is 30 x 38 pixels. */
const BODY_W = 30;
const BODY_H = 38;

interface PlayerPawnProps {
  avatar?: string;
  color?: string;
  /** Body width in board pixels; the face and height follow from it. */
  width?: number;
  title?: string;
  testId?: string;
}

/** Height of a pawn of this width: the body plus the part of the face above it. */
export function pawnHeight(width: number): number {
  const scale = width / BODY_W;
  return Math.round(BODY_H * scale + width * 0.8 - 4 * scale);
}

export const PlayerPawn: React.FC<PlayerPawnProps> = ({ avatar, color, width = 60, title, testId }) => {
  const scale = width / BODY_W;
  const bodyH = Math.round(BODY_H * scale);
  const face = Math.round(width * 0.8);
  // The face sits on the pawn's collar, overlapping it a little.
  const overlap = Math.round(4 * scale);
  const tint = color || '#94a3b8';
  const mask = `url(${PAWN_BODY_SRC}) center / 100% 100% no-repeat`;
  return (
    <span
      title={title}
      data-testid={testId}
      style={{ position: 'relative', display: 'inline-block', width, height: bodyH + face - overlap, flex: 'none', isolation: 'isolate' }}
    >
      <span style={{ position: 'absolute', left: 0, bottom: 0, width, height: bodyH }}>
        <span aria-hidden style={{ position: 'absolute', inset: 0, background: tint, WebkitMask: mask, mask }} />
        <img
          src={PAWN_BODY_SRC} alt="" draggable={false}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'multiply', imageRendering: 'pixelated', userSelect: 'none' }}
        />
      </span>
      <span style={{ position: 'absolute', left: (width - face) / 2, top: 0, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.35)', display: 'inline-flex' }}>
        <PlayerAvatar avatar={avatar} color={tint} size={face} />
      </span>
    </span>
  );
};
