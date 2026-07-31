// scripts/capture-game-screenshot-more.js
//
// Captures the playtester-tour screenshots that scripts/capture-game-screenshot.js
// can't reach by clicking alone: a mid-game board (revealed movement paths),
// a won-game end screen, a lost-game end screen, and a card-detail view
// showing a real dollar cost. See TODO.md "Finish the screenshot carousel"
// and docs/core/CLAUDE.md's "Capturing a transient modal" / "Live verification
// by cheating state" TACTICAL entries for the underlying recipe.
//
// This automates that recipe via the SAME live gameServices instance the
// documented browser-console trick reaches into (a React fiber walk from any
// DOM node up to a component whose props include gameServices) rather than
// the HTTP state-push API — no gameId/token needed, and no schema-validation
// surprises, since it calls the real StateService methods the app itself
// uses. Note: CardModal (the modal CLAUDE.md's original recipe named for a
// "money" shot) no longer exists post classic-panel removal — the current
// V2 equivalent, PlayerCardDetailV2, opens from LOCAL component state, not
// gameState, so that one shot uses a real click instead of injection.
//
//   node scripts/capture-game-screenshot-more.js
//   GAME_URL=https://game.unravelcodes.com/ node scripts/capture-game-screenshot-more.js

import puppeteer from 'puppeteer';

const URL = process.env.GAME_URL || 'http://localhost:3001/';
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

async function dismissOverlays(page) {
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
}

async function startTwoPlayerGame(page) {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await clickByText(page, 'PC');
  await clickByText(page, 'Add Player');
  await wait(300);
  await clickByText(page, 'Add Player');
  await wait(400);
  await clickByText(page, 'Start Game');
  await wait(5000);
  await dismissOverlays(page);
}

