// src/components/classroom/useSchoolBranding.ts
//
// The school name + logo for a classroom, read once from the open GET /api/instances/:id.
// Best-effort: until it loads (or if it fails) there is simply no branding to show.

import { useEffect, useState } from 'react';
import { fetchSchoolBranding, type SchoolBranding } from './schoolBrandingApi';

/** Same shape the server accepts for a classroom id; anything else is ignored. */
export const CLASSROOM_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function useSchoolBranding(instanceId: string | null): SchoolBranding | null {
  const [branding, setBranding] = useState<SchoolBranding | null>(null);
  useEffect(() => {
    if (!instanceId || !CLASSROOM_ID_PATTERN.test(instanceId)) return;
    let cancelled = false;
    void fetchSchoolBranding(instanceId).then((found) => { if (!cancelled) setBranding(found); });
    return () => { cancelled = true; };
  }, [instanceId]);
  return branding;
}
