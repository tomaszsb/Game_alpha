// scripts/boardPlaytest.ts
// "Check my board": plays N seeded ghost-bot games on a baked classroom board and prints one JSON line
// per game (`{"type":"game",...}`) and a final `{"type":"done",...}`. Run by server/boardPlaytest.js as a
// child process, so the game server itself never loads the TypeScript game code.
//   node --import tsx scripts/boardPlaytest.ts <CLEAN_FILES dir> [games=3] [seats=1] [baseSeed=424242]
import { bootstrapHeadlessServices } from '../src/headless/bootstrapServices';
import { playOneGame } from '../src/headless/ghostPlayer';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const [cleanDir, gamesArg, seatsArg, seedArg] = process.argv.slice(2);
const games = Math.max(1, parseInt(gamesArg ?? '3', 10));
const seats = Math.max(1, Math.min(4, parseInt(seatsArg ?? '1', 10)));
const baseSeed = parseInt(seedArg ?? '424242', 10);

// The game code logs to stdout; keep stdout for the JSON lines only.
console.log = console.error;
const emit = (o: unknown) => process.stdout.write(JSON.stringify(o) + '\n');

async function main(): Promise<void> {
  if (!cleanDir) throw new Error('usage: boardPlaytest.ts <CLEAN_FILES dir> [games] [seats] [seed]');
  for (let i = 0; i < games; i++) {
    const started = Date.now();
    Math.random = mulberry32(baseSeed + i);
    const services = await bootstrapHeadlessServices(cleanDir);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    let r;
    try {
      r = await playOneGame(services, { players: seats, maxTurns: 300, tryAgainProbability: 0.2, smartTryAgain: true, detectLoops: true, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    emit({
      type: 'game', index: i, seed: baseSeed + i, ms: Date.now() - started,
      reason: r.reason, success: r.success, lossReason: r.lossReason, finalSpace: r.finalSpace,
      turns: r.turns, error: r.error ? String(r.error).split('\n')[0] : undefined,
      winnerId: r.standings?.winnerId ?? null,
    });
  }
  emit({ type: 'done' });
  // The services leave timers running; exit explicitly or the process never ends.
  process.exit(0);
}

main().catch(err => {
  emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
