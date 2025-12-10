/**
 * Test to verify dice roll button appears at PM-DECISION-CHECK
 *
 * This test investigates why the dice roll button is not appearing
 * even though hasRolled: false and required actions: 2
 */

import { DataService } from '../../src/services/DataService.js';

console.log('\n' + '='.repeat(80));
console.log('🎲 PM-DECISION-CHECK Dice Button Investigation');
console.log('='.repeat(80) + '\n');

// Initialize DataService
const dataService = new DataService();

// Check PM-DECISION-CHECK configuration
console.log('📍 STEP 1: Check PM-DECISION-CHECK space configuration');
console.log('-'.repeat(80));

const spaceData = dataService.getSpaceByName('PM-DECISION-CHECK');
console.log('Space data:', JSON.stringify(spaceData, null, 2));

// Check if requires_dice_roll is set
const requiresManualDiceRoll = spaceData?.config?.requires_dice_roll ?? true;
console.log(`\nrequires_dice_roll: ${requiresManualDiceRoll} (should be true)`);

// Check space effects
console.log('\n📍 STEP 2: Check PM-DECISION-CHECK space effects (First visit)');
console.log('-'.repeat(80));

const spaceEffects = dataService.getSpaceEffects('PM-DECISION-CHECK', 'First');
console.log(`Found ${spaceEffects.length} space effects:`);
spaceEffects.forEach((effect, index) => {
  console.log(`\n  Effect ${index + 1}:`);
  console.log(`    - type: ${effect.effect_type}`);
  console.log(`    - action: ${effect.effect_action}`);
  console.log(`    - value: ${effect.effect_value}`);
  console.log(`    - trigger: ${effect.trigger_type}`);
  console.log(`    - description: ${effect.description || effect.effect_description || 'N/A'}`);
});

// Check for manual effects that require actions
const manualEffects = spaceEffects.filter(effect => effect.trigger_type === 'manual');
console.log(`\n  Manual effects: ${manualEffects.length}`);

// Check dice effects
console.log('\n📍 STEP 3: Check PM-DECISION-CHECK dice effects');
console.log('-'.repeat(80));

const diceEffects = dataService.getDiceEffects('PM-DECISION-CHECK', 'First');
console.log(`Found ${diceEffects.length} dice effects:`);
diceEffects.forEach((effect, index) => {
  console.log(`\n  Dice Effect ${index + 1}:`);
  console.log(`    - description: ${effect.description || 'N/A'}`);
});

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 SUMMARY');
console.log('='.repeat(80));
console.log(`✅ Space requires manual dice roll: ${requiresManualDiceRoll}`);
console.log(`✅ Manual effects found: ${manualEffects.length}`);
console.log(`✅ Dice effects found: ${diceEffects.length}`);

console.log('\n💡 DIAGNOSIS:');
console.log('   - PM-DECISION-CHECK is configured correctly');
console.log('   - The issue is likely in how TurnControlsWithActions calculates canRollDice');
console.log('   - Need to check the following conditions:');
console.log('     1. awaitingChoice state (might be blocking dice roll)');
console.log('     2. hasPlayerMovedThisTurn (should be false)');
console.log('     3. isProcessingTurn (should be false)');
console.log('='.repeat(80) + '\n');
