// server/boardPlaytest.js
// "Check my board" (Manager brief Job 4): a teacher asks the server to play their classroom's baked
// board with the ghost bot and say, in plain words, whether a game can be finished. The bot runs in a
// CHILD PROCESS (scripts/boardPlaytest.ts, via tsx) so a save never waits for it and the game server
// never loads the TypeScript game code. About 10-20 s per finished game, ~2 s for a stuck one.
//
// This file is the runner + the plain-words summary. The routes live in server.js.

import { spawn as nodeSpawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(HERE, '..');
export const PLAYTEST_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'boardPlaytest.ts');

export const DEFAULT_GAMES = 3;
export const MAX_GAMES = 6;
export const MAX_SEATS = 4;
export const BASE_SEED = 424242;
/** The whole check is cut off after this long, whatever it is doing. */
export const CHECK_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Turn the bot's game results into a verdict a teacher can read.
 *  - finished: reached the end of the project.
 *  - lost: ran out of money or passed the design-fee limit. That is the GAME working (a player can
 *    lose), not a board fault, so it is reported but never counts against the board.
 *  - stuck: could not finish and went round in circles (or ran out of turns) - a board problem.
 *  - broken: the game crashed or broke a rule on this board - a board problem.
 * @param {Array<{reason:string, finalSpace?:string, lossReason?:string, error?:string}>} games
 */
export function summarizePlaytest(games) {
  const finished = games.filter(g => g.reason === 'FINISHED');
  const lost = games.filter(g => g.reason === 'LOST');
  const stuck = games.filter(g => g.reason === 'LOOP' || g.reason === 'TURN_CAP');
  const broken = games.filter(g => g.reason === 'EXCEPTION' || g.reason === 'INVARIANT_VIOLATION');

  const problems = [];
  const spaces = [...new Set(stuck.map(g => g.finalSpace).filter(Boolean))];
  if (stuck.length > 0) {
    problems.push({
      code: 'STUCK',
      spaces,
      message: spaces.length > 0
        ? `${stuck.length} of ${games.length} practice games got stuck and never reached the end. They went round in circles around: ${spaces.join(', ')}.`
        : `${stuck.length} of ${games.length} practice games got stuck and never reached the end.`,
    });
  }
  if (broken.length > 0) {
    problems.push({
      code: 'BROKEN',
      spaces: [...new Set(broken.map(g => g.finalSpace).filter(Boolean))],
      message: `${broken.length} of ${games.length} practice games hit an error on this board: ${broken[0].error || 'unknown error'}`,
    });
  }

  let verdict;
  if (games.length === 0) verdict = 'unclear';
  else if (problems.length > 0) verdict = 'problem';
  else if (finished.length > 0) verdict = 'ok';
  else verdict = 'unclear';

  const headline = {
    ok: `Good news: practice players finished this board in ${finished.length} of ${games.length} games.`,
    problem: 'Something is wrong with this board: practice players could not always finish it.',
    unclear: games.length === 0
      ? 'The check did not play any games.'
      : 'No practice game reached the end, but none got stuck either (they all ran out of money). Try the check again.',
  }[verdict];

  return {
    verdict,
    headline,
    problems,
    counts: { games: games.length, finished: finished.length, lost: lost.length, stuck: stuck.length, broken: broken.length },
    lostNote: lost.length > 0
      ? `${lost.length} practice game${lost.length === 1 ? '' : 's'} ended because the player ran out of money or spent too much on design. That is normal play, not a fault in the board.`
      : null,
  };
}

/**
 * One check at a time for the whole server (the bot uses a full CPU core). `spawn` is injectable for tests.
 */
