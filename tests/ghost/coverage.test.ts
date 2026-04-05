/**
 * Ghost Player coverage gate — runs 50 games and asserts every real
 * gameplay space in GAME_CONFIG.csv was visited at least once. Catches
 * a class of bug the strict win-rate gate misses: a data edit that
 * orphans a space (makes it unreachable). Without this gate, the ghost
 * would still finish its games via alternate routes, win-rate would
 * stay high, and the orphaned branch would only surface when a real
 * student hit it.
 *
 * EXCLUDED_SPACES are spaces the ghost is not expected to touch because
 * nothing in the runtime board routes to them (e.g. tutorial-only spaces
 * that the bot's headless bootstrap skips past).
 */

// Spaces the ghost is structurally unable to reach in a headless batch.
// Add to this list only with justification — each entry is a known
// gap in coverage.
const EXCLUDED_SPACES = new Set<string>([
  // Tutorial-only intro screen; bot starts directly on OWNER-SCOPE-INITIATION
  'START-QUICK-PLAY-GUIDE',
]);

import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { bootstrapHeadlessServices } from './bootstrapServices';
import { playOneGame } from './ghostPlayer';

describe('Ghost Player coverage', () => {
  it('50 games collectively visit every non-excluded space in GAME_CONFIG.csv', async () => {
    // Load the canonical space list from GAME_CONFIG.csv
    const csv = readFileSync(
      join(process.cwd(), 'public', 'data', 'CLEAN_FILES', 'GAME_CONFIG.csv'),
      'utf-8'
    );
    const allSpaces = csv
      .split('\n')
      .slice(1)
      .map((line) => line.split(',')[0])
      .filter((s) => s && s.trim().length > 0);

    const visitedAcrossAllGames = new Set<string>();
    const gameOutcomes: Array<{ success: boolean; reason: string; turns: number; uniqueSpaces: number }> = [];

    for (let i = 0; i < 50; i++) {
      const services = await bootstrapHeadlessServices();
      const visitedThisGame = new Set<string>();

      // Wrap trail push: easier — just watch stateService after each turn
      const origTrailPush = Array.prototype.push;
      const result = await playOneGame(services, { maxTurns: 300 });

      // Reconstruct visited from trail entries — they are formatted as
      // "T<n> <space>:<visitType> hand=..." by playOneGame
      for (const entry of result.trail) {
        const m = entry.match(/^T\d+\s+([^:\s]+):/);
        if (m) {
          visitedThisGame.add(m[1]);
          visitedAcrossAllGames.add(m[1]);
        }
      }
      gameOutcomes.push({
        success: result.success,
        reason: result.reason,
        turns: result.turns,
        uniqueSpaces: visitedThisGame.size,
      });
    }

    const avoided = allSpaces.filter((s) => !visitedAcrossAllGames.has(s));
    const visited = allSpaces.filter((s) => visitedAcrossAllGames.has(s));

    // Also report any trail-observed space that isn't in GAME_CONFIG (would
    // indicate data drift between spaces.csv and game_config.csv)
    const unknownSpaces = [...visitedAcrossAllGames].filter((s) => !allSpaces.includes(s));

    console.log('\n=== Ghost Player 50-game coverage ===');
    console.log(`Total spaces in GAME_CONFIG.csv: ${allSpaces.length}`);
    console.log(`Visited at least once: ${visited.length}`);
    console.log(`Avoided entirely: ${avoided.length}`);
    if (avoided.length > 0) {
      console.log('Avoided spaces:');
      avoided.forEach((s) => console.log('  - ' + s));
    }
    if (unknownSpaces.length > 0) {
      console.log('Visited but not in GAME_CONFIG.csv:');
      unknownSpaces.forEach((s) => console.log('  ? ' + s));
    }
    console.log('\nPer-game unique-space counts (first 10):');
    gameOutcomes.slice(0, 10).forEach((g, i) =>
      console.log(`  #${i + 1} ${g.reason} turns=${g.turns} uniqueSpaces=${g.uniqueSpaces}`)
    );
    const wins = gameOutcomes.filter((g) => g.success).length;
    console.log(`\nBatch: ${wins}/${gameOutcomes.length} wins`);
    console.log('=====================================\n');

    // Write the report to a file (vitest buffers stdout)
    const report = [
      '=== Ghost Player 50-game coverage ===',
      `Total spaces in GAME_CONFIG.csv: ${allSpaces.length}`,
      `Visited at least once: ${visited.length}`,
      `Avoided entirely: ${avoided.length}`,
      '',
      'VISITED:',
      ...visited.map((s) => '  + ' + s),
      '',
      'AVOIDED:',
      ...(avoided.length === 0 ? ['  (none)'] : avoided.map((s) => '  - ' + s)),
      '',
      ...(unknownSpaces.length > 0
        ? ['UNKNOWN (visited but not in GAME_CONFIG.csv):', ...unknownSpaces.map((s) => '  ? ' + s), '']
        : []),
      'Per-game unique-space counts:',
      ...gameOutcomes.map(
        (g, i) => `  #${i + 1} ${g.reason} turns=${g.turns} uniqueSpaces=${g.uniqueSpaces}`
      ),
      '',
      `Batch: ${wins}/${gameOutcomes.length} wins`,
    ].join('\n');
    writeFileSync('/tmp/ghost-coverage.txt', report);

    // Sanity: the batch actually ran
    expect(gameOutcomes.length).toBe(50);

    // Hard gate: every real gameplay space was visited. Any space not in
    // EXCLUDED_SPACES that never appears in 50 games is treated as an
    // orphaned-branch regression and fails the build.
    const unexpectedlyAvoided = avoided.filter((s) => !EXCLUDED_SPACES.has(s));
    expect(
      unexpectedlyAvoided,
      `Spaces never reached in 50 games (likely orphaned by a data change): ${unexpectedlyAvoided.join(', ')}`
    ).toEqual([]);

    // Also: any space we see in play but isn't in GAME_CONFIG.csv indicates
    // data drift between the spaces table and game config — fail loudly.
    expect(unknownSpaces, `Visited but missing from GAME_CONFIG.csv: ${unknownSpaces.join(', ')}`).toEqual([]);
  }, 600000);
});
