# UI Component Reference - Game Alpha

**Version:** 1.0
**Date:** November 30, 2025
**Status:** Complete UI Redesign (Phases 1-5)

---

## Table of Contents

1. [Player Panel Components](#player-panel-components)
2. [Game Board Components](#game-board-components)
3. [Modal Components](#modal-components)
4. [Common Components](#common-components)
5. [Layout Components](#layout-components)

---

## Player Panel Components

The Player Panel is the primary interface for individual players, featuring a mobile-first responsive design with expandable sections and contextual actions.

### PlayerPanel

**Location:** `src/components/player/PlayerPanel.tsx`

**Description:** Main container for the player-specific UI. Displays all player information, actions, and game state in an organized, collapsible format.

**Props:**
```typescript
interface PlayerPanelProps {
  gameServices: IServiceContainer;  // Injected game services
  playerId: string;                 // ID of the player viewing this panel
}
```

**Key Features:**
- Mobile-first responsive design
- Expandable sections with action indicators
- Persistent "Next Step" button
- Dynamic section visibility based on game state
- QR code support for multi-device play

**Usage:**
```typescript
<PlayerPanel
  gameServices={serviceContainer}
  playerId="player_abc123"
/>
```

---

### ExpandableSection

**Location:** `src/components/player/ExpandableSection.tsx`

**Description:** Reusable collapsible section component with header, content area, and action indicator support.

**Props:**
```typescript
interface ExpandableSectionProps {
  id: string;                    // Unique identifier for accessibility
  title: string;                 // Section title text
  icon?: string;                 // Optional emoji icon
  summary?: React.ReactNode;     // Header right-side summary content
  children: React.ReactNode;     // Section content
  defaultExpanded?: boolean;     // Initial expansion state (default: false)
  hasAction?: boolean;           // Show red action indicator (🔴)
  className?: string;            // Additional CSS classes
  onToggle?: (expanded: boolean) => void;  // Callback on expand/collapse
}
```

**Key Features:**
- Smooth expand/collapse animations
- ARIA accessibility attributes
- Keyboard navigation support
- Visual action indicators
- Customizable header content

**Usage:**
```typescript
<ExpandableSection
  id="finances-section"
  title="FINANCES"
  icon="💰"
  summary={<span>Cash: ${player.money}</span>}
  hasAction={hasMoneyAction}
  defaultExpanded={false}
>
  <FinancialDetails player={player} />
</ExpandableSection>
```

---

### NextStepButton

**Location:** `src/components/player/NextStepButton.tsx`

**Description:** Context-aware button that guides players through the primary game loop. Changes label and behavior based on game state.

**Props:**
```typescript
interface NextStepButtonProps {
  gameServices: IServiceContainer;
  playerId: string;
  className?: string;
}
```

**States:**
- **"Roll to Move"** - When player needs to roll dice
- **"End Turn"** - When all actions are complete
- **Disabled** - When awaiting a choice or action
- **Loading** - During async operations

**Key Features:**
- Automatic state detection
- Tooltip explanations when disabled
- Loading spinner during operations
- Error handling with user feedback

---

### Section Components

All section components share a common pattern with `gameServices` and `playerId` props.

#### CurrentCardSection

**Location:** `src/components/player/sections/CurrentCardSection.tsx`

**Description:** Displays active card with story, choices, and dynamic action buttons.

**Features:**
- Card story and description
- Choice buttons (Accept/Negotiate/Reject)
- Outcome preview
- Negotiation flow support

---

#### FinancesSection

**Location:** `src/components/player/sections/FinancesSection.tsx`

**Description:** Financial management interface showing budget, expenditures, and money-related actions.

**Features:**
- Current cash display
- Budget vs actual tracking
- Expenditure breakdown (Design, Fees, Construction)
- Cost tracking with detailed categories
- Money source breakdown (Owner, Investors, Loans)
- Financial health warnings (>20% design cost)
- "Roll for Money" manual action button

**Content Areas:**
1. **Scope & Budget** - Project scope, total budget, cash on hand
2. **Expenditures** - Design, Fees, Construction totals
3. **Costs (Detailed)** - Expandable cost categories (Bank Fees, Arch Fees, etc.)
4. **Financial Health** - Design cost %, budget variance, funding mix
5. **Sources of Money** - Breakdown by source type

---

#### TimeSection

**Location:** `src/components/player/sections/TimeSection.tsx`

**Description:** Time tracking and time-related actions.

**Features:**
- Current time spent display
- Time-based action buttons
- Time threshold warnings

---

#### CardsSection

**Location:** `src/components/player/sections/CardsSection.tsx`

**Description:** Card hand management and acquisition.

**Features:**
- Card count by type (W/B/E/L/I)
- Active cards display
- "Draw Cards" action buttons
- Discard pile access
- Card type filtering

---

#### ProjectScopeSection

**Location:** `src/components/player/sections/ProjectScopeSection.tsx`

**Description:** Project progress tracking and Work card actions.

**Features:**
- Scope completion percentage
- Work card action buttons
- Progress visualization

---

## Game Board Components

### GameBoard

**Location:** `src/components/game/GameBoard.tsx`

**Description:** Visual representation of the game board with spaces and player tokens.

**Props:**
```typescript
interface GameBoardProps {
  gameServices: IServiceContainer;
  highlightSpaceId?: string;
}
```

**Features:**
- SVG-based space visualization
- Player token positioning
- Space highlighting
- Click handlers for space selection
- Responsive scaling

---

### GameSpace

**Location:** `src/components/game/GameSpace.tsx`

**Description:** Individual space on the game board.

**Props:**
```typescript
interface GameSpaceProps {
  space: Space;
  players: Player[];
  currentPlayerId: string | null;
  isHighlighted?: boolean;
  onClick?: () => void;
}
```

**Features:**
- Player token display
- Highlight states
- Click interaction
- Badge display (player roles)

---

### TurnControlsWithActions

**Location:** `src/components/game/TurnControlsWithActions.tsx`

**Description:** Desktop view turn controls with integrated manual actions.

**Props:**
```typescript
interface TurnControlsWithActionsProps {
  gameServices: IServiceContainer;
}
```

**Features:**
- Roll to Move button
- End Turn button
- Manual action buttons (time, money, cards)
- Action history
- Turn status display

---

### DiceRoller

**Location:** `src/components/game/DiceRoller.tsx`

**Description:** Dice rolling interface with animations.

**Features:**
- Animated dice roll
- Result display
- Sound effects (if enabled)
- Roll history

---

### PlayerStatusPanel

**Location:** `src/components/game/PlayerStatusPanel.tsx`

**Description:** Overview of all players' current status.

**Features:**
- Player list with avatars
- Current space display
- Resource summaries
- Turn indicator

---

### CardPortfolioDashboard

**Location:** `src/components/game/CardPortfolioDashboard.tsx`

**Description:** Comprehensive view of all player cards.

**Features:**
- Card type filtering
- Active cards display
- Card details on hover
- Sorting options

---

### MovementPathVisualization

**Location:** `src/components/game/MovementPathVisualization.tsx`

**Description:** Visual representation of possible movement paths.

**Features:**
- Path highlighting
- Destination preview
- Animated transitions

---

### SpaceExplorerPanel

**Location:** `src/components/game/SpaceExplorerPanel.tsx`

**Description:** Detailed information about spaces.

**Features:**
- Space content display
- Effect descriptions
- Movement options
- Historical visit data

---

### ProjectProgress

**Location:** `src/components/game/ProjectProgress.tsx`

**Description:** Visual project completion tracker.

**Features:**
- Progress bar
- Milestone markers
- Phase indicators

---

### GameLog

**Location:** `src/components/game/GameLog.tsx`

**Description:** Scrollable log of all game events.

**Props:**
```typescript
interface GameLogProps {
  gameServices: IServiceContainer;
  maxEntries?: number;
}
```

**Features:**
- Filterable event types
- Player-specific filtering
- Timestamp display
- Export functionality

---

## Modal Components

### ChoiceModal

**Location:** `src/components/modals/ChoiceModal.tsx`

**Description:** Modal for player choices (movement, card actions, etc.).

**Props:**
```typescript
interface ChoiceModalProps {
  choice: Choice;
  gameServices: IServiceContainer;
  playerId: string;
  onClose: () => void;
}
```

**Features:**
- Dynamic choice buttons
- Choice descriptions
- Confirmation flow
- Cancel option

---

### CardDetailsModal

**Location:** `src/components/modals/CardDetailsModal.tsx`

**Description:** Detailed view of a specific card.

**Props:**
```typescript
interface CardDetailsModalProps {
  cardId: string;
  gameServices: IServiceContainer;
  onClose: () => void;
  actions?: CardAction[];  // Optional action buttons
}
```

**Features:**
- Full card information
- Effect descriptions
- Duration tracking (for active cards)
- Action buttons (play, discard, etc.)

---

### DiceResultModal

**Location:** `src/components/modals/DiceResultModal.tsx`

**Description:** Display dice roll results and effects.

**Features:**
- Dice animation
- Effect breakdown
- Auto-dismiss timer
- Manual close option

---

### NegotiationModal

**Location:** `src/components/modals/NegotiationModal.tsx`

**Description:** Multi-player negotiation interface.

**Props:**
```typescript
interface NegotiationModalProps {
  negotiation: NegotiationState;
  gameServices: IServiceContainer;
  playerId: string;
  onClose: () => void;
}
```

**Features:**
- Offer creation
- Counter-offer submission
- Player snapshots
- Resolution handling

---

### DiscardPileModal

**Location:** `src/components/modals/DiscardPileModal.tsx`

**Description:** View discarded cards.

**Features:**
- Card type filtering
- Sort by name/date
- Card count display
- Card retrieval (if allowed by rules)

---

### EndGameModal

**Location:** `src/components/modals/EndGameModal.tsx`

**Description:** Game completion screen with winner announcement.

**Features:**
- Winner display
- Final scores
- Game statistics
- Play again option

---

### CardReplacementModal

**Location:** `src/components/modals/CardReplacementModal.tsx`

**Description:** Interface for replacing cards in hand.

**Features:**
- Current hand display
- Replacement options
- Drag-and-drop support
- Confirmation step

---

## Common Components

### ActionButton

**Location:** `src/components/common/ActionButton.tsx`

**Description:** Reusable button component with consistent styling.

**Props:**
```typescript
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  tooltip?: string;
  className?: string;
}
```

**Variants:**
- **primary** - Blue, main actions (default)
- **secondary** - Gray, alternative actions
- **danger** - Red, destructive actions
- **success** - Green, positive actions

**Features:**
- Loading spinner
- Disabled state
- Icon support
- Tooltip on hover
- Keyboard accessibility

---

### ErrorBoundary

**Location:** `src/components/common/ErrorBoundary.tsx`

**Description:** React error boundary for graceful error handling.

**Props:**
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

**Features:**
- Error catching
- User-friendly error display
- Error reporting
- Recovery options

---

## Layout Components

### GameLayout

**Location:** `src/components/layout/GameLayout.tsx`

**Description:** Main game layout container managing responsive layout and view modes.

**Props:**
```typescript
interface GameLayoutProps {
  viewPlayerId?: string;  // Optional player ID for player-specific view
}
```

**Responsive Modes:**
- **Mobile** (<768px) - Stacked vertical layout
- **Tablet** (768-1024px) - Side-by-side with scrolling
- **Desktop** (>1024px) - Full split-screen layout

**View Modes:**
- **Setup** - Game initialization screen
- **Game** - Standard gameplay (board + panel)
- **Player** - Player-only view (for multi-device)

**Features:**
- Automatic responsive adaptation
- Multi-device support via URL parameters
- QR code generation for player URLs
- State synchronization across devices

---

## Styling Conventions

### Theme System

All components use the centralized theme from `src/styles/theme.ts`:

```typescript
const theme = {
  colors: {
    primary: { main: '#007bff', dark: '#0056b3', light: '#cce5ff', ... },
    success: { main: '#28a745', ... },
    danger: { main: '#dc3545', ... },
    warning: { main: '#ffc107', ... },
    text: { primary: '#212529', secondary: '#6c757d', tertiary: '#9ca3af' },
    background: { primary: '#ffffff', secondary: '#f8f9fa', ... },
    border: '#dee2e6',
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  borderRadius: { sm: '4px', md: '8px', lg: '12px' },
  shadows: { xs: '0 1px 2px rgba(0,0,0,0.05)', sm: '0 2px 4px rgba(0,0,0,0.1)', ...},
  typography: { fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '24px' } }
};
```

### CSS Variables

Components use CSS variables for theming:

```css
:root {
  --primary-color: #007bff;
  --text-color: #212529;
  --bg-color: #ffffff;
  --spacing-md: 16px;
  --border-radius-md: 8px;
}
```

### Responsive Breakpoints

```css
/* Mobile-first approach */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Large desktop */ }
```

---

## Accessibility Features

All components implement WCAG 2.1 AA standards:

1. **Semantic HTML** - Proper heading hierarchy, landmarks
2. **ARIA Labels** - Descriptive labels for interactive elements
3. **Keyboard Navigation** - Tab order, Enter/Space activation
4. **Focus Management** - Visible focus indicators
5. **Color Contrast** - 4.5:1 minimum for text
6. **Screen Reader Support** - ARIA live regions, role attributes

---

## Component File Structure

```
src/components/
├── common/           # Reusable utility components
├── debug/            # Development/debugging components
├── editor/           # Data editor components
├── game/             # Game board and gameplay components
├── layout/           # Layout and routing components
├── modals/           # Modal dialog components
└── player/           # Player panel and sections
    └── sections/     # Player panel section components
```

---

## Best Practices

### Component Design
1. **Single Responsibility** - Each component has one clear purpose
2. **Props Over State** - Prefer props drilling over complex state management
3. **Service Injection** - Pass `gameServices` container for dependencies
4. **Accessibility First** - Include ARIA attributes and keyboard support
5. **Mobile First** - Design for mobile, enhance for desktop

### Performance
1. **React.memo** - Memoize expensive components
2. **Lazy Loading** - Code-split modal components
3. **Virtual Scrolling** - For long lists (game log, card lists)
4. **Debounced Updates** - Throttle rapid state changes

### Testing
1. **Component Tests** - Test rendering, interactions, edge cases
2. **Accessibility Tests** - Verify ARIA, keyboard navigation
3. **Responsive Tests** - Test at different breakpoints
4. **Integration Tests** - Test component interactions

---

## Migration Guide

### From Old UI (Pre-Oct 2025)

**Key Changes:**
1. **PlayerPanel** replaced monolithic panel with expandable sections
2. **NextStepButton** replaced scattered action buttons
3. **ExpandableSection** new pattern for organizing content
4. **Action Indicators** (🔴) replace hidden/unclear actions

**Migration Steps:**
1. Update `gameServices` injection patterns
2. Replace old panel refs with `PlayerPanel` component
3. Update CSS imports to use new `ExpandableSection.css`
4. Remove old action button components
5. Test multi-device functionality with QR codes

### Component Prop Changes

**PlayerPanel:**
- Old: `player`, `gameState`, individual service props
- New: `gameServices`, `playerId`

**Benefits:**
- Cleaner dependency injection
- Easier testing with mock services
- Better separation of concerns

---

## Known Limitations

1. **Component Tests Isolation** - Cannot run all component tests together due to module-level mock interference (run individually or in small batches)
2. **E2E Manual Actions** - Manual action button clicks don't work in test environment (E2E-01 test skipped)
3. **Browser Support** - Optimized for modern browsers (Chrome 90+, Firefox 88+, Safari 14+)

---

**Version History:**
- 1.0 (Nov 30, 2025) - Initial comprehensive documentation
- UI Redesign Phases 1-5 complete (Oct-Nov 2025)
- Production ready for December 2025 release
