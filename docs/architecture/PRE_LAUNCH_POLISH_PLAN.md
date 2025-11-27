# Pre-Launch Polish Plan
## Code2027 - Production Readiness Checklist

**Timeline:** 2-3 days (16-20 hours)
**Goal:** Remove debug code, add error handling, prepare for production release
**Status:** Ready for execution

---

## Executive Summary

This document outlines the minimal changes required to move Code2027 from development to production-ready state. All core functionality is working (617 tests passing), but debug code and development artifacts need removal before public release.

**Success Criteria:**
- Zero console.log statements in production code
- No debug components accessible to players
- User-facing error messages for all error states
- All tests still passing
- Technical debt documented for future work

---

## Task Breakdown

### Phase 1: Debug Code Removal (6-8 hours)

#### Task 1.1: Remove Console.log Statements
**Priority:** CRITICAL
**Estimated Time:** 3-4 hours
**Risk:** LOW (no functional changes)

**Locations to clean:**
1. `src/services/TurnService.ts` - ~40 console.log statements
2. `src/services/EffectEngineService.ts` - ~30 console.log statements
3. `src/services/CardService.ts` - ~15 console.log statements
4. `src/services/StateService.ts` - ~10 console.log statements
5. `src/components/layout/GameLayout.tsx` - ~8 console.log statements
6. `src/components/game/TurnControlsWithActions.tsx` - ~5 console.log statements
7. Other components - ~10 console.log statements

**Execution Steps:**
```bash
# 1. Search for all console.log statements
grep -r "console.log" src/ --include="*.ts" --include="*.tsx" > console_log_audit.txt

# 2. Review each instance and determine:
#    - DELETE: Debug statements (e.g., "🎯 DEBUG:", "🔧 EFFECT_ENGINE:")
#    - KEEP: Critical error logging (e.g., console.error for exceptions)
#    - CONVERT: Important logs → LoggingService

# 3. Batch delete debug statements
# 4. Convert critical logs to LoggingService
# 5. Run tests to ensure nothing broke
```

**Acceptance Criteria:**
- [ ] Zero `console.log` statements with emoji indicators (🎯, 🔧, 🎲, etc.)
- [ ] `console.error` only for unrecoverable errors
- [ ] All tests still passing
- [ ] No functional behavior changes

**Files to modify:**
- `src/services/TurnService.ts` (lines with console.log)
- `src/services/EffectEngineService.ts` (lines with console.log)
- `src/services/CardService.ts` (lines with console.log)
- `src/services/StateService.ts` (lines with console.log)
- `src/services/MovementService.ts` (lines with console.log)
- `src/components/layout/GameLayout.tsx` (lines with console.log)
- `src/components/game/TurnControlsWithActions.tsx` (lines with console.log)
- `src/components/player/PlayerPanel.tsx` (lines with console.log)

---

#### Task 1.2: Remove Debug Components
**Priority:** CRITICAL
**Estimated Time:** 1 hour
**Risk:** LOW (features not used in production)

**Components to remove/disable:**

1. **DataEditor Component**
   - File: `src/components/editor/DataEditor.tsx`
   - Referenced in: `src/components/layout/GameLayout.tsx`
   - Action: Remove from GameLayout, keep file for development mode

2. **PlayerDebug Component**
   - File: `src/components/debug/PlayerDebug.tsx`
   - Action: Verify not imported in any production components

3. **Debug State Variables**
   - `isDataEditorOpen` in GameLayout.tsx
   - Remove toggle buttons for debug panels

**Execution Steps:**
```typescript
// In GameLayout.tsx:
// 1. Remove DataEditor import
// 2. Remove isDataEditorOpen state
// 3. Remove debug toggle buttons
// 4. Remove conditional rendering of DataEditor

// Before:
import { DataEditor } from '../editor/DataEditor';
const [isDataEditorOpen, setIsDataEditorOpen] = useState(false);
{isDataEditorOpen && <DataEditor ... />}

// After:
// Remove all of the above
```

**Acceptance Criteria:**
- [ ] DataEditor not accessible in production build
- [ ] No debug panels visible in UI
- [ ] All tests still passing
- [ ] Build size reduced

---

#### Task 1.3: Remove Development Comments
**Priority:** MEDIUM
**Estimated Time:** 1-2 hours
**Risk:** LOW (documentation cleanup)

