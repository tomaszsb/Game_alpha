// src/components/classroom/ClassroomBadge.tsx
//
// Teacher instance layer, Phase 3 polish (fb:75bec2bc) — a small "which
// classroom am I in" chip. A game bound to a non-default classroom looked
// byte-for-byte like the public game; this surfaces the classroom name on
// the setup screen and in-game.
//
// Renders nothing on the public default board (getInstanceId() === null), so
// every existing game is visually unchanged. The classroom name comes from
// the open GET /api/instances/:id read; the id is shown as a best-effort
// fallback while it loads or if the read fails.

import React, { useEffect, useState } from 'react';
import { getInstanceId } from '../../utils/dataInstance';
import { getBackendURL } from '../../utils/networkDetection';
import { IconSchool } from '../icons/SetupIcons';
import { logoUrl } from './schoolBrandingApi';

interface ClassroomBadgeProps {
  style?: React.CSSProperties;
}

export function ClassroomBadge({ style }: ClassroomBadgeProps): JSX.Element | null {
  const instanceId = getInstanceId();
  const [name, setName] = useState<string | null>(null);
  const [logo, setLogo] = useState<{ version: number; school: string } | null>(null);

  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${getBackendURL()}/api/instances/${instanceId}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null) as { meta?: { displayName?: string; schoolName?: string }; logoVersion?: number | null } | null;
        if (cancelled) return;
        if (data?.meta?.displayName) setName(data.meta.displayName);
        if (typeof data?.logoVersion === 'number') setLogo({ version: data.logoVersion, school: data.meta?.schoolName || '' });
      } catch {
        // best-effort: the id fallback below still names the classroom
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  if (!instanceId) return null;
  return (
    <span style={{ ...badgeStyle, ...style }} title={`Classroom: ${name || instanceId}`}>
      {logo ? (
        <img
          src={logoUrl(instanceId, logo.version)}
          alt={logo.school || 'School logo'}
          data-testid="classroom-badge-logo"
          style={{ height: '1.2em', width: 'auto', maxWidth: '3em', objectFit: 'contain', borderRadius: 2 }}
        />
      ) : (
        <IconSchool size="1em" />
      )}{' '}
      {name || instanceId}
    </span>
  );
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
  padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
  background: '#ede9fe', color: '#6d28d9', whiteSpace: 'nowrap',
};
