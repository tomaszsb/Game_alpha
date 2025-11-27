# Player Panel UI Redesign - Implementation Plan

**Version:** 2.0 (Reviewed & Approved)
**Date:** October 10, 2025
**Status:** Approved - Ready for Implementation
**Reviewed By:** Gemini AI

---

## 1. Overview & Goals

### Problem Statement
Current Player Panel UI has information density issues on mobile devices:
- Primary action buttons (accept/reject/negotiate) not visible
- Mixed navigation and action controls
- Excessive scrolling required
- Unclear action availability

### Solution Summary
Mobile-first redesign with contextual expandable sections and persistent "Next Step" button:
- **Expandable sections** with actions nested by category
- **Action indicators** (🔴) show when actions are available
- **Information redistribution** to appropriate UI areas
- **Persistent "Next Step" button** for primary game loop actions

### Success Criteria
- [ ] All primary actions visible/discoverable without scrolling
- [ ] Clear visual indication of available actions
- [ ] Mobile-optimized with minimal screen real estate
- [ ] Desktop layout gracefully expands for larger screens
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] All edge cases handled (End Turn, Try Again, ChoiceEffect)

---

## 2. Component Architecture

### 2.1 New Component Structure

```
PlayerPanel/
├── CurrentCardSection (expandable) ← FIRST (most critical)
├── FinancesSection (expandable)
├── TimeSection (expandable)
├── CardsSection (expandable)
├── NextStepButton (persistent, fixed position)
└── TryAgainButton (near NextStep, secondary style)
```

**Note:** Section ordering prioritizes the most context-sensitive information first.

### 2.2 Shared Components

**ExpandableSection Component:**
```typescript
interface ExpandableSectionProps {
  title: string;
  icon: string;
  hasAction: boolean;          // Controls 🔴 indicator
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  ariaControls: string;        // For accessibility
  defaultExpandedOnDesktop?: boolean;
  isLoading?: boolean;         // Shows skeleton loader
  error?: string;              // Error message to display
}
```

**ActionButton Component:**
```typescript
interface ActionButtonProps {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  isLoading?: boolean;         // Shows loading spinner
}
```

**TryAgainButton Component:**
```typescript
interface TryAgainButtonProps {
  onClick: () => void;
  disabled?: boolean;
  visible: boolean;
}

// Styled as secondary "undo" action, placed near NextStepButton
```

---

## 3. Feature-by-Feature Implementation

### 3.1 Expandable Sections

#### Visual States:
```
Collapsed, no action:     💰 FINANCES ▶
Collapsed, has action:    💰 FINANCES ▶ 🔴
Expanded:                 💰 FINANCES ▼
```

#### Implementation Details:

**State Management:**
```typescript
interface SectionState {
  finances: { expanded: boolean; hasAction: boolean };
  time: { expanded: boolean; hasAction: boolean };
  cards: { expanded: boolean; hasAction: boolean };
  currentCard: { expanded: boolean; hasAction: boolean };
}
```