**Types of comments to remove:**
1. "TODO:" comments for completed work
2. "HACK:" or "FIXME:" without context
3. Commented-out code blocks
4. Debug comments (e.g., "// Testing this approach")

**Keep:**
1. JSDoc documentation comments
2. Complex algorithm explanations
3. "TODO:" with tracked issue numbers
4. Legal/license comments

**Execution Steps:**
```bash
# Find all TODO/FIXME/HACK comments
grep -rn "TODO:\|FIXME:\|HACK:" src/ --include="*.ts" --include="*.tsx"

# Find commented-out code blocks
grep -rn "^[[:space:]]*\/\/" src/ --include="*.ts" --include="*.tsx" | less

# Review and clean up
```

**Acceptance Criteria:**
- [ ] No untracked TODO comments
- [ ] No commented-out code blocks
- [ ] JSDoc comments preserved
- [ ] Code clarity maintained

---

#### Task 1.4: Clean Up Test Console Output
**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Risk:** LOW (test improvements)

**Actions:**
1. Remove console.log from test files
2. Configure Vitest to suppress non-error output
3. Ensure test failures are still visible

**Files to modify:**
- `vitest.config.dev.ts` - Add silent mode for passing tests
- `vitest.config.ci.ts` - Ensure CI output is clean
- Test files with excessive logging

**Acceptance Criteria:**
- [ ] Test runs show only test results
- [ ] Passing tests don't log to console
- [ ] Failing tests show clear error messages

---

### Phase 2: User-Facing Error Handling (4-6 hours)

#### Task 2.1: Add Error Boundaries
**Priority:** HIGH
**Estimated Time:** 2 hours
**Risk:** LOW (safety net addition)

**Create Error Boundary Component:**

```typescript
// src/components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service (future)
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>The game encountered an error. Please refresh the page.</p>
          <button onClick={() => window.location.reload()}>
            Reload Game
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Implementation locations:**
1. Wrap entire App in ErrorBoundary
2. Wrap GameLayout in ErrorBoundary
3. Wrap individual modals in ErrorBoundary

**Acceptance Criteria:**
- [ ] App doesn't crash to white screen
- [ ] User sees friendly error message
- [ ] Reload button available
- [ ] Errors still logged for debugging

---

#### Task 2.2: Add User-Facing Error Messages
**Priority:** HIGH
**Estimated Time:** 2-3 hours
**Risk:** MEDIUM (changes error handling flow)

**Current state:** Errors logged to console, user sees nothing
**Desired state:** Errors shown to user with recovery options

**Locations to add error messages:**

1. **Card Operations** (`CardService.ts`)
   ```typescript
   // Current:
   catch (error) {
     console.error('Failed to play card:', error);
     return false;
   }

   // New:
   catch (error) {
     const message = 'Unable to play this card. Please check your resources and try again.';
     notificationService.notifyError(message, currentPlayerId);
     throw new Error(message);
   }
   ```

2. **Turn Operations** (`TurnService.ts`)
   ```typescript
   // Add error messages for:
   - Failed dice roll
   - Invalid movement
   - Unable to end turn
   - Try Again not available
   ```

3. **Movement** (`MovementService.ts`)
   ```typescript
   // Add error messages for:
   - Invalid destination
   - Movement not allowed
   - Path not available
   ```

4. **Resource Operations** (`ResourceService.ts`)
   ```typescript
   // Current: silent failure
   // New: "Insufficient funds" notification
   ```

**Create Error Notification Utility:**
```typescript
// src/utils/ErrorNotifications.ts
export const ErrorNotifications = {
  insufficientFunds: (required: number, available: number) => ({
    short: '❌ Not enough money',
    medium: `Need $${required}, have $${available}`,
    detailed: `Cannot complete action. Required: $${required}, Available: $${available}`
  }),

  invalidMove: (destination: string) => ({
    short: '❌ Invalid move',
    medium: `Cannot move to ${destination}`,
    detailed: `Movement to ${destination} is not available from your current space`
  }),

  cardPlayFailed: (cardName: string, reason: string) => ({
    short: '❌ Cannot play card',
    medium: `${cardName} cannot be played`,
    detailed: `Cannot play ${cardName}: ${reason}`
  }),

  turnActionFailed: (action: string) => ({
    short: '❌ Action failed',
    medium: `Cannot ${action}`,
    detailed: `Unable to complete ${action}. Please check requirements.`
  })
};
```

**Acceptance Criteria:**
- [ ] All service errors show user-facing messages
- [ ] Error messages are actionable (tell user what to do)
- [ ] NotificationService displays errors prominently
- [ ] Errors don't crash the game
- [ ] Users can recover from errors

---

#### Task 2.3: Add Loading States
**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Risk:** LOW (UX improvement)

**Add loading indicators for:**
1. Game initialization
2. Data loading (CSV files)
3. Turn processing
4. Card operations

**Implementation:**
```typescript
// Add loading states to:
- App.tsx: Data loading
- GameLayout.tsx: Turn processing
- Modals: Async operations
```

**Acceptance Criteria:**
- [ ] User never sees frozen UI
- [ ] Loading spinners show during operations
- [ ] Clear feedback when operations complete

---

### Phase 3: Documentation & Configuration (4-6 hours)

#### Task 3.1: Create Technical Debt Register
**Priority:** HIGH
**Estimated Time:** 2 hours
**Risk:** NONE (documentation)

**Create:** `docs/TECHNICAL_DEBT.md`

**Structure:**
```markdown
# Technical Debt Register

