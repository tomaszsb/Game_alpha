// "Visit our other sites: iqarius.com · watchorder.tv" — the small line at the bottom of the setup page, the game
// board, and the win and loss screens (the certificate has its own printed copy, utils/certificate.ts).

import React from 'react';
import { OTHER_SITES } from '../../constants/otherSites';

interface OtherSitesProps {
  /** Link colour; each surface passes its own so the line reads in light and dark. */
  linkColor?: string;
  style?: React.CSSProperties;
}

export function OtherSites({ linkColor, style }: OtherSitesProps): JSX.Element {
  return (
    <span data-testid="other-sites" style={style}>
      Visit our other sites:{' '}
      {OTHER_SITES.map((s, i) => (
        <React.Fragment key={s.url}>
          {i > 0 && ' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer" style={linkColor ? { color: linkColor } : undefined}>{s.label}</a>
        </React.Fragment>
      ))}
    </span>
  );
}
