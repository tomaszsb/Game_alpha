/**
 * PM-DECISION-CHECK Bug Fix Test
 *
 * Tests the specific bug where End Turn button remains disabled
 * after completing the "Replace 1 E card" manual action.
 *
 * Run with: node tests/uat/test-pm-decision-check.js
 */

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(__dirname, '../../screenshots/uat');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `${timestamp}_${name}.png`;
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: true
  });
  console.log(`  📸 Screenshot: ${filename}`);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForButton(page, buttonText, maxWait = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.map(btn => ({
        text: btn.innerText || btn.textContent || '',
        visible: btn.offsetParent !== null,
        disabled: btn.disabled
      }));
    });

    const found = buttons.find(btn =>
      btn.text.includes(buttonText) && btn.visible && !btn.disabled
    );

    if (found) return true;
    await delay(500);
  }
  return false;
}

async function clickButton(page, buttonText) {
  const clicked = await page.evaluate((searchText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => {
      const text = btn.innerText || btn.textContent || '';
      return text.includes(searchText) &&
             btn.offsetParent !== null &&
             !btn.disabled;
    });

    if (button) {
      button.click();
      return true;
    }
    return false;
  }, buttonText);

  if (clicked) {
    console.log(`  ✅ Clicked: "${buttonText}"`);
    await delay(1000); // Wait for state update
    return true;
  } else {
    console.log(`  ❌ Button not found or not clickable: "${buttonText}"`);
    return false;
  }
}

async function getButtonState(page, buttonText) {
  return await page.evaluate((searchText) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => {
      const text = btn.innerText || btn.textContent || '';
      return text.includes(searchText);
    });

    if (button) {
      return {
        found: true,
        text: button.innerText || button.textContent,
        visible: button.offsetParent !== null,
        disabled: button.disabled
      };
    }
    return { found: false };
  }, buttonText);
}