## Priority 1: Critical (Address within 1-2 months)
- [ ] Remove circular dependencies (TurnService ↔ EffectEngineService)
- [ ] Consolidate modal system (create BaseModal)
- [ ] Fix type safety violations (undefined as any)

## Priority 2: High (Address within 3-4 months)
- [ ] Break apart TurnService (2,773 lines → multiple services)
- [ ] Extract effect handlers from EffectEngineService
- [ ] Unify CardService effect processing (remove dual system)

## Priority 3: Medium (Address within 5-6 months)
- [ ] Standardize styling (CSS-in-JS or CSS modules)
- [ ] Improve accessibility (ARIA labels, keyboard nav)
- [ ] Component memoization for performance

## Known Issues (Non-Blocking)
- Console.log statements removed but LoggingService could be enhanced
- Modal z-index stacking could be improved
- Responsive design needs mobile breakpoints

## Architectural Improvements (Future)
- Event-based architecture to eliminate circular dependencies
- Effect handler abstraction pattern
- State management with selectors/memoization
```

**Acceptance Criteria:**
- [ ] All known issues documented
- [ ] Priority levels assigned
- [ ] Effort estimates provided
- [ ] Linked to specific code locations

---

#### Task 3.2: Update Production Configuration
**Priority:** HIGH
**Estimated Time:** 1 hour
**Risk:** LOW (environment config)

**Files to update:**

1. **vite.config.ts**
   ```typescript
   // Add production optimizations
   export default defineConfig({
     build: {
       minify: 'terser',
       sourcemap: false, // Disable in production
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom'],
             services: ['./src/services/DataService', ...],
           },
         },
       },
     },
   });
   ```

2. **package.json**
   ```json
   {
     "scripts": {
       "build": "NODE_ENV=production vite build",
       "build:dev": "vite build",
       "preview": "vite preview",
       "lint:prod": "eslint src/**/*.{ts,tsx} --max-warnings 0"
     }
   }
   ```

3. **Create .env files**
   ```bash
   # .env.production
   VITE_APP_ENV=production
   VITE_DEBUG_MODE=false
   VITE_ENABLE_EDITOR=false

   # .env.development
   VITE_APP_ENV=development
   VITE_DEBUG_MODE=true
   VITE_ENABLE_EDITOR=true
   ```

**Acceptance Criteria:**
- [ ] Production build optimized
- [ ] Sourcemaps disabled in production
- [ ] Debug features disabled in production
- [ ] Environment variables configured

---

#### Task 3.3: Create Release Documentation
**Priority:** MEDIUM
**Estimated Time:** 2 hours
**Risk:** NONE (documentation)

**Documents to create:**

1. **docs/RELEASE_NOTES_v1.0.md**
   ```markdown
   # Code2027 v1.0 Release Notes

   ## Features
   - Full game implementation with 55+ board spaces
   - 5 card types (W, B, E, L, I) with unique mechanics
   - Multi-player support (2-4 players)
   - Strategic "Try Again" mechanic
   - Negotiation system
   - Resource management (money, time, scope)

   ## Known Limitations
   - Desktop-optimized (mobile support partial)
   - English language only
   - Local play only (no online multiplayer)

   ## Technical Notes
   - 617 tests passing
   - React 18 + TypeScript 5
   - Data-driven design (CSV configuration)
   ```

2. **docs/DEPLOYMENT_GUIDE.md**
   ```markdown
   # Deployment Guide

   ## Prerequisites
   - Node.js 18+
   - npm 9+

   ## Build Steps
   1. `npm install`
   2. `npm run build`
   3. Deploy `dist/` folder to hosting

   ## Environment Variables
   - See .env.production for required variables

   ## Post-Deployment Checks
   - [ ] Game loads without errors
   - [ ] Players can complete a full game
   - [ ] All modals open/close correctly
   ```

3. **docs/USER_GUIDE.md**
   ```markdown
   # Code2027 User Guide

   ## Getting Started
   - Add 2-4 players
   - Click "Start Game"
   - Follow on-screen instructions

   ## Game Mechanics
   - [Link to GAME_ACTIONS_GUIDE.md]

   ## Troubleshooting
   - If game freezes, refresh the page
   - If cards don't appear, check that you have drawn cards
   - If movement stuck, check that you've completed all required actions
   ```

**Acceptance Criteria:**
- [ ] Release notes complete
- [ ] Deployment guide tested
- [ ] User guide covers common issues
- [ ] All docs in `/docs` folder

---

#### Task 3.4: Update README.md
**Priority:** MEDIUM
**Estimated Time:** 1 hour
**Risk:** NONE (documentation)

**Update README with:**
1. Production-ready status
2. Installation instructions
3. Build instructions
4. Link to user guide
5. Link to technical documentation
6. Known limitations
7. Support information

**Acceptance Criteria:**
- [ ] README reflects production status
- [ ] All links work
- [ ] Installation steps verified
- [ ] Screenshots added (optional)

---

### Phase 4: Testing & Validation (2-4 hours)

#### Task 4.1: Full Test Suite Run
**Priority:** CRITICAL
**Estimated Time:** 30 minutes
**Risk:** NONE (verification)

**Execute:**
```bash
# Run all tests
npm run test

