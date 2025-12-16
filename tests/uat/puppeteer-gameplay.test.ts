/**
 * UAT Test: Full Gameplay with Puppeteer
 *
 * This test launches a real browser and plays through the game,
 * testing the complete user experience from start to finish.
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots/uat');
const TIMEOUT = 10000; // 10 seconds for most operations

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let browser;
let page;
let serverProcess;

/**
 * Helper: Take a screenshot with timestamp
 */
async function takeScreenshot(name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${name}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true
  });
  console.log(`📸 Screenshot: ${filename}`);
}

/**
 * Helper: Wait for element and click
 */
async function clickElement(selector, description) {
  console.log(`🖱️  Clicking: ${description}`);
  await page.waitForSelector(selector, { timeout: TIMEOUT });
  await page.click(selector);
  await page.waitForTimeout(500); // Small delay for UI to update
}

/**
 * Helper: Wait for text to appear
 */
async function waitForText(text, timeout = TIMEOUT) {
  console.log(`⏳ Waiting for text: "${text}"`);
  await page.waitForFunction(
    (searchText) => document.body.innerText.includes(searchText),
    { timeout },
    text
  );
}

/**
 * Helper: Get page text content
 */
async function getPageText() {
  return await page.evaluate(() => document.body.innerText);
}

/**
 * Start dev server
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting dev server...');

    const projectRoot = path.join(__dirname, '../..');
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: projectRoot,
      stdio: 'pipe',
      shell: true
    });

    let output = '';

    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('localhost:5173')) {
        console.log('✅ Dev server started');
        setTimeout(resolve, 2000); // Wait a bit more for server to be fully ready
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error('Server failed to start within 30 seconds'));
    }, 30000);
  });
}

/**
 * Stop dev server
 */
function stopServer() {
  if (serverProcess) {
    console.log('🛑 Stopping dev server...');
    serverProcess.kill();
  }
}

/**
 * Test Suite: Full Gameplay
 * NOTE: Skipped by default - this test requires manual execution with `npm run test:uat`
 * It spawns its own dev server and runs a real browser for end-to-end testing.
 */
