/**
 * The editor's reader for `Spaces.schema.json` (public/data/SOURCE_FILES/).
 *
 * That file is the ONE description of what a space can hold (see the file's own
 * `description`). The hand-built editor form shows the fields marked
 * `x-placed`; everything else is listed under "More settings" by this module,
 * so a column added to Spaces.csv shows up in the editor with no editor code
 * change, and a column that has no schema entry yet still shows up (as plain
 * text) rather than being invisible. (Before, 19 behaviour settings had no
 * field anywhere and the editor could only keep them, not show them.)
 */

import type { SpaceRow } from '../types/EditorTypes';

export interface SchemaField {
  name: string;
  type?: 'string' | 'integer' | 'number';
  title?: string;
  description?: string;
  constraints?: { enum?: string[] };
  'x-role'?: string;
  'x-group'?: string;
  'x-editable-by'?: 'admin' | 'teacher' | 'none';
  'x-placed'?: boolean;
  'x-multiline'?: boolean;
  'x-ref'?: string;
  'x-enum-ignore-case'?: boolean;
  'x-authored'?: { value?: string; copy?: string };
}

export interface SpaceSchema {
  name: string;
  fields: SchemaField[];
}

/** One entry of the "More settings" list: the schema's field, or null when the column has no schema entry yet. */
export interface MoreSetting {
  name: string;
  field: SchemaField | null;
  group: string;
}

export const UNDESCRIBED_GROUP = 'Other (no description yet)';

/** Parse the schema file. Returns null for anything that is not a usable schema (the editor then just lists extras as plain text). */
export function parseSpaceSchema(text: string): SpaceSchema | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.fields)) return null;
    return { name: String(parsed.name ?? ''), fields: parsed.fields as SchemaField[] };
  } catch {
    return null;
  }
}

/**
 * Everything the hand-built form does not show, for one row, grouped in schema
 * order: schema fields that are not `x-placed`, not edited elsewhere
 * (`x-editable-by: none`, i.e. the board layout), plus any column the row carries
 * that the schema has never heard of.
 */
export function moreSettings(schema: SpaceSchema | null, row: SpaceRow): MoreSetting[] {
  const out: MoreSetting[] = [];
  const known = new Set<string>();
  for (const field of schema?.fields ?? []) {
    known.add(field.name);
    if (field['x-placed']) continue;
    if (field['x-editable-by'] === 'none') continue;
    out.push({ name: field.name, field, group: field['x-group'] || UNDESCRIBED_GROUP });
  }
  for (const name of Object.keys(row._extraColumns ?? {})) {
    if (known.has(name)) continue;
    out.push({ name, field: null, group: UNDESCRIBED_GROUP });
  }
  return out;
}

/** Group a moreSettings() list by its group name, keeping first-seen order. */
export function groupMoreSettings(list: MoreSetting[]): Array<{ group: string; items: MoreSetting[] }> {
  const groups: Array<{ group: string; items: MoreSetting[] }> = [];
  for (const item of list) {
    let g = groups.find(x => x.group === item.group);
    if (!g) { g = { group: item.group, items: [] }; groups.push(g); }
    g.items.push(item);
  }
  return groups;
}