async function runTest() {
  console.log('\n' + '='.repeat(80));
  console.log('🎮 PM-DECISION-CHECK Bug Fix Test');
  console.log('='.repeat(80) + '\n');

  let browser;

  try {
    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: true, // Run in headless mode for automation
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Capture browser console logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);

      // Show important debug logs
      if (text.includes('🎯') || text.includes('Recording completed') || text.includes('updateActionCounts')) {
        console.log(`  📋 Browser: ${text}`);
      }
    });

    console.log('✅ Browser ready\n');

    // Step 1: Load game
    console.log('📍 STEP 1: Load Game');
    console.log('-'.repeat(80));
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000); // Wait for React and game initialization
    await takeScreenshot(page, '01-game-loaded');
    console.log('  ✅ Game loaded\n');

    // Step 2: Check initial state
    console.log('📍 STEP 2: Verify Initial UI');
    console.log('-'.repeat(80));
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns
        .filter(btn => btn.offsetParent !== null)
        .map(btn => ({
          text: (btn.innerText || btn.textContent || '').trim(),
          disabled: btn.disabled
        }))
        .filter(btn => btn.text.length > 0);
    });

    console.log(`  📊 Found ${buttons.length} visible buttons:`);
    buttons.slice(0, 15).forEach(btn => {
      console.log(`     - "${btn.text}" ${btn.disabled ? '(disabled)' : ''}`);
    });
    await takeScreenshot(page, '02-initial-buttons');
    console.log('');

    // Step 3: Navigate to PM-DECISION-CHECK
    console.log('📍 STEP 3: Navigate to PM-DECISION-CHECK');
    console.log('-'.repeat(80));

    // Click Roll to Move button
    console.log('  Attempting to roll dice...');
    const rolled = await clickButton(page, 'Roll');
    if (!rolled) {
      console.log('  ⚠️  No Roll button found - checking current state...');
    }
    await delay(2000);
    await takeScreenshot(page, '03-after-roll');

    // Check current space
    const currentSpace = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/📍\s*([A-Z]+-[A-Z]+-[A-Z]+)/);
      return match ? match[1] : null;
    });

    console.log(`  📍 Current space: ${currentSpace || 'Unknown'}`);

    if (currentSpace !== 'PM-DECISION-CHECK') {
      console.log('  ⚠️  Not at PM-DECISION-CHECK yet. Test requires manual navigation.');
      console.log('  💡 Please manually navigate to PM-DECISION-CHECK and then re-run this test.');
      return;
    }
    console.log('  ✅ At PM-DECISION-CHECK\n');

    // Step 4: Check for "Replace 1 E card" button
    console.log('📍 STEP 4: Verify "Replace 1 E card" Button');
    console.log('-'.repeat(80));

    await delay(2000); // Wait for manual actions to appear
    const replaceButton = await getButtonState(page, 'Replace 1 E card');

    if (!replaceButton.found) {
      console.log('  ❌ "Replace 1 E card" button not found!');
      console.log('  💡 Button text might be incorrect. Checking all card-related buttons:');
      const cardButtons = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns
          .filter(btn => {
            const text = (btn.innerText || btn.textContent || '').toLowerCase();
            return (text.includes('card') || text.includes('replace') || text.includes('pick'))
                   && btn.offsetParent !== null;
          })
          .map(btn => ({
            text: btn.innerText || btn.textContent,
            disabled: btn.disabled
          }));
      });

      cardButtons.forEach(btn => {
        console.log(`     - "${btn.text}" ${btn.disabled ? '(disabled)' : ''}`);
      });

      await takeScreenshot(page, '04-button-not-found');
      return;
    }

    console.log(`  ✅ Found button: "${replaceButton.text}"`);
    console.log(`     - Visible: ${replaceButton.visible}`);
    console.log(`     - Disabled: ${replaceButton.disabled}`);
    await takeScreenshot(page, '04-replace-button-found');
    console.log('');

    // Step 5: Click "Replace 1 E card" button
    console.log('📍 STEP 5: Click "Replace 1 E card" Button');
    console.log('-'.repeat(80));

    const clickedReplace = await clickButton(page, 'Replace 1 E card');
    if (!clickedReplace) {
      console.log('  ❌ Failed to click button!');
      return;
    }

    await delay(2000); // Wait for modal to appear
    await takeScreenshot(page, '05-after-click-replace');
    console.log('');

    // Step 6: Select a card in the modal
    console.log('📍 STEP 6: Select Card in CardReplacementModal');
    console.log('-'.repeat(80));

    // Look for card selection buttons in the modal
    const cardOptions = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns
        .filter(btn => {
          const text = (btn.innerText || btn.textContent || '').toLowerCase();
          return text.includes('card') && btn.offsetParent !== null && !btn.disabled;
        })
        .map(btn => ({
          text: btn.innerText || btn.textContent
        }));
    });

    console.log(`  📊 Found ${cardOptions.length} card options in modal:`);
    cardOptions.slice(0, 5).forEach(opt => {
      console.log(`     - "${opt.text}"`);
    });

    if (cardOptions.length > 0) {
      // Click the first card option
      const selectedCard = await clickButton(page, cardOptions[0].text);
      if (selectedCard) {
        await delay(2000); // Wait for action to complete
        await takeScreenshot(page, '06-card-selected');
      }
    } else {
      console.log('  ⚠️  No card options found in modal');
    }
    console.log('');

    // Step 7: Check End Turn button state
    console.log('📍 STEP 7: Verify End Turn Button State');
    console.log('-'.repeat(80));

    await delay(2000); // Wait for state update
    const endTurnButton = await getButtonState(page, 'End Turn');

    if (!endTurnButton.found) {
      console.log('  ❌ End Turn button not found!');
      await takeScreenshot(page, '07-end-turn-not-found');
      return;
    }

    console.log(`  📊 End Turn Button State:`);
    console.log(`     - Text: "${endTurnButton.text}"`);
    console.log(`     - Visible: ${endTurnButton.visible}`);
    console.log(`     - Disabled: ${endTurnButton.disabled}`);

    await takeScreenshot(page, '07-end-turn-final-state');

    if (endTurnButton.disabled) {
      console.log('  ❌ BUG STILL EXISTS: End Turn button is disabled!');

      // Show action counts from console logs
      console.log('\n  📋 Relevant console logs:');
      consoleLogs.filter(log =>
        log.includes('requiredActions') ||
        log.includes('completedActionCount') ||
        log.includes('Recording completed')
      ).forEach(log => {
        console.log(`     ${log}`);
      });

      return;
    } else {
      console.log('  ✅ SUCCESS: End Turn button is ENABLED!');
      console.log('  🎉 Bug fix confirmed working!');
    }

    console.log('');

    // Step 8: Final verification
    console.log('📍 STEP 8: Final Verification');
    console.log('-'.repeat(80));
    console.log('  📊 Console log analysis:');

    const hasCompletionLog = consoleLogs.some(log =>
      log.includes('Recording completed manual action: cards')
    );
    const hasUpdateLog = consoleLogs.some(log =>
      log.includes('updateActionCounts completed')
    );

    console.log(`     - Manual action recorded: ${hasCompletionLog ? '✅' : '❌'}`);
    console.log(`     - Action counts updated: ${hasUpdateLog ? '✅' : '❌'}`);

    await takeScreenshot(page, '08-final-verification');
    console.log('');

  } catch (error) {
    console.error(`\n❌ Test error: ${error.message}`);
    console.error(error.stack);
  } finally {
    if (browser) {
      console.log('\n⏳ Closing browser in 3 seconds...');
      await delay(3000);
      await browser.close();
      console.log('✅ Browser closed\n');
    }
  }

  console.log('='.repeat(80));
  console.log('📁 Screenshots saved to: ' + SCREENSHOT_DIR);
  console.log('='.repeat(80) + '\n');
}

// Run the test
runTest()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
