// tests/server/spaceProtection.test.ts
// Phase 2 protection tiers. The audit test at the bottom re-runs the grep
// that produced SEMANTIC_ANCHORS against the real engine code and the real
// stock board — if a service grows a hardcoded space reference the list
// doesn't cover, this fails and the list must be updated (spec: semantic
// anchors are protected until their feature graduates via ghost gate).

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { computeProtection, SEMANTIC_ANCHORS } from '../../server/spaceProtection.js';

const HEADER =
  'space_name,visit_type,Title,space_1,is_starting_space,is_ending_space,is_resume_hub,path_choice_memory_key,is_path_choice_lock_point';

function csv(...rows: string[]) {
  return [HEADER, ...rows].join('\n') + '\n';
}

describe('computeProtection', () => {
  it('protects structural spaces (start, end, resume hub)', () => {
    const protection = computeProtection({
      stockSpacesCsv: csv(
        'ALPHA-START,First,Start,BETA-MID,Yes,No,No,,No',
        'BETA-MID,First,Mid,ZETA-END,No,No,No,,No',
        'ZETA-END,First,End,,No,Yes,No,,No',
        'HUB-SPACE,First,Hub,BETA-MID,No,No,Yes,,No',
      ),
    });
    expect(protection.get('ALPHA-START')).toMatchObject({ tier: 'structural' });
    expect(protection.get('ZETA-END')).toMatchObject({ tier: 'structural' });
    expect(protection.get('HUB-SPACE')).toMatchObject({ tier: 'structural' });
    expect(protection.has('BETA-MID')).toBe(false);
  });

  it('protects semantic anchors from the engine-reference list', () => {
    const protection = computeProtection({
      stockSpacesCsv: csv('PM-DECISION-CHECK,First,PM,,No,No,No,,No'),
    });
    expect(protection.get('PM-DECISION-CHECK')).toMatchObject({ tier: 'semantic' });
  });

  it('conditionally protects path-choice participants (memory keys, lock points, rules)', () => {
    const protection = computeProtection({
      stockSpacesCsv: csv(
        'CHOICE-SPACE,First,Choice,LEFT-PATH,No,No,No,dob_path,No',
        'LOCK-SPACE,First,Lock,ZETA-END,No,No,No,,Yes',
        'LEFT-PATH,First,Left,ZETA-END,No,No,No,,No',
        'RIGHT-PATH,First,Right,ZETA-END,No,No,No,,No',
        'ZETA-END,First,End,,No,No,No,,No',
      ),
      pathChoiceCsv:
        'affected_space,memory_key,chosen_value,excluded_destination\n' +
        'LOCK-SPACE,dob_path,LEFT-PATH,RIGHT-PATH\n',
    });
    expect(protection.get('CHOICE-SPACE')).toMatchObject({ tier: 'path-choice' });
    expect(protection.get('LEFT-PATH')).toMatchObject({ tier: 'path-choice' });
    expect(protection.get('RIGHT-PATH')).toMatchObject({ tier: 'path-choice' });
    // LOCK-SPACE hit two path-choice rules; still just protected once.
    expect(protection.get('LOCK-SPACE')!.tier).toBe('path-choice');
    expect(protection.has('ZETA-END')).toBe(false);
  });

  it('structural outranks semantic when both apply', () => {
    const protection = computeProtection({
      stockSpacesCsv: csv('START-QUICK-PLAY-GUIDE,First,Tutorial,,Yes,No,No,,No'),
    });
    expect(protection.get('START-QUICK-PLAY-GUIDE')).toMatchObject({ tier: 'structural' });
  });
});

describe('SEMANTIC_ANCHORS audit (keeps the list honest)', () => {
  it('covers every space the engine references in code, against the real stock board', () => {
    const root = path.resolve(__dirname, '../..');
    const codeDirs = ['src/services', 'src/hooks'];
    const referenced = new Set<string>();
    for (const dir of codeDirs) {
      const abs = path.join(root, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of fs.readdirSync(abs)) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
        const source = fs.readFileSync(path.join(abs, file), 'utf-8');
        for (const match of source.matchAll(/'([A-Z][A-Z0-9-]{4,})'/g)) {
          referenced.add(match[1]);
        }
      }
    }

    const gameConfig = fs.readFileSync(path.join(root, 'public/data/CLEAN_FILES/GAME_CONFIG.csv'), 'utf-8');
    const boardSpaces = new Set(
      gameConfig.split('\n').slice(1).map(l => l.split(',')[0].trim()).filter(Boolean)
    );

    const engineReferencedBoardSpaces = [...referenced].filter(name => boardSpaces.has(name)).sort();
    const uncovered = engineReferencedBoardSpaces.filter(name => !SEMANTIC_ANCHORS.includes(name));
    expect(
      uncovered,
      `Engine code references board spaces not in SEMANTIC_ANCHORS: ${uncovered.join(', ')} — ` +
      'add them to server/spaceProtection.js (or graduate the feature via a ghost-batch gate first)'
    ).toEqual([]);
  });
});
