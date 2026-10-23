// src/components/editor/utils/standardWhy.ts
//
// The standard "Why this happens" text for each space (the `why,<SPACE>` rows of ACTION_TOOLTIPS.csv), read
// once so the teacher's "why" box can show it as a grey hint: they see what they would be replacing.

import { parseCsvRecords } from '../../../utils/csvCore.js';

let cache: Promise<Record<string, string>> | null = null;

export function parseStandardWhy(csvText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of parseCsvRecords(csvText)) {
    // columns: action_type, action_value, button_label, tooltip_why, tooltip_context
    if (r[0] === 'why' && r[1] && r[3]) out[r[1]] = r[3];
  }
  return out;
}

/** Never rejects: no file or no network just means no hint. */
export function loadStandardWhy(): Promise<Record<string, string>> {
  if (!cache) {
    cache = (async () => {
      try {
        const res = await fetch('/data/CLEAN_FILES/ACTION_TOOLTIPS.csv');
        if (!res.ok) return {};
        return parseStandardWhy(await res.text());
      } catch {
        return {};
      }
    })();
  }
  return cache;
}
