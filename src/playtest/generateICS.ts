// src/playtest/generateICS.ts
//
// Client-side .ics calendar file generation for the Reminder Hub — no
// backend or library needed, ICS is plain text.

import { getChallengeUrl, getCleanChallengeUrl } from './playtestStorage';

export type ReminderChoice = 'tonight' | 'tomorrow-evening' | 'saturday-afternoon' | 'next-weekend';

// A "when" is either one of the presets above or a specific instant the
// visitor typed in ("Pick a date & time"). The unified reminder flow resolves
// whichever they chose into a concrete Date + a human label (used in the
// email/calendar wording) via resolveWhen(), so calendar / notification /
// email / text all schedule against the same value.
export type ReminderWhen = ReminderChoice | { custom: Date };

const CHOICE_LABELS: Record<ReminderChoice, string> = {
  tonight: 'tonight',
  'tomorrow-evening': 'tomorrow evening',
  'saturday-afternoon': 'Saturday afternoon',
  'next-weekend': 'next weekend',
};

function formatCustomLabel(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function resolveWhen(when: ReminderWhen): { date: Date; label: string } {
  if (typeof when === 'object') {
    return { date: when.custom, label: formatCustomLabel(when.custom) };
  }
  return { date: resolveTargetDate(when), label: CHOICE_LABELS[when] };
}

export function resolveTargetDate(choice: ReminderChoice): Date {
  const now = new Date();
  const target = new Date(now);

  switch (choice) {
    case 'tonight': {
      target.setHours(19, 0, 0, 0);
      if (target.getTime() <= now.getTime()) {
        // Already past 7pm — remind in an hour instead of tomorrow.
        target.setTime(now.getTime() + 60 * 60 * 1000);
      }
      break;
    }
    case 'tomorrow-evening': {
      target.setDate(target.getDate() + 1);
      target.setHours(19, 0, 0, 0);
      break;
    }
    case 'saturday-afternoon': {
      const day = target.getDay(); // 0=Sun..6=Sat
      let diff = (6 - day + 7) % 7;
      if (diff === 0) diff = 7; // today is Saturday — mean next Saturday
      target.setDate(target.getDate() + diff);
      target.setHours(14, 0, 0, 0);
      break;
    }
    case 'next-weekend': {
      const day = target.getDay();
      let diff = (6 - day + 7) % 7;
      if (diff === 0) diff = 7;
      diff += 7; // the weekend after the coming one
      target.setDate(target.getDate() + diff);
      target.setHours(14, 0, 0, 0);
      break;
    }
  }

  return target;
}

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function buildICS(choice: ReminderChoice): string {
  return buildICSForDate(resolveTargetDate(choice));
}

export function buildICSForDate(target: Date): string {
  const end = new Date(target.getTime() + 60 * 60 * 1000);
  const uid = `playtest-${Date.now()}@unravelcodes.com`;
  // The tracked URL (with ?src=) is the functional destination — calendar
  // apps use the URL: field for their "open link" button, not as raw text.
  // The DESCRIPTION text a human actually reads shows the clean, memorable
  // URL instead.
  const url = getChallengeUrl();
  const displayUrl = getCleanChallengeUrl();

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unravel Codes//Playtest Reminder//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(target)}`,
    `DTEND:${toICSDate(end)}`,
    'SUMMARY:Play Unravel Codes',
    `DESCRIPTION:Reminder to play Unravel Codes on a PC\\, TV\\, or tablet. Visit ${displayUrl} to start.`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function downloadICS(choice: ReminderChoice): void {
  downloadICSForDate(resolveTargetDate(choice));
}

export function downloadICSForDate(target: Date): void {
  const content = buildICSForDate(target);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'play-unravel-codes.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
