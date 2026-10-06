// tests/server/schemaCoverage.test.ts
//
// Spaces.schema.json is the one description of what a space can hold (Job 2b).
// This keeps it honest: it can never quietly fall behind the data or the places
// that still copy parts of it. When one of these goes red, a column was added to
// one place and not the other.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseCsvRecords, parseCsvWithHeaders } from '../../server/processGameData.js';
import { EDITABLE_FIELDS } from '../../server/instanceCatalog.js';
import { TEACHER_EDITABLE_COLUMNS } from '../../server/instanceContentDiff.js';
import { SAFE_FIELD_SUBSET } from '../../src/components/editor/SpaceEditor';
import { SPACES_KNOWN_HEADERS } from '../../src/components/editor/utils/csvExport';

const dir = path.join(process.cwd(), 'public/data/SOURCE_FILES');
const spacesText = fs.readFileSync(path.join(dir, 'Spaces.csv'), 'utf-8');
const schema = JSON.parse(fs.readFileSync(path.join(dir, 'Spaces.schema.json'), 'utf-8'));
const fields: any[] = schema.fields;
const headers: string[] = parseCsvRecords(spacesText)[0];

describe('Spaces.schema.json describes Spaces.csv exactly', () => {
  it('every column has a schema entry and every schema entry is a column', () => {
    const names = fields.map(f => f.name);
    expect(headers.filter(h => !names.includes(h)), 'columns with no schema entry').toEqual([]);
    expect(names.filter(n => !headers.includes(n)), 'schema entries with no column').toEqual([]);
    expect(new Set(names).size, 'duplicate schema entries').toBe(names.length);
  });

  it('every stock value is one the schema allows', () => {
    const problems: string[] = [];
    for (const row of parseCsvWithHeaders(spacesText)) {
      if (!row.space_name) continue; // the nameless button-label rows are free text
      for (const f of fields) {
        const v = String(row[f.name] ?? '').trim();
        if (v === '') continue;
        const allowed: string[] | undefined = f.constraints?.enum;
        if (allowed) {
          const ok = f['x-enum-ignore-case']
            ? allowed.some(a => a.toLowerCase() === v.toLowerCase())
            : allowed.includes(v);
          if (!ok) problems.push(`${row.space_name} ${row.visit_type}: ${f.name}="${v}" is not one of ${allowed.join('|')}`);
        }
        if (f.type === 'integer' && !/^-?\d+$/.test(v)) problems.push(`${row.space_name}: ${f.name}="${v}" is not a whole number`);
        if (f.type === 'number' && !Number.isFinite(Number(v))) problems.push(`${row.space_name}: ${f.name}="${v}" is not a number`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('x-placed matches the fields the hand-built editor form actually has', () => {
    const placed = fields.filter(f => f['x-placed']).map(f => f.name).sort();
    // display_label_override has its own box (the tile label); the rest are csvExport's known columns.
    const formFields = [...SPACES_KNOWN_HEADERS, 'display_label_override'].sort();
    expect(placed).toEqual(formFields);
  });

  it('who may edit what: the schema agrees with the three hand-kept teacher lists', () => {
    const teacher = fields.filter(f => f['x-editable-by'] === 'teacher').map(f => f.name);
    expect(teacher).toEqual([...EDITABLE_FIELDS]);
    expect(teacher).toEqual([...TEACHER_EDITABLE_COLUMNS]);
    expect(teacher).toEqual([...SAFE_FIELD_SUBSET]);
  });

  it('every field names a group, a role and who may edit it', () => {
    for (const f of fields) {
      expect(f['x-group'], f.name).toBeTruthy();
      expect(f['x-role'], f.name).toBeTruthy();
      expect(['admin', 'teacher', 'none'], f.name).toContain(f['x-editable-by']);
      expect(f.title, f.name).toBeTruthy();
    }
  });

  it('references point at a real table', () => {
    for (const f of fields.filter(x => x['x-ref'])) {
      const [table, column] = String(f['x-ref']).split('.');
      if (table === 'Spaces') expect(headers, f.name).toContain(column);
      if (table === 'CHARACTERS') {
        const chars = fs.readFileSync(path.join(process.cwd(), 'public/data/CLEAN_FILES/CHARACTERS.csv'), 'utf-8');
        expect(parseCsvRecords(chars)[0], f.name).toContain(column);
      }
    }
  });
});

// The other two files the editor round-trips.
describe.each([
  ['DiceRoll Info.csv', 'DiceRollInfo.schema.json'],
  ['ModalConfig.csv', 'ModalConfig.schema.json'],
])('%s is described exactly by %s', (csvFile, schemaFile) => {
  const text = fs.readFileSync(path.join(dir, csvFile), 'utf-8');
  const s = JSON.parse(fs.readFileSync(path.join(dir, schemaFile), 'utf-8'));
  const records = parseCsvRecords(text);
  const cols: string[] = records[0];

  it('every column has a schema entry and every schema entry is a column', () => {
    const names = s.fields.map((f: any) => f.name);
    expect(cols.filter(c => !names.includes(c))).toEqual([]);
    expect(names.filter((n: string) => !cols.includes(n))).toEqual([]);
  });

  it('every stock value is one the schema allows', () => {
    const problems: string[] = [];
    for (const row of parseCsvWithHeaders(text)) {
      for (const f of s.fields) {
        const allowed: string[] | undefined = f.constraints?.enum;
        const v = String(row[f.name] ?? '').trim();
        if (allowed && !allowed.includes(v)) problems.push(`${row.space_name}: ${f.name}="${v}"`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every field names a role, who may edit it and a label', () => {
    for (const f of s.fields) {
      expect(f['x-role'], f.name).toBeTruthy();
      expect(['admin', 'teacher', 'none'], f.name).toContain(f['x-editable-by']);
      expect(f.title, f.name).toBeTruthy();
    }
  });
});