**Action Detection:**
- Query unified `TurnService.getAvailableActions()` which returns array of available action types
- Action types: `['ROLL_FOR_MONEY', 'ROLL_FOR_TIME', 'ROLL_FOR_CARDS_W', 'ROLL_FOR_CARDS_B', 'PLAY_CARD', etc.]`
- Update `hasAction` flags based on which actions are present
- Re-evaluate on ANY state change (not just current player's actions)

**Example:**
```typescript
const actions = gameServices.turnService.getAvailableActions(playerId);
const hasFinancesAction = actions.includes('ROLL_FOR_MONEY');
const hasTimeAction = actions.includes('ROLL_FOR_TIME');
const hasCardsAction = actions.some(a => a.startsWith('ROLL_FOR_CARDS'));
```

**Expansion Logic:**
- Mobile: Start all sections collapsed (except current card if active)
- Desktop (>768px): Current Card ALWAYS expanded, others auto-expand only if they have actions
- User expansions persist during turn, reset on new turn

#### CSS Structure:
```scss
.expandable-section {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    cursor: pointer;

    &:hover {
      background: var(--hover-bg);
    }
  }

  &__indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--error-red);

    // Pulse briefly (2-3s) when action first becomes available
    &--new {
      animation: pulse 3s ease-out;
    }
  }

  &__content {
    padding: 0 12px 12px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;

    &--expanded {
      max-height: 500px; // Adjust based on content
    }

    &--loading {
      // Skeleton loader state
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s infinite;
    }
  }

  &__error {
    padding: 12px;
    color: var(--error-red);
    background: var(--error-bg);
    border-radius: 4px;
    margin-top: 8px;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

### 3.2 Section-Specific Actions

#### Finances Section
**Content:**
- Current balance: `$X`
- Surplus: `$Y`

**Actions (conditional):**
- `[Roll for Money]` - Appears when `ROLL_FOR_MONEY` in available actions

**Implementation:**
```typescript
function FinancesSection({ gameServices, playerId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { finances } = gameServices.stateService.getPlayerState(playerId);
  const availableActions = gameServices.turnService.getAvailableActions(playerId);
  const canRollForMoney = availableActions.includes('ROLL_FOR_MONEY');

  const handleRollForMoney = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await gameServices.turnService.rollForMoney(playerId);
    } catch (err) {
      setError('Failed to roll for money. Please try again.');
      console.error('Roll for money error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ExpandableSection
      title="FINANCES"
      icon="💰"
      hasAction={canRollForMoney}
      isExpanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      ariaControls="finances-content"
      isLoading={isLoading}
      error={error}
    >
      <div className="finances-content">
        <div className="stat-line">Balance: ${finances.balance}</div>
        <div className="stat-line">Surplus: ${finances.surplus}</div>

        {canRollForMoney && (
          <ActionButton
            label="Roll for Money"
            variant="primary"
            onClick={handleRollForMoney}
            disabled={isLoading}
            isLoading={isLoading}
            ariaLabel="Roll dice to gain money resource"
          />
        )}
      </div>
    </ExpandableSection>
  );
}
```

#### Time Section
**Content:**
- Cost: `Xd` (days required for current action)
- Elapsed: `Yd` (days used so far)

**Actions (conditional):**
- `[Roll for Time]` - Appears when `ROLL_FOR_TIME` in available actions

**Implementation follows same pattern as Finances with error handling.**

#### Cards Section
**Content:**
- Portfolio summary (e.g., "4 cards in hand")
- Card type counts (W: 2, B: 1, etc.)

**Actions (conditional):**
- `[Roll for W Cards]` - When `ROLL_FOR_CARDS_W` in available actions
- `[Roll for B Cards]` - When `ROLL_FOR_CARDS_B` in available actions
- `[View Discarded]` - Opens modal/drawer showing player's discard pile

**Implementation Note:**
- Card type rolls are separate buttons (not dropdown) to reduce interaction complexity
- "View Discarded" opens a modal/drawer (not nested expandable) to handle long lists
- All actions include error handling and loading states

#### Current Card Section
**Content:**
- Card title/name
- Story text (narrative context)
- Action Required text
- Potential Outcomes text

**Actions (dynamic based on ChoiceEffect):**
- Rendered from `card.choices[]` array
- Example: `[Accept]` `[Negotiate]` `[Reject]`
- Variable number of buttons (2-5 typically)

**ChoiceEffect Integration:**
```typescript
function CurrentCardSection({ card, onChoice, gameServices }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choices = card.effect?.type === 'choice'
    ? card.effect.choices
    : [];

  const handleChoice = async (choiceId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await onChoice(choiceId);
    } catch (err) {
      setError('Failed to process choice. Please try again.');
      console.error('Choice error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ExpandableSection
      title={card.name}
      icon="📋"
      hasAction={choices.length > 0}
      isExpanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      ariaControls="current-card-content"
      defaultExpandedOnDesktop={true}
      isLoading={isLoading}
      error={error}
    >
      <div className="card-content">
        <div className="card-story">{card.story}</div>
        <div className="card-action-required">{card.actionRequired}</div>
        <div className="card-outcomes">{card.potentialOutcomes}</div>

        {choices.length > 0 && (
          <div className="card-choices">
            {choices.map((choice, idx) => (
              <ActionButton
                key={idx}
                label={choice.label}
                variant={getChoiceVariant(choice.label)} // accept=primary, reject=danger
                onClick={() => handleChoice(choice.id)}
                disabled={isLoading}
                isLoading={isLoading}
                ariaLabel={choice.description}
              />
            ))}
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}
```

---

### 3.3 Next Step Button

#### Purpose
Persistent, context-aware button for primary game loop actions (Roll to Move, End Turn).

#### Visual Position
- **Mobile:** Fixed bottom-right corner, floating above content
- **Desktop:** Fixed bottom-right with 24px margin

#### Button States & Labels

| Game State | Button Label | Action |
|------------|-------------|--------|
| Player needs to roll for movement | `Roll to Move` | Triggers movement roll via `MovementService` |
| Player completed all mandatory actions | `End Turn` | Calls `TurnService.endTurn()` |
| Player has pending choice (card/space) | *(Disabled)* | Button grayed out until choice made |
| Other player's turn | *(Hidden)* | Not applicable |

#### State Determination Logic
```typescript
function getNextStepState(gameServices: GameServices, playerId: string): NextStepState {
  const turnService = gameServices.turnService;
  const availableActions = turnService.getAvailableActions(playerId);

  if (!turnService.isCurrentPlayer(playerId)) {
    return { visible: false };
  }

  if (turnService.hasPendingChoice(playerId)) {
    return {
      visible: true,
      label: 'End Turn',
      disabled: true,
      tooltip: 'Complete current action first'
    };
  }

  if (availableActions.includes('ROLL_TO_MOVE')) {
    return {
      visible: true,
      label: 'Roll to Move',
      disabled: false,
      action: 'roll-movement'
    };
  }

  if (turnService.canEndTurn(playerId)) {
    return {
      visible: true,
      label: 'End Turn',
      disabled: false,
      action: 'end-turn'
    };
  }

  return { visible: false };
}
```

#### Implementation
```typescript
function NextStepButton({ gameServices, playerId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const stepState = getNextStepState(gameServices, playerId);

  const handleNextStep = async () => {
    setIsLoading(true);
    try {
      if (stepState.action === 'roll-movement') {
        await gameServices.movementService.rollAndMove(playerId);
      } else if (stepState.action === 'end-turn') {
        await gameServices.turnService.endTurn(playerId);
      }
    } catch (err) {
      console.error('Next step error:', err);
      // Error notification handled by NotificationService
    } finally {
      setIsLoading(false);
    }
  };

  if (!stepState.visible) return null;

  return (
    <button
      className="next-step-button"
      onClick={handleNextStep}
      disabled={stepState.disabled || isLoading}
      aria-label={stepState.label}
      title={stepState.tooltip}
    >
      {isLoading ? 'Processing...' : stepState.label}
    </button>
  );
}
```

#### CSS
```scss
.next-step-button {
  position: fixed;
  bottom: 16px;
  right: 16px;
  padding: 16px 24px;
  font-size: 18px;
  font-weight: bold;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  cursor: pointer;
  z-index: 1000;

  &:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0,0,0,0.2);
  }

  &:disabled {
    background: var(--disabled-gray);
    cursor: not-allowed;
  }

  @media (min-width: 768px) {
    bottom: 24px;
    right: 24px;
  }
}

.try-again-button {
  position: fixed;
  bottom: 16px;
  right: 140px; // Position to left of NextStepButton
  padding: 12px 16px;
  font-size: 14px;
  font-weight: normal;
  background: var(--secondary-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: pointer;
  z-index: 1000;

  // Secondary/undo styling
  display: flex;
  align-items: center;
  gap: 6px;

  &::before {
    content: '↶'; // Undo icon
    font-size: 16px;
  }

  &:hover:not(:disabled) {
    background: var(--secondary-hover);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (min-width: 768px) {
    bottom: 24px;
    right: 160px;
  }
}
```

---

### 3.4 Information Redistribution

#### Rules Button
**FROM:** Player Panel Portfolio section
**TO:** Progress Overview area (top banner)

**Implementation:**
- Add `[Rules]` button to top-right of Progress Overview component
- Opens modal/drawer with game rules reference
- Low prominence (icon-only on mobile, icon+text on desktop)

#### Explorer & Paths (Player Roles)
**FROM:** Player Panel Portfolio section
**TO:** Game Board active space display

**Implementation:**
- Show current player's active role badge on their current space
- Example: Space card shows "👤 PM - Explorer" at top
- Roles are view-only (players don't switch mid-game)

**Note:** "Explorer" and "Patha" are role/path cards that define player identity, not actions.

#### Discarded Cards
**FROM:** Player Panel Portfolio section (if implemented)
**TO:** Stays with Player Panel, accessed via Cards section

**Implementation:**
- `[View Discarded]` button in Cards section
- Opens slide-up drawer on mobile, sidebar on desktop
- Shows only current player's discarded cards (per-player data)
- List format: Card name, type, turn discarded
- Filter/sort options: By type, by turn

---

## 4. Edge Case Handling

### 4.1 "End Turn" Visibility
**Problem:** End Turn is a top-level action that shouldn't be hidden in collapsible section.

**Solution:** Next Step Button handles this with `End Turn` label when appropriate.

**Implementation:**
- Never nest End Turn inside expandable section
- Next Step Button always visible when player can act
- Clear visual distinction between "disabled" and "available" states

---

### 4.2 Complex Choices via ChoiceEffect
**Problem:** Some cards have 3+ choices with long descriptions.

**Solution:** Flexible button layout with overflow handling.

**Implementation:**
```typescript
// In CurrentCardSection
<div className="card-choices">
  {choices.map((choice) => (
    <ActionButton
      key={choice.id}
      label={choice.label}
      variant={getVariantForChoice(choice)}
      onClick={() => onChoice(choice)}
      ariaLabel={choice.description} // Full description for screen readers
    />
  ))}
</div>
```

**CSS:**
```scss
.card-choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;

  @media (min-width: 480px) {
    flex-direction: row;
    flex-wrap: wrap;
  }
}
```

**UX Notes:**
- Vertical stacking on mobile (<480px) ensures all choices visible
- Horizontal wrapping on larger screens for faster scanning
- Each button shows full label (not truncated)
- Tooltip/aria-label provides full description if label is shortened

---

### 4.3 Loading & Error States
**Problem:** Plan didn't specify UI behavior during initialization or service failures.

**Solution:** Skeleton loaders during loading, error messages with retry on failures.

**Implementation:**

**Skeleton Loaders:**
```typescript
function ExpandableSection({ isLoading, error, children, ...props }: ExpandableSectionProps) {
  return (
    <div className="expandable-section">
      <button className="expandable-section__header" {...headerProps}>
        {/* Header content */}
      </button>

      <div className={`expandable-section__content ${isExpanded ? '--expanded' : ''}`}>
        {isLoading ? (
          <div className="expandable-section__content--loading">
            <div className="skeleton-line"></div>
            <div className="skeleton-line"></div>
          </div>
        ) : error ? (
          <div className="expandable-section__error">
            {error}
            <button onClick={onRetry}>Retry</button>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
```

**Error Handling Pattern:**
All service calls wrapped in try/catch (see Finances Section implementation for example). Errors displayed inline with retry option.

---

### 4.4 Real-Time Updates from Other Players
**Problem:** UI must update when other players' actions affect current player (e.g., resource changes).

**Solution:** Subscribe to ALL state changes, not just current player's actions.

**Implementation:**
```typescript
function PlayerPanel({ gameServices, playerId }: Props) {
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  useEffect(() => {
    // Subscribe to ANY game state change, regardless of source
    const unsubscribe = gameServices.stateService.subscribe((event) => {
      // Re-evaluate all sections on any state change
      forceUpdate();
    });

    return unsubscribe;
  }, [gameServices]);

  // Component re-renders on any state change, ensuring UI always synced
  return (
    <div className="player-panel">
      <CurrentCardSection {...props} />
      <FinancesSection {...props} />
      <TimeSection {...props} />
      <CardsSection {...props} />
    </div>
  );
}
```

**Key Points:**
- Don't filter updates by player - all state changes can be relevant
- Each section queries latest state on every render
- Performance: Use React.memo for sections to prevent unnecessary re-renders within section

---

### 4.5 "Try Again" State Reset
**Problem:** Try Again feature reverts game state - UI must reflect this instantly.

**Solution:** StateService snapshot restoration triggers full UI re-render (handled by real-time updates).

**Implementation:**
```typescript
// In StateService
restoreSnapshot(snapshotId: string): void {
  const snapshot = this.snapshots.get(snapshotId);
  if (!snapshot) throw new Error('Snapshot not found');

  this.currentState = deepClone(snapshot);
  this.notifyStateChange('snapshot-restored'); // Triggers PlayerPanel re-render
}

// PlayerPanel automatically handles this via state subscription (see 4.4)
```

**Testing:**
- User takes action (e.g., "Accept" on card)
- User clicks "Try Again"
- UI reverts to showing original choices
- All expandable sections reset to pre-action state
- Next Step Button returns to previous state

---

### 4.6 Accessibility (WCAG 2.1 AA)

#### Expandable Sections
```typescript
<button
  className="expandable-section__header"
  onClick={onToggle}
  aria-expanded={isExpanded}
  aria-controls={contentId}
>
  <span className="section-title">{title} {icon}</span>
  {hasAction && (
    <span
      className="action-indicator"
      role="status"
      aria-label="Action available"
    >
      🔴
    </span>
  )}
  <span aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
</button>

<div
  id={contentId}
  role="region"
  aria-labelledby={headerId}
  hidden={!isExpanded}
>
  {children}
</div>
```

#### Screen Reader Announcements
```typescript
// When action becomes available
announceToScreenReader(`New action available in ${sectionName}`);

// When section expands
// (Handled by aria-expanded change)

// When choice is made
announceToScreenReader(`${choiceLabel} selected. ${resultDescription}`);
```

#### Keyboard Navigation
- Tab order: Sections → Action buttons → Next Step Button
- Enter/Space: Expand/collapse sections
- Enter/Space: Activate action buttons
- Escape: Collapse currently focused section

#### Color Contrast
- 🔴 indicator: Ensure contrast ratio ≥ 3:1 against background
- Action buttons: Text contrast ≥ 4.5:1
- Disabled states: Minimum 3:1 contrast

---

### 4.7 Desktop Layout Adaptation

**Breakpoints:**
- Mobile: < 768px
- Desktop: ≥ 768px

**Desktop Behavior:**
```typescript
const isDesktop = window.innerWidth >= 768;

const sectionDefaults = {
  finances: {
    expanded: isDesktop && hasFinancesAction
  },
  time: {
    expanded: isDesktop && hasTimeAction
  },
  cards: {
    expanded: isDesktop && hasCardsAction
  },
  currentCard: {
    expanded: isDesktop || hasCurrentCardAction // Always on desktop
  },
};
```

**Layout Differences:**
- Desktop: Player Panel can be wider (30-40% of screen vs. 100% on mobile)
- Desktop: Sections with actions auto-expand to show content
- Desktop: Current Card section always expanded
- Desktop: Next Step Button has more margin from edges

**Responsive CSS:**
```scss
.player-panel {
  width: 100%;

  @media (min-width: 768px) {
    width: 400px;
    max-width: 40%;
  }
}

.expandable-section__content {
  // Mobile: collapsed by default
  max-height: 0;

  @media (min-width: 768px) {
    // Desktop: expand sections with actions
    &--has-action {
      max-height: 500px;
    }
  }
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

**ExpandableSection Component:**
```typescript
describe('ExpandableSection', () => {
  test('shows indicator when hasAction=true', () => {
    render(<ExpandableSection hasAction={true} {...props} />);
    expect(screen.getByRole('status', { name: /action available/i })).toBeInTheDocument();
  });

  test('toggles expanded state on click', () => {
    const onToggle = jest.fn();
    render(<ExpandableSection onToggle={onToggle} {...props} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalled();
  });

  test('has correct ARIA attributes', () => {
    render(<ExpandableSection isExpanded={true} ariaControls="test-content" {...props} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'test-content');
  });
});
```

**NextStepButton Component:**
```typescript
describe('NextStepButton', () => {
  test('shows "Roll to Move" when movement needed', () => {
    mockTurnService.needsMovementRoll.mockReturnValue(true);
    render(<NextStepButton {...props} />);
    expect(screen.getByText('Roll to Move')).toBeInTheDocument();
  });

  test('shows "End Turn" when actions complete', () => {
    mockTurnService.canEndTurn.mockReturnValue(true);
    render(<NextStepButton {...props} />);
    expect(screen.getByText('End Turn')).toBeInTheDocument();
  });

  test('is disabled when choice pending', () => {
    mockTurnService.hasPendingChoice.mockReturnValue(true);
    render(<NextStepButton {...props} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('is hidden on other players turn', () => {
    mockTurnService.isCurrentPlayer.mockReturnValue(false);
    render(<NextStepButton {...props} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

**Action Detection Logic:**
```typescript
describe('getNextStepState', () => {
  test('returns roll-movement state when player needs to roll', () => {
    mockTurnService.needsMovementRoll.mockReturnValue(true);
    const state = getNextStepState(gameServices, 'player1');
    expect(state).toEqual({
      visible: true,
      label: 'Roll to Move',
      disabled: false,
      action: 'roll-movement'
    });
  });

  // Additional state tests...
});
```

### 5.2 Integration Tests

**Player Action Flow:**
```typescript
describe('Player Panel - Action Flow', () => {
  test('completes full turn cycle', async () => {
    const { gameServices } = setupTestGame();
    render(<PlayerPanel gameServices={gameServices} playerId="player1" />);

    // 1. Roll to move
    fireEvent.click(screen.getByText('Roll to Move'));
    await waitFor(() => {
      expect(screen.getByText(/landed on/i)).toBeInTheDocument();
    });

    // 2. Card action appears in Current Card section
    const cardSection = screen.getByText(/OWNER-SCOPE-INITIATION/i);
    expect(cardSection).toHaveAttribute('aria-expanded', 'true');

    // 3. Make choice
    fireEvent.click(screen.getByText('Accept'));
    await waitFor(() => {
      expect(screen.getByText('End Turn')).not.toBeDisabled();
    });

    // 4. End turn
    fireEvent.click(screen.getByText('End Turn'));
    await waitFor(() => {
      expect(gameServices.turnService.getCurrentPlayer()).not.toBe('player1');
    });
  });
});
```

**Try Again Integration:**
```typescript
describe('Try Again Feature', () => {
  test('resets UI to pre-action state', async () => {
    const { gameServices } = setupTestGame();
    render(<PlayerPanel gameServices={gameServices} playerId="player1" />);

    // Take action
    fireEvent.click(screen.getByText('Accept'));
    await waitFor(() => {
      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    });

    // Try Again
    fireEvent.click(screen.getByText('Try Again'));
    await waitFor(() => {
      // Original choices should reappear
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Negotiate')).toBeInTheDocument();
    });
  });
});
```

### 5.3 E2E Tests (Playwright/Cypress)

**Mobile Viewport:**
```typescript
test('mobile: expandable sections work correctly', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
  await page.goto('/game');

  // All sections start collapsed
  await expect(page.locator('.finances-content')).not.toBeVisible();

  // Click to expand
  await page.click('text=FINANCES');
  await expect(page.locator('.finances-content')).toBeVisible();

  // Action button appears if action available
  if (await page.locator('text=Roll for Money').isVisible()) {
    await expect(page.locator('text=Roll for Money')).toBeVisible();
  }
});

test('mobile: next step button is accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/game');

  // Button should be visible and not covered by content
  const button = page.locator('.next-step-button');
  await expect(button).toBeVisible();

  const box = await button.boundingBox();
  expect(box.y).toBeGreaterThan(400); // Near bottom
  expect(box.x).toBeGreaterThan(200); // Near right
});
```

**Desktop Viewport:**
```typescript
test('desktop: sections auto-expand with actions', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/game');

  // Current Card section should be expanded
  await expect(page.locator('.current-card-content')).toBeVisible();

  // Sections with actions should auto-expand
  const cardSection = page.locator('text=CARDS');
  if (await cardSection.locator('.action-indicator').isVisible()) {
    await expect(page.locator('.cards-content')).toBeVisible();
  }
});
```

### 5.4 Accessibility Tests

**Automated (axe-core):**
```typescript
test('player panel has no accessibility violations', async () => {
  const { container } = render(<PlayerPanel {...props} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Manual Testing Checklist:**
- [ ] Screen reader announces all actions and state changes
- [ ] Keyboard navigation flows logically
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast meets WCAG AA standards
- [ ] All images/icons have text alternatives
- [ ] Forms and buttons properly labeled

---

## 6. Implementation Phases

### Phase 1: Core Expandable Sections (COMPLETED - Oct 12, 2025)
**Goal:** Build foundation with expandable UI pattern

**Status:** ✅ **DONE**

**Summary:** The core `ExpandableSection` component was built and integrated into the `ProjectScopeSection`, `FinancesSection`, `TimeSection`, and `CardsSection`. The layout was iteratively refined to a three-column header, and numerous bugs were fixed.

---

### Phase 2: Current Card & ChoiceEffect (Week 1-2)
**Goal:** Dynamic card choices rendering

**Tasks:**
1. Implement `CurrentCardSection` component
2. Integrate `ChoiceEffect` rendering (2-5 choice buttons)
3. Handle long choice descriptions (truncation + tooltips)
4. Test with various card types (Owner, Funding, Design, etc.)
5. Ensure Try Again properly resets choices
6. Write integration tests for card action flows

**Deliverable:** All card types render correctly with dynamic choices.

---

### Phase 3: Next Step Button (Week 2)
**Goal:** Persistent context-aware action button

**Tasks:**
1. Create `NextStepButton` component
2. Implement `getNextStepState()` logic
3. Wire up to `MovementService` (Roll to Move) and `TurnService` (End Turn)
4. Handle disabled state when choices pending
5. Fixed positioning (mobile + desktop)
6. Write unit + E2E tests for all button states

**Deliverable:** Next Step Button working across full game loop.

---

### Phase 4: Information Redistribution (Week 2-3)
**Goal:** Move elements to appropriate UI areas

**Tasks:**
1. Move Rules button to Progress Overview
2. Show player roles on Game Board active space
3. Implement "View Discarded" drawer in Cards section
4. Remove old Player Panel portfolio elements
5. Update navigation flows
6. Test across all game phases

**Deliverable:** Clean Player Panel with redistributed information.

---

### Phase 5: Edge Cases & Polish (Week 3)
**Goal:** Handle all identified edge cases

**Tasks:**
1. Verify Try Again state reset behavior
2. Test complex ChoiceEffect cards (3+ choices)
3. Ensure End Turn never hidden
4. Verify accessibility (screen reader, keyboard nav)
5. Performance optimization (re-render reduction)
6. Cross-browser testing

**Deliverable:** Production-ready UI with all edge cases handled.

---

### Phase 6: Documentation & Rollout (Week 3-4)
**Goal:** Document and deploy

**Tasks:**
1. Update component documentation
2. Create user guide for new UI
3. Update E2E test suite
4. Code review + QA testing
5. Deploy to staging
6. User acceptance testing
7. Production deployment

**Deliverable:** New UI live in production with full documentation.

---

## 7. Technical Debt & Future Enhancements

### Known Limitations
- **Indicator style:** Simple 🔴 dot may not be prominent enough - monitor user feedback
- **Animations:** Basic expand/collapse - could add more polish later
- **Card choice descriptions:** Limited to ~80 chars - may need modal for complex cards

### Future Enhancements
- **Tooltips:** Add hover tooltips explaining each action
- **Animations:** More engaging expand/collapse transitions
- **Smart defaults:** Remember user's expansion preferences per section
- **Accessibility:** Add voice control support for action buttons
- **Performance:** Virtualize card list in "View Discarded" for large discard piles

---

## 8. Design Decisions (Resolved)

All open questions have been resolved through collaborative review with Gemini AI:

1. **Action indicator animation:** ✅ Pulse briefly (2-3 seconds) when action first becomes available, then remain as static dot. Continuous pulse is too distracting.

2. **Multiple simultaneous actions:** ✅ Current design handles this correctly. Both sections show 🔴 indicators, player chooses order. No changes needed.

3. **Next Step Button placement:** ✅ Bottom-right corner is correct and standard. Thumb reach on large phones is acceptable tradeoff for familiarity.

4. **Desktop expansion:** ✅ Current Card section ALWAYS expanded. Other sections auto-expand ONLY if they contain actions. Don't expand all sections (causes clutter).

5. **Discard pile:** ✅ Button that opens modal/drawer. Discard piles can be long lists requiring dedicated space, not nested expandable.

6. **Try Again button placement:** ✅ Near NextStepButton (to its left), styled as secondary "undo" action to distinguish from primary game flow.

7. **Section ordering:** ✅ **Current Card → Finances → Time → Cards**. Current Card is most context-sensitive and should be first.

---

## 9. Success Metrics

### Post-Launch Monitoring
- **User feedback:** Survey players on new UI clarity (target: 80%+ positive)
- **Error rate:** Track mis-clicks or "confused" player actions (target: <5% per session)
- **Time to action:** Measure time from action availability to player selection (target: <15s)
- **Accessibility complaints:** Monitor for a11y issues (target: 0 critical issues)

### Performance Benchmarks
- **Render time:** PlayerPanel re-render <50ms on mobile
- **Expansion animation:** Smooth 60fps on mid-range devices
- **Memory:** No leaks during 50+ turn sessions

---

## Appendix A: Component File Structure

```
src/components/player/
├── PlayerPanel.tsx                 # Main container
├── ExpandableSection.tsx           # Shared expandable UI
├── sections/
│   ├── FinancesSection.tsx
│   ├── TimeSection.tsx
│   ├── CardsSection.tsx
│   └── CurrentCardSection.tsx
├── NextStepButton.tsx
└── __tests__/
    ├── ExpandableSection.test.tsx
    ├── FinancesSection.test.tsx
    ├── TimeSection.test.tsx
    ├── CardsSection.test.tsx
    ├── CurrentCardSection.test.tsx
    ├── NextStepButton.test.tsx
    └── PlayerPanel.integration.test.tsx
```

---

## Appendix B: Service API Requirements

### TurnService (Updated with Unified Action Detection)
```typescript
type ActionType =
  | 'ROLL_FOR_MONEY'
  | 'ROLL_FOR_TIME'
  | 'ROLL_FOR_CARDS_W'
  | 'ROLL_FOR_CARDS_B'
  | 'ROLL_TO_MOVE'
  | 'PLAY_CARD'
  | 'MAKE_CHOICE';

interface TurnService {
  // Primary action detection (unified approach)
  getAvailableActions(playerId: string): ActionType[];

  // Player state queries
  isCurrentPlayer(playerId: string): boolean;
  hasPendingChoice(playerId: string): boolean;
  canEndTurn(playerId: string): boolean;

  // Action execution
  rollForMoney(playerId: string): Promise<void>;
  rollForTime(playerId: string): Promise<void>;
  rollForCards(playerId: string, cardType: 'W' | 'B'): Promise<void>;
  endTurn(playerId: string): Promise<void>;
}
```

**Note:** The unified `getAvailableActions()` approach is more scalable than adding individual `can...()` methods for every action.

### StateService
```typescript
interface StateService {
  subscribe(callback: (event: StateEvent) => void): () => void;
  notifyStateChange(event: StateEvent): void;
  restoreSnapshot(snapshotId: string): void;
  getPlayerState(playerId: string): PlayerState;
}
```

### NotificationService
```typescript
interface NotificationService {
  showError(message: string): void;
  showSuccess(message: string): void;
  showInfo(message: string): void;
}
```

---

**END OF IMPLEMENTATION PLAN**