# Run E2E tests
npm run test:e2e

# Run component tests
npm run test:components

# Run service tests
npm run test:services

# Verify all 617 tests pass
```

**Acceptance Criteria:**
- [ ] All 617 tests passing
- [ ] No test failures
- [ ] No test warnings
- [ ] Test coverage maintained

---

#### Task 4.2: Manual QA Testing
**Priority:** CRITICAL
**Estimated Time:** 2-3 hours
**Risk:** NONE (verification)

**Test Scenarios:**

1. **Complete Game Playthrough**
   - [ ] Add 2 players
   - [ ] Start game
   - [ ] Play through all phases (SETUP → OWNER → DESIGN → FUNDING → REGULATORY → CONSTRUCTION → END)
   - [ ] Complete game to FINISH space
   - [ ] Verify winner declared
   - [ ] Check score calculation

2. **Card Operations**
   - [ ] Draw cards of each type (W, B, E, L, I)
   - [ ] Play cards with effects
   - [ ] Verify resource changes
   - [ ] Transfer E/L cards between players
   - [ ] Discard cards

3. **Movement & Choices**
   - [ ] Dice rolls trigger correct effects
   - [ ] Movement choices display correctly
   - [ ] Path selection updates player position
   - [ ] Visit type changes (First → Subsequent)

4. **Try Again Feature**
   - [ ] Use Try Again on negotiable space
   - [ ] Verify state reverts
   - [ ] Verify time penalty applied
   - [ ] Try Again again on same space

5. **Edge Cases**
   - [ ] Insufficient funds for card play
   - [ ] No cards left in deck
   - [ ] Skip turn modifier
   - [ ] Multiple players at same space

6. **Error States**
   - [ ] Invalid actions show error messages
   - [ ] User can recover from errors
   - [ ] No white screen crashes

**Acceptance Criteria:**
- [ ] All scenarios pass
- [ ] No console errors
- [ ] No visual glitches
- [ ] User experience smooth

---

#### Task 4.3: Production Build Test
**Priority:** CRITICAL
**Estimated Time:** 1 hour
**Risk:** LOW (verification)

**Execute:**
```bash
# Build production version
npm run build

# Preview production build
npm run preview

