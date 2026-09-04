/**
 * Monotonic, RNG-free id minting for LOG and BOOKKEEPING identifiers.
 *
 * These ids used to be built with `Math.random()`, which looks inert and is
 * not. The ghost regression bot replaces the GLOBAL `Math.random` with a
 * seeded `mulberry32` stream (`tests/ghost/ghostPlayer.ts`) — the same global
 * that `DiceService.rollDice()` and the deck shuffles draw from. One draw per
 * log entry meant the NUMBER OF LINES WRITTEN TO THE LOG decided what the
 * dice rolled.
 *
 * Measured, not theorised (2026-09-03): removing a single `warn()` per Try
 * Again re-dealt all 50 seeded smart-bot games — 47 wins/3 failures/0 hard/
 * 86.9 turns became 48/2/1 hard/94.9, twice, and returned exactly on revert.
 * Seeded playtest runs (`seed=558616687`) were unreproducible across any
 * logging change for the same reason.
 *
 * A process-wide counter keeps ids unique without touching the shared RNG:
 * because the counter is module-level rather than per-instance, two services
 * (or two `StateService` instances in the same process) can never mint the
 * same id, even inside a single millisecond where `Date.now()` collides.
 *
 * Scope note: this is for identifiers that exist only to label a record —
 * log entries, log sessions, players. Do NOT route gameplay randomness
 * (dice, shuffles, seeded money) through here; that randomness is SUPPOSED to
 * come from the seeded stream.
 */

let counter = 0;

/**
 * Mint a unique id of the form `<prefix>_<epoch ms>_<base36 counter>`.
 *
 * The shape deliberately matches the old `Math.random`-based one
 * (`prefix_digits_alphanumerics`) — nothing in `src/` parses these strings,
 * but `TransactionalLogging.test.ts` asserts the shape and readers eyeball it
 * in transcripts.
 */
export function sequentialId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter.toString(36)}`;
}