// Reaches into the live React tree to grab the same `gameServices` object
// every component gets via context. Stashes it on window.__gs. Returns
// whether it was found.
const grabServices = () => {
  function findFiber(dom) {
    for (const key in dom) {
      if (key.startsWith('__reactFiber$')) return dom[key];
    }
    return null;
  }
  const all = document.querySelectorAll('body *');
  let found = null;
  for (const el of all) {
    const fiber = findFiber(el);
    if (!fiber) continue;
    let f = fiber;
    for (let i = 0; i < 30 && f; i++, f = f.return) {
      const props = f.memoizedProps;
      if (props && props.gameServices) { found = props.gameServices; break; }
    }
    if (found) break;
  }
  if (!found) return false;
  window.__gs = found;
  return true;
};

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1.5 });

  const shoot = async (name) => {
    await page.screenshot({ path: `${DIR}/${name}` });
    console.log(`Saved ${DIR}/${name}`);
  };

  // ---------------------------------------------------------------------
  // Shot: mid-game board, several real spaces in (revealed movement paths,
  // contrasted with 02-the-beginning's "opening board, no arrows").
  // ---------------------------------------------------------------------
  await startTwoPlayerGame(page);
  await page.evaluate(grabServices);
  await page.evaluate(() => {
    const gs = window.__gs;
    const player = gs.stateService.getGameState().players[0];
    const path = ['OWNER-SCOPE-INITIATION', 'OWNER-FUND-INITIATION', 'BANK-FUND-REVIEW', 'ARCH-INITIATION'];
    gs.stateService.updatePlayer({
      id: player.id,
      currentSpace: path[path.length - 1],
      visitedSpaces: path,
      timeSpent: 42,
    });
  });
  await wait(800);
  // The teleport triggers PlayerPanelV2's transient "You moved" banner
  // (auto-dismisses after 5s, but that's slower than we need) and can leave
  // an arrival-narrative popup open on the board — clear both explicitly
  // rather than waiting them out.
  await page.evaluate(() => {
    const moved = [...document.querySelectorAll('*')].find(
      (n) => /^you moved$/i.test(n.textContent?.trim() || '')
    );
    (moved?.closest('[aria-label^="You moved"]') || moved)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await dismissOverlays(page);
  // A couple of node-story bubbles on the board can stay open after a
  // teleport (they're not simple "Continue"/tooltip dismiss patterns) —
  // click empty canvas space to close anything hover/click-pinned.
  await page.mouse.click(1000, 950);
  await wait(500);
  await shoot('15-mid-game.png');

  // ---------------------------------------------------------------------
  // Shot: won game (EndGameModal, winner branch).
  // ---------------------------------------------------------------------
  await startTwoPlayerGame(page);
  await page.evaluate(grabServices);
  await page.evaluate(() => {
    const gs = window.__gs;
    const player = gs.stateService.getGameState().players[0];
    // A believable finished project instead of an empty-looking all-$0
    // summary: some Work Packages in hand (drives Project Summary's scope
    // + work-package count) and a plausible cash/time result.
    gs.stateService.updatePlayer({
      id: player.id,
      hand: [...player.hand, 'W001', 'W002', 'W003'],
      money: 42500,
      timeSpent: 210,
    });
    gs.stateService.endGame(player.id);
  });
  await wait(1200);
  await shoot('20-won-game.png');

  // ---------------------------------------------------------------------
  // Shot: lost game (EndGameModal, bankruptcy branch).
  // ---------------------------------------------------------------------
  await startTwoPlayerGame(page);
  await page.evaluate(grabServices);
  await page.evaluate(() => {
    const gs = window.__gs;
    const player = gs.stateService.getGameState().players[0];
    gs.stateService.updatePlayer({ id: player.id, money: -8500, timeSpent: 165 });
    gs.stateService.updateGameState({
      isGameOver: true,
      gameEndReason: { type: 'bankruptcy', playerId: player.id },
    });
  });
  await wait(1200);
  await shoot('21-lost-game.png');

  // ---------------------------------------------------------------------
  // Shot: card detail with a real dollar cost. Real click, not injection —
  // PlayerCardDetailV2 opens from local component state (detailCardId), not
  // gameState.
  // ---------------------------------------------------------------------
  await startTwoPlayerGame(page);
  if (await clickByText(page, 'Get Work Packages', { optional: true })) {
    await wait(1500);
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label^="Details for"]');
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      await wait(1000);
      await shoot('22-what-it-costs.png');
    } else {
      console.warn('Could not find a card detail button to click for the cost shot.');
    }
  }

  // ---------------------------------------------------------------------
  // Shot: a term explained (replaces the stale 12-a-word-explained.png,
  // which was captured pre-V2-panel and shows a broken "VISUAL FEED
  // OFFLINE" popup). The base script's best-effort term click is genuinely
  // luck-dependent — OWNER-SCOPE-INITIATION's own narrative has no linked
  // term. ARCH-INITIATION's does ("architect"), so teleport there.
  // ---------------------------------------------------------------------
  await startTwoPlayerGame(page);
  await page.evaluate(grabServices);
  await page.evaluate(() => {
    const gs = window.__gs;
    const player = gs.stateService.getGameState().players[0];
    gs.stateService.updatePlayer({
      id: player.id,
      currentSpace: 'ARCH-INITIATION',
      visitedSpaces: ['OWNER-SCOPE-INITIATION', 'ARCH-INITIATION'],
    });
  });
  await wait(800);
  await page.evaluate(() => {
    const moved = [...document.querySelectorAll('*')].find(
      (n) => /^you moved$/i.test(n.textContent?.trim() || '')
    );
    (moved?.closest('[aria-label^="You moved"]') || moved)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(300);
  await dismissOverlays(page);
  const termClicked = await page.evaluate(() => {
    const term = [...document.querySelectorAll('.dictionary-term-link')]
      .find((t) => t.getBoundingClientRect().width > 0);
    if (term) { term.click(); return true; }
    return false;
  });
  if (termClicked) {
    await wait(1200);
    await shoot('12-a-word-explained.png');
  } else {
    console.warn('Could not find a visible dictionary term link for the word-explained shot.');
  }
} finally {
  await browser.close();
}