# Test production build
- Load game
- Complete one full game
- Verify no errors in console
- Check bundle size
- Verify no sourcemaps
```

**Acceptance Criteria:**
- [ ] Production build succeeds
- [ ] No build warnings
- [ ] Bundle size reasonable (<2MB)
- [ ] No debug code in build
- [ ] Game runs in production mode

---

#### Task 4.4: Cross-Browser Testing
**Priority:** HIGH
**Estimated Time:** 1 hour
**Risk:** LOW (verification)

**Test in:**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Verify:**
- [ ] Game loads in all browsers
- [ ] No visual differences
- [ ] All interactions work
- [ ] Modals display correctly

**Acceptance Criteria:**
- [ ] Works in all major browsers
- [ ] No browser-specific bugs
- [ ] Consistent experience

---

## Execution Schedule

### Day 1 (8 hours)
- **Morning (4 hours):**
  - Task 1.1: Remove console.log statements (3-4 hours)
  - Task 1.2: Remove debug components (1 hour)

- **Afternoon (4 hours):**
  - Task 1.3: Remove development comments (1-2 hours)
  - Task 1.4: Clean up test console output (1 hour)
  - Task 2.1: Add error boundaries (2 hours)

### Day 2 (8 hours)
- **Morning (4 hours):**
  - Task 2.2: Add user-facing error messages (2-3 hours)
  - Task 2.3: Add loading states (1 hour)

- **Afternoon (4 hours):**
  - Task 3.1: Create technical debt register (2 hours)
  - Task 3.2: Update production configuration (1 hour)
  - Task 3.3: Create release documentation (1 hour)

### Day 3 (4 hours)
- **Morning (2 hours):**
  - Task 3.4: Update README.md (1 hour)
  - Task 4.1: Full test suite run (30 minutes)
  - Task 4.2: Manual QA testing (start)

- **Afternoon (2 hours):**
  - Task 4.2: Manual QA testing (complete - 2-3 hours)
  - Task 4.3: Production build test (1 hour)
  - Task 4.4: Cross-browser testing (1 hour)

---

## Success Metrics

### Code Quality
- [ ] Zero console.log statements (except critical errors)
- [ ] Zero debug components in production
- [ ] All 617 tests passing
- [ ] No TypeScript errors
- [ ] No ESLint warnings

### User Experience
- [ ] Error messages user-friendly and actionable
- [ ] Loading states for all async operations
- [ ] Error boundaries prevent crashes
- [ ] Full game playthrough works

### Documentation
- [ ] Technical debt registered
- [ ] Release notes complete
- [ ] Deployment guide verified
- [ ] User guide written

### Production Readiness
- [ ] Production build optimized
- [ ] Environment config correct
- [ ] Cross-browser compatible
- [ ] Ready for deployment

---

## Risk Mitigation

### Risk: Breaking Changes
**Mitigation:**
- Run full test suite after each task
- Use git branches for each phase
- Manual QA before merging

### Risk: Missed Console.logs
**Mitigation:**
- Automated grep search
- Code review before completion
- Production build verification

### Risk: Time Overrun
**Mitigation:**
- Prioritize critical tasks first
- Skip medium priority if needed
- Documentation can be completed post-launch

---

## Rollback Plan

If issues discovered during QA:
1. **Revert to previous commit** (git reset --hard HEAD~1)
2. **Identify issue** in test results
3. **Fix issue** in isolation
4. **Re-test** specific area
5. **Continue** with remaining tasks

---

## Post-Completion Checklist

- [ ] All tasks completed
- [ ] All tests passing
- [ ] Production build tested
- [ ] Documentation complete
- [ ] Git tagged as `v1.0-rc1`
- [ ] Ready for deployment

---

## Notes

**Tools Required:**
- grep (for console.log search)
- ESLint (for code quality)
- TypeScript compiler (for type checking)
- Vitest (for testing)

**Team Communication:**
- Daily standup to review progress
- Blockers escalated immediately
- QA findings tracked in issue tracker

**Definition of Done:**
- Code reviewed
- Tests passing
- Documentation updated
- Manual QA completed
- Ready for production deployment

---

## Contact

For questions or issues during execution:
- Technical Lead: [Name]
- QA Lead: [Name]
- Project Manager: [Name]

---

*Last Updated: 2025-10-30*
*Version: 1.0*
*Status: Ready for Execution*
