// src/components/icons/LogoTransform.tsx
//
// The brand mark: a yarn ball connected to the "NYC Codes" book. Two prior
// passes were hand-drawn (an abstract animated spiral, then a pixel-grid
// rebuild) — maintainer feedback wanted real generated pixel art instead.
// 2026-07-26: replaced with a real PixelLab-generated image
// (public/images/logo-pixel.png, ~$0.007). A single generated image can't
// have its thread animate on its own, so "moving" now comes from the same
// glow + gentle wobble CSS treatment call sites already wrap the old
// logo.png in (see PlayerSetup.tsx / PlayerMobileView.tsx's
// .us-hero-logo-img / .us-hero-glow — unchanged, this component just needs
// to render inside that wrapper like the static image always did).

import React from 'react';

export interface LogoTransformProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function LogoTransform({ size = 64, className, style }: LogoTransformProps): JSX.Element {
  return (
    <img
      src="/images/logo-pixel.png"
      alt="Unravel Codes"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    />
  );
}
