import { describe, it, expect } from 'vitest';
import {
  exportLogToMarkdown,
  exportLogToJson,
  exportLogToCsv,
  exportLogToPrintableHtml,
  buildExportFilename,
  ExportMetadata,
} from '../../src/utils/logExport';
import { ActionLogEntry } from '../../src/types/StateTypes';

function makeEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    id: 'e-1',
    type: 'card_draw',
    timestamp: new Date('2026-05-31T14:23:07.823Z'),
    playerId: 'player1',
    playerName: 'Alice',
    description: 'Drew 2 Work Packages: Adaptive reuse warehouse, Strip mall senior living',
    details: { cards: ['W006', 'W009'], cardType: 'W', count: 2 },
    isCommitted: true,
    explorationSessionId: 'sess-1',
    gameRound: 1,
    turnWithinRound: 1,
    globalTurnNumber: 3,
    playerTurnNumber: 2,
    visibility: 'player',
    ...overrides,
  };
}

const meta: ExportMetadata = {
  gameId: 'G284',
  exportedAt: new Date('2026-05-31T15:00:00Z'),
  scopeLabel: 'Alice',
  appVersion: '3.0.50 (abc1234)',
};

describe('logExport', () => {
  describe('exportLogToMarkdown', () => {
    it('includes the header metadata', () => {
      const md = exportLogToMarkdown([makeEntry()], meta);
      expect(md).toContain('# Unravel Codes — Game Log');
      expect(md).toContain('**Game:** G284');
      expect(md).toContain('**Scope:** Alice');
      expect(md).toContain('**App version:** 3.0.50 (abc1234)');
      expect(md).toContain('**Entries:** 1');
    });

    it('groups entries by turn number', () => {
      const md = exportLogToMarkdown(
        [
          makeEntry({ id: 'a', globalTurnNumber: 1 }),
          makeEntry({ id: 'b', globalTurnNumber: 2 }),
          makeEntry({ id: 'c', globalTurnNumber: 1 }),
        ],
        meta,
      );
      const turn1Idx = md.indexOf('## Turn 1');
      const turn2Idx = md.indexOf('## Turn 2');
      expect(turn1Idx).toBeGreaterThan(-1);
      expect(turn2Idx).toBeGreaterThan(turn1Idx);
    });

    it('renders entry details on a sub-bullet', () => {
      const md = exportLogToMarkdown([makeEntry()], meta);
      expect(md).toContain('_details:_');
      expect(md).toContain('cards=["W006","W009"]');
    });
  });

  describe('exportLogToJson', () => {
    it('produces parseable JSON with the entries array', () => {
      const json = exportLogToJson([makeEntry()], meta);
      const parsed = JSON.parse(json);
      expect(parsed.gameId).toBe('G284');
      expect(parsed.scopeLabel).toBe('Alice');
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].description).toContain('Adaptive reuse');
    });
  });

  describe('exportLogToCsv', () => {
    it('starts with the header row', () => {
      const csv = exportLogToCsv([makeEntry()]);
      const [header] = csv.split('\n');
      expect(header).toBe('timestamp,type,playerId,playerName,gameRound,globalTurnNumber,playerTurnNumber,description,details');
    });

    it('escapes commas, quotes, and newlines', () => {
      const csv = exportLogToCsv([
        makeEntry({ description: 'Drew, then discarded "X"', playerName: 'Alice "A" Smith' }),
      ]);
      const rows = csv.split('\n');
      expect(rows[1]).toContain('"Drew, then discarded ""X"""');
      expect(rows[1]).toContain('"Alice ""A"" Smith"');
    });

    it('handles entries without details', () => {
      const csv = exportLogToCsv([makeEntry({ details: undefined })]);
      const dataRow = csv.split('\n')[1];
      // Trailing details column should be empty (row ends with a comma).
      expect(dataRow.endsWith(',')).toBe(true);
    });
  });

  describe('exportLogToPrintableHtml', () => {
    it('renders an HTML document', () => {
      const html = exportLogToPrintableHtml([makeEntry()], meta);
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Unravel Codes — Game G284 Log</title>');
      expect(html).toContain('Alice');
    });

    it('escapes HTML in entry content', () => {
      const html = exportLogToPrintableHtml([
        makeEntry({ description: 'Pressed <Play> & it failed' }),
      ], meta);
      expect(html).toContain('Pressed &lt;Play&gt; &amp; it failed');
    });
  });

  describe('buildExportFilename', () => {
    it('builds a slugified filename with the date', () => {
      expect(buildExportFilename(meta, 'md')).toBe('unravel-G284-alice-2026-05-31.md');
    });

    it('handles multi-word scope labels', () => {
      const wide = { ...meta, scopeLabel: 'All Players' };
      expect(buildExportFilename(wide, 'csv')).toBe('unravel-G284-all-players-2026-05-31.csv');
    });
  });
});
