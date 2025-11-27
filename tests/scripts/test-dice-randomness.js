#!/usr/bin/env node
/**
 * Test dice randomness - verify Math.random() * 6 + 1 distribution
 */

// Same logic as TurnService.rollDice()
function rollDice() {
  const roll = Math.floor(Math.random() * 6) + 1;

  // Safety check
  if (roll < 1 || roll > 6) {
    console.error(`Invalid dice roll generated: ${roll}. Rolling again.`);
    return Math.floor(Math.random() * 6) + 1;
  }

  return roll;
}

// Test parameters
const NUM_ROLLS = 10000;

// Track counts
const counts = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
  6: 0
};

// Roll the dice many times
console.log(`Rolling dice ${NUM_ROLLS} times to test distribution...\n`);

for (let i = 0; i < NUM_ROLLS; i++) {
  const roll = rollDice();
  counts[roll]++;
}

// Display results
console.log('Results:');
console.log('========');
for (let i = 1; i <= 6; i++) {
  const count = counts[i];
  const percentage = ((count / NUM_ROLLS) * 100).toFixed(2);
  const expected = 16.67;
  const diff = (parseFloat(percentage) - expected).toFixed(2);
  const bar = '█'.repeat(Math.round(count / 200));

  console.log(`Roll ${i}: ${count.toString().padStart(5)} (${percentage}%)  ${bar}`);
  console.log(`         Expected: 16.67%  Diff: ${diff > 0 ? '+' : ''}${diff}%`);
}

// Statistical test - Chi-square
const expected = NUM_ROLLS / 6;
let chiSquare = 0;
for (let i = 1; i <= 6; i++) {
  const observed = counts[i];
  chiSquare += Math.pow(observed - expected, 2) / expected;
}

console.log('\nChi-Square Test:');
console.log('================');
console.log(`Chi-Square Value: ${chiSquare.toFixed(4)}`);
console.log(`Critical Value (95% confidence): 11.070`);
console.log(`Result: ${chiSquare < 11.070 ? '✅ PASS - Distribution is fair' : '❌ FAIL - Distribution is biased'}`);

// Check for consecutive 3s to match user's experience
console.log('\n\nSimulating 20 consecutive rolls (like user experienced):');
console.log('========================================================');
for (let test = 0; test < 5; test++) {
  const rolls = [];
  let found3 = false;
  for (let i = 0; i < 20; i++) {
    const roll = rollDice();
    rolls.push(roll);
    if (roll === 3) found3 = true;
  }
  console.log(`Test ${test + 1}: ${rolls.join(', ')} - ${found3 ? '✅ Has 3' : '❌ No 3'}`);
}

// Probability calculation
const probNo3in20 = Math.pow(5/6, 20);
console.log(`\nProbability of NO 3 in 20 rolls: ${(probNo3in20 * 100).toFixed(2)}% (about 1 in ${Math.round(1/probNo3in20)} times)`);