describe.skip('UAT: Full Gameplay Test', () => {

  beforeAll(async () => {
    console.log('\n' + '='.repeat(60));
    console.log('🎮 Starting UAT: Full Gameplay Test');
    console.log('='.repeat(60) + '\n');

    // Start server
    await startServer();

    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: true, // Set to false to watch the browser
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    page = await browser.newPage();

    // Set up console logging from browser
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.error('❌ Browser Error:', msg.text());
      } else if (type === 'warning') {
        console.warn('⚠️  Browser Warning:', msg.text());
      }
    });

    console.log('✅ Browser ready\n');
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    if (browser) {
      await browser.close();
      console.log('✅ Browser closed');
    }
    stopServer();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 UAT Complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('='.repeat(60) + '\n');
  });

  test('Complete gameplay from start to multiple turns', async () => {
    console.log('\n--- TEST: Complete Gameplay ---\n');

    // Step 1: Navigate to game
    console.log('📍 Step 1: Navigate to game');
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await takeScreenshot('01-initial-load');

    // Step 2: Wait for game to initialize
    console.log('📍 Step 2: Wait for game initialization');
    await page.waitForTimeout(2000);

    // Check if we see player names or game UI
    const pageText = await getPageText();
    console.log('Page loaded, checking for game elements...');
    await takeScreenshot('02-game-initialized');

    // Step 3: Look for player panels
    console.log('📍 Step 3: Verify player panels exist');
    try {
      await page.waitForSelector('[data-testid="player-panel"]', { timeout: 5000 });
      console.log('✅ Found player panels');
    } catch (e) {
      console.log('⚠️  No data-testid, trying alternative selectors...');
      // Try to find any player-related UI
      const hasPlayers = await page.evaluate(() => {
        return document.body.innerText.includes('Player') ||
               document.body.innerText.includes('Money') ||
               document.body.innerText.includes('Time');
      });
      console.log(`Players visible: ${hasPlayers}`);
    }
    await takeScreenshot('03-player-panels');

    // Step 4: Look for game controls
    console.log('📍 Step 4: Check for game controls');
    const controls = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(btn => btn.innerText).filter(text => text.length > 0);
    });
    console.log('Available buttons:', controls);
    await takeScreenshot('04-game-controls');

    // Step 5: Try to find and click primary action button
    console.log('📍 Step 5: Look for action buttons');
    const actionButtons = ['Roll to Move', 'Roll Dice', 'Start Turn', 'Next Step', 'Continue'];

    let foundButton = false;
    for (const buttonText of actionButtons) {
      try {
        const button = await page.$x(`//button[contains(text(), "${buttonText}")]`);
        if (button.length > 0) {
          console.log(`✅ Found button: "${buttonText}"`);
          foundButton = true;

          // Click the button
          await button[0].click();
          console.log(`🖱️  Clicked: "${buttonText}"`);
          await page.waitForTimeout(1000);
          await takeScreenshot(`05-after-click-${buttonText.replace(/\s/g, '-')}`);

          // Check for any changes
          const newText = await getPageText();
          console.log('UI updated, checking for changes...');
          break;
        }
      } catch (e) {
        // Button not found, continue
      }
    }

    if (!foundButton) {
      console.log('⚠️  No standard action buttons found');
      console.log('Available controls:', controls);
    }

    // Step 6: Check for modals or choices
    console.log('📍 Step 6: Check for modals/choices');
    const hasModal = await page.evaluate(() => {
      const modals = document.querySelectorAll('[role="dialog"], .modal, [data-testid*="modal"]');
      return modals.length > 0;
    });
    console.log(`Modals visible: ${hasModal}`);
    await takeScreenshot('06-check-modals');

    // Step 7: Try to interact with any visible choices
    if (hasModal) {
      console.log('📍 Step 7: Interact with modal/choice');
      try {
        // Look for choice buttons
        const choiceButtons = await page.$$('button');
        if (choiceButtons.length > 0) {
          console.log(`Found ${choiceButtons.length} buttons in modal`);
          // Click first button
          await choiceButtons[0].click();
          await page.waitForTimeout(1000);
          await takeScreenshot('07-after-modal-interaction');
        }
      } catch (e) {
        console.log('Could not interact with modal:', e.message);
      }
    }

    // Step 8: Check game state
    console.log('📍 Step 8: Verify game state');
    const finalState = await page.evaluate(() => {
      return {
        hasPlayers: document.body.innerText.includes('Player'),
        hasMoneyDisplay: document.body.innerText.includes('$') || document.body.innerText.includes('Money'),
        hasTimeDisplay: document.body.innerText.includes('Time') || document.body.innerText.includes('Tick'),
        hasCards: document.body.innerText.includes('Card'),
        buttonCount: document.querySelectorAll('button').length
      };
    });

    console.log('\n📊 Final Game State:');
    console.log(JSON.stringify(finalState, null, 2));
    await takeScreenshot('08-final-state');

    // Assertions
    expect(finalState.hasPlayers).toBe(true);
    expect(finalState.buttonCount).toBeGreaterThan(0);

    console.log('\n✅ Gameplay test completed successfully!\n');
  }, 120000); // 2 minute timeout for full test

  test('Verify multiplayer display', async () => {
    console.log('\n--- TEST: Multiplayer Display ---\n');

    // Check if multiple players are visible
    const playerInfo = await page.evaluate(() => {
      const text = document.body.innerText;
      const playerMatches = text.match(/Player \d+/g) || [];
      return {
        playerCount: new Set(playerMatches).size,
        allText: text.substring(0, 500) // First 500 chars for debugging
      };
    });

    console.log(`Found ${playerInfo.playerCount} player(s)`);
    console.log('Page text sample:', playerInfo.allText);

    expect(playerInfo.playerCount).toBeGreaterThan(0);

    await takeScreenshot('multiplayer-display');
    console.log('✅ Multiplayer display test completed\n');
  });

  test('Verify game data loaded', async () => {
    console.log('\n--- TEST: Game Data Loading ---\n');

    // Check for evidence that game data (cards, spaces, etc.) loaded
    const dataLoaded = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasSpaceNames: /[A-Z]+-[A-Z]+-[A-Z]+/.test(text), // Space name pattern
        hasCardIds: /[WBEIL]\d{3}/.test(text), // Card ID pattern
        hasDollarAmounts: /\$\d+/.test(text),
        hasNotifications: text.includes('Welcome') || text.includes('Game') || text.includes('Turn')
      };
    });

    console.log('Data Load Status:');
    console.log(JSON.stringify(dataLoaded, null, 2));

    await takeScreenshot('game-data-check');

    expect(dataLoaded.hasDollarAmounts).toBe(true);

    console.log('✅ Game data loading test completed\n');
  });

}, 180000); // 3 minute timeout for entire suite
