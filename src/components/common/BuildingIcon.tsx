// BuildingIcon - a town building's picture: a round character portrait when the icon names one and the game has it,
// else the emoji. Used by the town's building signs and by the project steps on the player's clipboard so both wear
// exactly the same picture.
import React from 'react';

export function BuildingIcon({ icon, portrait, size }: { icon: string; portrait: string | null; size: number }): JSX.Element {
  return portrait
    ? <img src={portrait} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
    : <span aria-hidden="true" style={{ fontSize: Math.round(size * 0.7), lineHeight: `${size}px`, width: size, textAlign: 'center', flex: 'none' }}>{icon || '🏢'}</span>;
}