export function createPlaytestRunner({ spawn = nodeSpawn, now = () => Date.now(), timeoutMs = CHECK_TIMEOUT_MS, exitGraceMs = 3000, log = console.log } = {}) {
  /** @type {Map<string, any>} the latest job per classroom (kept in memory; a restart forgets it) */
  const jobs = new Map();
  let runningId = null;

  function publicJob(job) {
    if (!job) return null;
    const { child: _child, timer: _timer, exitTimer: _exitTimer, stderrTail: _stderrTail, ...rest } = job;
    return rest;
  }

  function start(instanceId, cleanDir, { games = DEFAULT_GAMES, seats = 1 } = {}) {
    if (runningId) {
      const err = new Error(runningId === instanceId
        ? 'A check of this board is already running.'
        : 'Another classroom\'s board is being checked right now. Try again in a minute.');
      err.statusCode = 429;
      throw err;
    }
    const g = Math.max(1, Math.min(MAX_GAMES, Number.isFinite(+games) ? Math.floor(+games) : DEFAULT_GAMES));
    const s = Math.max(1, Math.min(MAX_SEATS, Number.isFinite(+seats) ? Math.floor(+seats) : 1));

    const job = {
      instanceId, status: 'running', games: g, seats: s,
      startedAt: now(), finishedAt: null, results: [], summary: null, error: null,
    };
    jobs.set(instanceId, job);
    runningId = instanceId;

    const env = {};
    for (const k of ['PATH', 'Path', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'HOME', 'USERPROFILE']) {
      if (process.env[k]) env[k] = process.env[k];
    }
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', PLAYTEST_SCRIPT, cleanDir, String(g), String(s), String(BASE_SEED)],
      { cwd: PROJECT_ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    job.child = child;

    const finish = (status, error) => {
      if (job.status !== 'running') return;
      clearTimeout(job.timer);
      clearTimeout(job.exitTimer);
      job.status = status;
      job.error = error || null;
      job.finishedAt = now();
      job.summary = summarizePlaytest(job.results);
      if (status === 'error') {
        job.summary = { ...job.summary, verdict: 'unclear', headline: 'The check could not run. Nothing is wrong with your board that we know of; try again, and tell the site owner if it keeps happening.' };
      }
      if (runningId === instanceId) runningId = null;
      // The only record of why a check ended the way it did (nothing else logs this).
      log(`[board-check] ${instanceId}: ${status}${error ? ` (${error})` : ''}, ${job.results.length} game(s) in ${Math.round((job.finishedAt - job.startedAt) / 1000)}s${job.stderrTail ? ` | stderr tail: ${job.stderrTail.replace(/\s+/g, ' ').slice(-300)}` : ''}`);
    };

    job.timer = setTimeout(() => {
      // Record the reason first: killing the child makes its own 'close' fire at once, with a vaguer message.
      finish('error', 'The check took too long and was stopped.');
      try { child.kill('SIGKILL'); } catch { /* already gone */ }
    }, timeoutMs);

    job.stderrTail = '';
    child.stderr?.on('data', chunk => { job.stderrTail = (job.stderrTail + chunk.toString()).slice(-2000); });

    let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('{')) continue; // stray log output
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'game') job.results.push(msg);
        else if (msg.type === 'error') job.scriptError = msg.message;
        else if (msg.type === 'done') job.sawDone = true;
      }
    });
    child.on('error', err => finish('error', err.message));
    const settle = code => {
      if (job.sawDone) finish('done');
      else finish('error', job.scriptError || `The check stopped early (exit ${code}).`);
    };
    child.on('close', settle);
    // 'close' waits for every pipe to shut. A helper process the child started can keep one open after the
    // child itself is gone, and then 'close' never comes and the job reads "running" until the 10-minute
    // cut-off. The child's own exit is enough: give its last output a moment, then settle.
    child.on('exit', code => {
      job.exitTimer = setTimeout(() => settle(code), exitGraceMs);
    });

    return publicJob(job);
  }

  return {
    start,
    get: instanceId => publicJob(jobs.get(instanceId)) ?? null,
    isBusy: () => runningId !== null,
  };
}
