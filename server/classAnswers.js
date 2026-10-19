// server/classAnswers.js
//
// Answers a student types on the certificate step (Tom, 2026-10-18, Review Q4 + Q5):
// three "was it fun?" questions and two or three "why did that happen?" questions
// built from that student's own game. Saved so Tom can read them later.
//
// What is stored, and nothing else: the name the student typed (it is already on
// the certificate), the game code, the answers and the date. No IP address, no
// device, no browser details. The file lives in DATA_DIR itself, NOT in
// DATA_DIR/game-data (the folder served under /data), and dataGate.js refuses
// anything that is not a board file anyway; tests/server/classAnswersLive.test.ts
// proves both.

import fs from 'fs';
import path from 'path';

export const CLASS_ANSWERS_FILE = 'class-answers.jsonl';
export const MAX_NAME = 60;
export const MAX_ANSWER = 500;
export const MAX_QUESTION = 300;
export const MAX_WHY = 3;
const AGAIN = new Set(['yes', 'maybe', 'no', '']);
// SUNY Farmingdale (Prof. Ahouissi, 2026-10-19): which course the student is in.
export const COURSES = new Set(['350', '409', '']);
const GAME_CODE_RE = /^[A-Za-z0-9-]{1,40}$/;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Turn a posted body into the record to store, or { error } when it is unusable.
 * Long text is cut to size rather than refused: a student should never lose
 * their certificate over a long answer.
 */
export function cleanClassAnswer(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Nothing to save.' };
  const fun = body.fun && typeof body.fun === 'object' ? body.fun : {};
  const again = text(fun.playAgain, 10).toLowerCase();
  if (!AGAIN.has(again)) return { error: 'playAgain must be yes, maybe or no.' };
  const course = text(body.course, 10);
  if (!COURSES.has(course)) return { error: 'course must be 350 or 409.' };
  const why = (Array.isArray(body.why) ? body.why : [])
    .slice(0, MAX_WHY)
    .map((w) => ({ question: text(w && w.question, MAX_QUESTION), answer: text(w && w.answer, MAX_ANSWER) }))
    .filter((w) => w.question);
  const record = {
    date: now.toISOString(),
    name: text(body.name, MAX_NAME) || 'A Player',
    course,
    gameCode: GAME_CODE_RE.test(String(body.gameCode || '')) ? String(body.gameCode) : '',
    fun: {
      playAgain: again,
      mostBoring: text(fun.mostBoring, MAX_ANSWER),
      bestPart: text(fun.bestPart, MAX_ANSWER),
    },
    why,
  };
  const anything = record.course || record.fun.playAgain || record.fun.mostBoring || record.fun.bestPart || why.some((w) => w.answer);
  if (!anything) return { error: 'No answers given.' };
  return { record };
}

export function appendClassAnswer(dataDir, record) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(path.join(dataDir, CLASS_ANSWERS_FILE), JSON.stringify(record) + '\n');
}

/** Every saved answer, newest first. Unreadable lines are skipped. */
export function readClassAnswers(dataDir) {
  const file = path.join(dataDir, CLASS_ANSWERS_FILE);
  if (!fs.existsSync(file)) return [];
  const out = [];
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip a torn line */ }
  }
  return out.reverse();
}
