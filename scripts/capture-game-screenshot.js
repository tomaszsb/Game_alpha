// scripts/capture-game-screenshot.js
//
// Captures screens for the /challenge landing-page carousel
// (src/playtest/GameTour.tsx), saved into src/playtest/tour/.
//
// Auto-captures the screens reachable without actually playing through a game:
// the 2-player setup, the opening board, the glossary, a term-definition
// popup, and the turn-1 action modals (new work / money) when they appear.
//
// Screens that need a real playthrough — mid-game with revealed nodes, a won
// game, a lost game — and the teacher edit-spaces screen (needs login) are NOT
// captured here. Add those by hand: drop a numbered PNG into src/playtest/tour/
// (e.g. 20-won-game.png) and it shows up in the carousel automatically.
//
//   node scripts/capture-game-screenshot.js
//   GAME_URL=https://game.unravelcodes.com/ node scripts/capture-game-screenshot.js

import puppeteer from 'puppeteer';

const URL = process.env.GAME_URL || 'http://localhost:3000/';
const DIR = 'src/playtest/tour';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickByText(page, text, { optional = false } = {}) {
  try {
    await page.waitForFunction(
      (t) => [...document.querySelectorAll('button')].some((x) => x.textContent.includes(t)),
      { timeout: optional ? 5000 : 20000 },
      text
    );
  } catch (err) {
    if (optional) return false;
    throw err;
  }
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    b.click();
  }, text);
  return true;
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

  const shoot = async (name) => {
    await page.screenshot({ path: `${DIR}/${name}` });
    console.log(`Saved ${DIR}/${name}`);
  };
  const esc = async () => { await page.keyboard.press('Escape'); await wait(700); };

  // --- Setup with 2 players (before starting) ---
  await clickByText(page, 'PC');
  await clickByText(page, 'Add Player');
  await wait(300);
  await clickByText(page, 'Add Player');
  await wait(400);
  await shoot('01-player-setup.png');

  // --- Opening board (no arrows) ---
  await clickByText(page, 'Start Game');
  await wait(5000);

  // Clear whatever's on top of the board so it (and the action buttons behind
  // it) are reachable: the one-time "tap to learn" coach mark and any
  // auto-opened arrival narrative modal ("Continue"). Repeat a few times.
  const dismissOverlays = async () => {
    for (let k = 0; k < 4; k++) {
      const did = await page.evaluate(() => {
        const tip = [...document.querySelectorAll('*')].find(
          (n) => n.children.length === 0 && /click to dismiss/i.test(n.textContent || '')
        );
        if (tip) { tip.click(); return true; }
        const cont = [...document.querySelectorAll('button')].find((b) => /^\s*continue\s*$/i.test(b.textContent || ''));
        if (cont) { cont.click(); return true; }
        return false;
      });
      if (!did) break;
      await wait(700);
    }
  };
  await dismissOverlays();
  await shoot('02-the-beginning.png');

  // --- Turn-1 action modals (best-effort) ---
  if (await clickByText(page, 'Get Work Packages', { optional: true })) {
    await wait(1500);
    await shoot('10-adding-new-work.png');
    await dismissOverlays();
  }
  if (await clickByText(page, 'Hire 3 Expeditors', { optional: true })) {
    await wait(1500);
    await shoot('11-building-your-team.png');
    await dismissOverlays();
  }

  // --- A dictionary term popup (best-effort) ---
  // TextWithTerms renders clickable glossary terms as .dictionary-term-link;
  // click the first visible one to open its quick definition.
  const clickedTerm = await page.evaluate(() => {
    const term = [...document.querySelectorAll('.dictionary-term-link')]
      .find((t) => t.getBoundingClientRect().width > 0);
    if (term) { term.click(); return true; }
    return false;
  });
  if (clickedTerm) { await wait(1200); await shoot('12-a-word-explained.png'); await esc(); }

  // --- Glossary ---
  if (await clickByText(page, 'Glossary', { optional: true })) {
    await wait(1500);
    await shoot('30-the-glossary.png');
    await esc();
  }
} finally {
  await browser.close();
}
