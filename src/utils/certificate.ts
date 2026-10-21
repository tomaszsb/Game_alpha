// src/utils/certificate.ts
//
// The end-of-game certificate: one printable page (the browser's Print > Save as PDF),
// the same way the post-game log export works. No check code, no server proof: a plain
// page built from the player's name and today's date, plus (v3.8.15) the student's own
// answers to the "why" questions, so the teacher can talk them through in class.

export const STRUCTURAL_JOKE =
  "A structural engineer's favorite game? Anything where the load is spread evenly and nobody has to take the weight alone.";

/** SUNY Farmingdale course the student ticked (Prof. Ahouissi, 2026-10-19). '' = none. */
export type CourseChoice = '' | '350' | '409';
export const COURSES: CourseChoice[] = ['350', '409'];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCertificateHtml(
  playerName: string,
  date: Date,
  why: Array<{ question: string; answer: string }> = [],
  course: CourseChoice = '',
  /** Where the page is served from, so the logo loads in the new tab (blank in tests). */
  origin = '',
): string {
  const name = escapeHtml(playerName.trim() || 'A Player');
  const answered = why.filter(w => w.answer.trim());
  const answersHtml = answered.length === 0 ? '' : `
<div class="answers">
  <h2>Thinking it over</h2>
${answered.map(w => `  <p class="q">${escapeHtml(w.question)}</p>
  <p class="a">${escapeHtml(w.answer.trim())}</p>`).join('\n')}
</div>`;
  const dateText = escapeHtml(
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unravel Codes certificate - ${name}</title>
<style>
  @page { size: letter landscape; margin: 0.5in; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1f2937; margin: 0; padding: 16px; text-align: center; }
  .frame { border: 6px double #1e3a5f; padding: 40px 24px; max-width: 900px; margin: 0 auto; }
  .logo { display: block; margin: 0 auto 8px; height: 64px; width: auto; }
  .more { margin: 22px 0 0; font-size: 0.9rem; color: #4b5563; }
  .more a { color: #1e3a5f; text-decoration: underline; }
  h1 { font-size: 2.2rem; margin: 0 0 8px; color: #1e3a5f; }
  .small { font-size: 1rem; color: #4b5563; margin: 8px 0; }
  .name { font-size: 2.4rem; font-weight: bold; margin: 20px 0; border-bottom: 2px solid #9ca3af; display: inline-block; padding: 0 24px 4px; max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere; }
  .course { margin: 8px 0 0; font-size: 1.2rem; }
  .course span { display: inline-block; margin: 0 18px; white-space: nowrap; }
  .box { display: inline-block; width: 1.1em; height: 1.1em; border: 2px solid #1f2937; vertical-align: -0.2em; margin-right: 8px; text-align: center; line-height: 1.1em; font-weight: bold; box-sizing: border-box; font-size: 1.1em; }
  .game { font-size: 1.4rem; font-style: italic; margin: 8px 0 20px; }
  .answers { max-width: 900px; margin: 24px auto 0; text-align: left; break-inside: avoid; }
  .answers h2 { font-size: 1.2rem; color: #1e3a5f; margin: 0 0 8px; }
  .answers .q { font-weight: bold; margin: 12px 0 4px; }
  .answers .a { margin: 0 0 8px; padding-left: 12px; border-left: 3px solid #9ca3af; white-space: pre-wrap; }
  .print-button { margin-top: 24px; padding: 0.6rem 1.2rem; font-size: 1rem; cursor: pointer; }
  @media print { .print-button { display: none; } }
</style></head><body>
<div class="frame">
  <img class="logo" src="${origin}/images/logo.png" alt="Unravel Codes">
  <h1>Certificate of Completion</h1>
  <p class="small">This certifies that</p>
  <div class="name">${name}</div>
  <p class="small">played a full game of</p>
  <p class="game">Unravel Codes: The Game</p>
  <p class="small">a board game about getting a building permitted and built in New York City,<br>and reached the end of the game on</p>
  <p class="small"><strong>${dateText}</strong></p>
  <p class="small">Course (SUNY Farmingdale)</p>
  <p class="course">${COURSES.map(c => `<span data-course="${c}"><i class="box">${course === c ? '&#10003;' : ''}</i>Course ${c}</span>`).join('')}</p>
  <p class="more">Visit our other sites: <a href="https://iqarius.com">iqarius.com</a> &middot; <a href="https://www.watchorder.tv/">watchorder.tv</a></p>
</div>${answersHtml}
<button class="print-button" id="print-btn">Print / Save as PDF</button>
</body></html>`;
}

/** Opens the certificate in a new tab. Returns false when the browser blocked the pop-up. */
export function openCertificate(
  playerName: string,
  why: Array<{ question: string; answer: string }> = [],
  course: CourseChoice = '',
): boolean {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(buildCertificateHtml(playerName, new Date(), why, course, window.location.origin));
  win.document.close();
  // No inline onclick: the app's CSP blocks inline handlers, and the new tab inherits it.
  win.document.getElementById('print-btn')?.addEventListener('click', () => win.print());
  return true;
}
