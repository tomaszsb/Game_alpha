# Game Alpha - AI Testing Prompt for Perplexity

## Objective
Play Game Alpha for 10-15 turns with the goal of maximizing financial gain. Test core game mechanics, identify bugs, and report on user experience.

## Setup
1. Navigate to the game URL (will be provided by user)
2. Open browser console (F12) to monitor logs
3. Start a new game with 2-4 players
4. You will be Player 1

## Core Gameplay Actions (Perform Throughout Test)
- Click "Roll the Dice" or "Roll to Move" buttons when available
- Make movement choices when presented
- Draw cards when prompted
- Complete required actions (e.g., "Replace 1 E card")
- Monitor the action counter (e.g., "1/2 actions completed")
- Click "End Turn" only when all actions are complete

## Specific Test Cases

### Test 1: PM-DECISION-CHECK Space
**Goal:** Verify conditional dice effects are optional

**Steps:**
1. Try to land on the space named "PM-DECISION-CHECK"
2. When you land there, you'll see "Replace 1 E cards" as a required action
3. Complete that action (click button to replace an E card)
4. **Check:** Does the action counter show "1/1" or "2/2"?
5. **Check:** Do movement destination buttons appear immediately?
6. **Expected:** Should show "1/1" and allow movement without dice roll
7. **Report:** Actual counter value and whether movement was allowed

### Test 2: Multi-Path Movement Bug
**Goal:** Test if clicking a destination causes premature movement

**Steps:**
1. Land on a space that offers multiple movement paths (multiple destination buttons)
2. Click ONE destination button
3. **DO NOT click "End Turn" yet**
4. **Check:** Did the player piece move immediately?
5. **Expected:** Player should NOT move until "End Turn" is clicked
6. **Report:** Did movement happen before or after "End Turn"?

### Test 3: Dice Outcome Spaces
**Goal:** Verify dice-based movement works correctly

**Steps:**
1. Try to land on "CHEAT-BYPASS" or similar dice outcome spaces
2. **Check:** Does it show "Roll to Move" button?
3. Click the button and roll the dice
4. **Check:** Does a single destination appear in a modal?
5. **Check:** Can you select it and move successfully?
6. **Report:** Describe the flow and any issues

### Test 4: Card Effects with Duration
**Goal:** Verify effects persist and expire correctly

**Steps:**
1. Play any card that has a duration (e.g., "3 turns")
2. Note which effect it applies
3. **Check:** Does the effect persist across multiple turns?
4. **Check:** When it expires, do you see a notification?
5. **Report:** Effect behavior and expiration handling

### Test 5: Turn Sequence & UI States
**Goal:** Verify smooth turn transitions

**Steps:**
1. Complete several full turns
2. **Check:** Is "End Turn" disabled during wait periods?
3. **Check:** Do you see banner notifications (not full-screen overlays)?
4. **Check:** Do turn transitions feel smooth?
5. **Report:** Any confusing UI states or delays

### Test 6: Action Counter Accuracy
**Goal:** Verify action tracking is correct

**Steps:**
1. Throughout gameplay, monitor the "X/Y actions completed" counter
2. **Check:** Does it accurately reflect required vs completed actions?
3. **Check:** Can you move only when all actions are complete?
4. **Report:** Any instances where the counter seemed wrong

## Console Log Monitoring
**Watch for:**
- React errors or warnings
- Log messages containing "WARN" or "ERROR"
- TypeScript errors
- Any unusual network requests

## Final Report
After 10-15 turns, provide:

1. **Summary:** Overall experience (smooth, confusing, buggy, etc.)
2. **Test Results:** For each test case above, report findings
3. **Bugs Found:** Any unexpected behavior or errors
4. **Confusing Moments:** UX issues or unclear instructions
5. **Console Logs:** Full console output (copy/paste entire console)
6. **Financial Outcome:** Your final cash/assets value

## Success Criteria
- Complete 10-15 turns without crashes
- Successfully test all 6 test cases
- Provide detailed feedback on each test
- Capture complete console logs
