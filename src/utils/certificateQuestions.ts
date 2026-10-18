// src/utils/certificateQuestions.ts
//
// The questions on the certificate step (Tom, 2026-10-18, Review Q4 + Q5).
//
// Fun questions: did the student enjoy it (Tom's measure of "fun enough").
// Why questions: built from THIS student's own game, so they ask WHY something
// happened, never WHAT their status was (the old self-answered logic questions
// were turned off 2026-05-26 after a play-tester said "don't ask questions the
// engine knows"). Every number in a question comes from the game state: the
// trophy row (days and money against the player's own plan) and the stop list.

import type { TrophyRow } from './trophyScoring';
import type { JourneyStep } from './endGameStats';

export interface WhyQuestion {
  id: 'time' | 'longest-stop' | 'money';
  question: string;
}

export interface CertificateAnswers {
  playAgain: '' | 'yes' | 'maybe' | 'no';
  mostBoring: string;
  bestPart: string;
  why: Array<{ question: string; answer: string }>;
}

export const FUN_QUESTIONS = {
  playAgain: 'Would you play again?',
  mostBoring: 'What was the most boring part?',
  bestPart: 'What was the best part?',
} as const;

const days = (n: number): string => `${n} day${n === 1 ? '' : 's'}`;

export interface WhyQuestionInput {
  /** This player's trophy row (days/money used vs planned). Optional: older saves have none. */
  row?: Pick<TrophyRow, 'daysUsed' | 'daysPlanned' | 'moneySpent' | 'moneyPlanned'> | null;
  /** The stops the player made, with the days spent at each. */
  journey: JourneyStep[];
  /** Total days the game took (fallback when there is no trophy row). */
  daysTotal: number;
  /** "$1,020,000"-style money text. */
  money: (amount: number) => string;
  /** Space id -> the name players see on the board. */
  spaceTitle: (spaceName: string) => string;
}

/** Two or three "why" questions from the player's own numbers. */
export function buildWhyQuestions(input: WhyQuestionInput): WhyQuestion[] {
  const out: WhyQuestion[] = [];
  const { row, journey, money, spaceTitle } = input;

  // 1. Time against the plan.
  if (row && row.daysPlanned > 0) {
    const over = Math.round(row.daysUsed - row.daysPlanned);
    out.push({
      id: 'time',
      question: over > 0
        ? `Your project took ${days(Math.round(row.daysUsed))}. The plan was ${days(Math.round(row.daysPlanned))}, so you finished ${days(over)} late. What caused most of the delay?`
        : `Your project took ${days(Math.round(row.daysUsed))}, within the ${days(Math.round(row.daysPlanned))} you planned. What did you do that kept it on time?`,
    });
  } else if (input.daysTotal > 0) {
    out.push({ id: 'time', question: `Your project took ${days(Math.round(input.daysTotal))}. What caused most of that time?` });
  }

  // 2. The stop that cost the most days (all visits to it added up).
  const bySpace = new Map<string, number>();
  for (const step of journey) {
    if (step.daysSpent > 0) bySpace.set(step.spaceName, (bySpace.get(step.spaceName) ?? 0) + step.daysSpent);
  }
  let longest: [string, number] | null = null;
  for (const entry of bySpace) if (!longest || entry[1] > longest[1]) longest = entry;
  if (longest) {
    out.push({
      id: 'longest-stop',
      question: `You spent ${days(Math.round(longest[1]))} at ${spaceTitle(longest[0])}, more than at any other stop. Why did it take so long there?`,
    });
  }

  // 3. Money against the plan.
  if (row && row.moneyPlanned > 0) {
    const over = Math.round(row.moneySpent - row.moneyPlanned);
    out.push({
      id: 'money',
      question: over > 0
        ? `You spent ${money(row.moneySpent)} against a plan of ${money(row.moneyPlanned)}. Where did the extra ${money(over)} go?`
        : `You spent ${money(row.moneySpent)}, within your plan of ${money(row.moneyPlanned)}. What helped you stay on budget?`,
    });
  }
  return out.slice(0, 3);
}
