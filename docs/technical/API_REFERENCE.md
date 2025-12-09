# API Reference - Game Alpha

**Last Updated:** December 9, 2025
**Version:** 1.0
**Status:** Production Ready

---

## Table of Contents

1. [Service APIs](#service-apis)
2. [Component APIs](#component-apis)
3. [Movement System API](#movement-system-api)
4. [Type Definitions](#type-definitions)

---

## Service APIs

For detailed service architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md).

### Core Services Quick Reference

#### DataService
```typescript
interface IDataService {
  // Card data
  getCardById(cardId: string): Card | undefined;
  getCardsByType(type: CardType): Card[];

  // Space data
  getGameConfigBySpace(spaceName: string): GameConfig | undefined;
  getSpaceContent(spaceName: string): SpaceContent | undefined;

  // Movement data
  getMovementData(space: string, visitType: VisitType): MovementData | undefined;
  getDiceOutcomes(space: string, visitType: VisitType): DiceOutcome | undefined;

  // Effects data
  getSpaceEffects(spaceName: string): SpaceEffect[];
  getDiceEffects(spaceName: string): DiceEffect[];
}
```

#### StateService
```typescript
interface IStateService {
  // State access
  getState(): GameState;
  getPlayer(playerId: string): Player | undefined;

  // Player updates
  updatePlayer(updates: Partial<Player> & { id: string }): void;

  // Game state
  setCurrentPlayer(playerId: string): void;
  incrementTurn(): void;

  // Logging
  logToActionHistory(entry: ActionLogEntry): void;

  // Snapshots (for Try Again feature)
  savePreSpaceEffectSnapshot(playerId: string): void;
  revertPlayerToSnapshot(playerId: string): void;
}
```

#### CardService
```typescript
interface ICardService {
  // Card actions
  playCard(playerId: string, cardId: string): Promise<CardPlayResult>;
  drawCards(playerId: string, count: number, type?: CardType): void;
  transferCard(fromId: string, toId: string, cardId: string): TransferResult;

  // Card state
  activateCard(playerId: string, cardId: string, duration: number): void;
  discardCard(playerId: string, cardId: string, reason?: string): void;

  // Card expiration
  processCardExpirations(playerId: string): Effect[];
}
```

#### TurnService
```typescript
interface ITurnService {
  // Turn lifecycle
  startTurn(playerId: string): Promise<void>;
  endTurn(playerId: string): Promise<void>;
  nextPlayer(): void;

  // Turn actions
  rollDice(playerId: string): Promise<DiceRollResult>;
  tryAgainOnSpace(playerId: string): Promise<void>;

  // Win conditions
  checkWinCondition(playerId: string): boolean;
  getWinningPlayer(): Player | null;
}
```

#### MovementService
```typescript
interface IMovementService {
  // Movement actions
  getValidMoves(playerId: string): string[];
  validateMove(playerId: string, destination: string): boolean;
  finalizeMove(playerId: string, destination: string): void;

  // Movement type
  getMovementType(space: string, visitType: VisitType): MovementType;
}
```

#### EffectEngineService
```typescript
interface IEffectEngineService {
  // Effect processing
  executeEffects(effects: Effect[], context: EffectContext): Promise<EffectResult>;
  processEffect(effect: Effect, context: EffectContext): Promise<void>;

  // Space effects
  processSpaceArrivalEffects(playerId: string): Promise<void>;
  processLeavingSpaceEffects(playerId: string): Promise<void>;
}
```

---

## Component APIs

### Player Panel Components

#### PlayerPanel
**Location:** `src/components/player/PlayerPanel.tsx`

Main container for player-specific UI with mobile-first responsive design.

```typescript
interface PlayerPanelProps {
  gameServices: IServiceContainer;
  playerId: string;
}

<PlayerPanel
  gameServices={serviceContainer}
  playerId="player1"
/>
```

**Features:**
- Expandable sections with action indicators
- Persistent "Next Step" button
- QR code for multi-device support
- Dynamic section visibility

#### ExpandableSection
**Location:** `src/components/player/ExpandableSection.tsx`

Generic collapsible section container with action indicator.

```typescript
interface ExpandableSectionProps {
  title: string;
  hasAction?: boolean;           // Show red dot indicator
  actionCount?: number;          // Number of pending actions
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

<ExpandableSection
  title="Cards"
  hasAction={true}
  actionCount={2}
  defaultExpanded={false}
>
  <CardsSection {...props} />
</ExpandableSection>
```

#### NextStepButton
**Location:** `src/components/player/NextStepButton.tsx`

Always-visible button showing next available action or end turn.

```typescript
interface NextStepButtonProps {
  gameServices: IServiceContainer;
  playerId: string;
}

<NextStepButton
  gameServices={serviceContainer}
  playerId="player1"
/>
```

**States:**
- **Enabled:** "End Turn" (no pending actions)
- **Disabled:** "X actions remaining" (grayed out)

### Section Components

#### CurrentCardSection
**Location:** `src/components/player/sections/CurrentCardSection.tsx`

Displays current location and active space effects.

```typescript
interface CurrentCardSectionProps {
  gameServices: IServiceContainer;
  playerId: string;
}
```

#### FinancesSection
**Location:** `src/components/player/sections/FinancesSection.tsx`

Money management: balance, loans, transactions, "Get Funding" button.

```typescript
interface FinancesSectionProps {
  gameServices: IServiceContainer;
  playerId: string;
}
```

**Features:**
- Current money balance
- Active loans with details
- Get Funding button (space-specific)
- Transaction history

#### TimeSection
**Location:** `src/components/player/sections/TimeSection.tsx`

Time tracking and "Roll to Move" button for dice spaces.

```typescript
interface TimeSectionProps {
  gameServices: IServiceContainer;
  playerId: string;
}
```

#### CardsSection
**Location:** `src/components/player/sections/CardsSection.tsx`

Card portfolio: available, active, and discarded cards.

```typescript
interface CardsSectionProps {
  gameServices: IServiceContainer;
  playerId: string;
}
```

**Features:**
- Available cards (hand)
- Active cards with durations
- Discarded cards
- Play/transfer actions

### Modal Components

#### ChoiceModal
**Location:** `src/components/modals/ChoiceModal.tsx`

Generic modal for player choices (movement, card effects, etc.).

```typescript
interface ChoiceModalProps {
  gameServices: IServiceContainer;
  choice: PendingChoice;
  playerId: string;
  onClose: () => void;
}

interface PendingChoice {
  type: 'movement' | 'card_discard' | 'generic';
  prompt: string;
  options: ChoiceOption[];
  context?: any;
}
```

#### CardDetailsModal
**Location:** `src/components/modals/CardDetailsModal.tsx`

Detailed card view with play/transfer actions.

```typescript
interface CardDetailsModalProps {
  gameServices: IServiceContainer;
  card: Card;
  playerId: string;
  onClose: () => void;
}
```

**Actions:**
- Play card
- Transfer to another player
- View full details

#### NegotiationModal
**Location:** `src/components/modals/NegotiationModal.tsx`

Player-to-player negotiation and offers.

```typescript
interface NegotiationModalProps {
  gameServices: IServiceContainer;
  negotiation: ActiveNegotiation;
  playerId: string;
  onClose: () => void;
}
```

### Game Board Components

#### TurnControls
**Location:** `src/components/game/TurnControls.tsx`

Main turn action buttons (roll dice, end turn, try again).

```typescript
interface TurnControlsProps {
  gameServices: IServiceContainer;
}
```

**Actions:**
- Roll Dice
- End Turn
- Try Again
- Start Game (setup phase)

#### GameLog
**Location:** `src/components/game/GameLog.tsx`

Scrollable action history with player color coding.

```typescript
interface GameLogProps {
  gameServices: IServiceContainer;
}
```

**Features:**
- Grouped by player/system
- Color-coded entries
- Timestamps
- Action icons (🎲 🃏 📍 ⚡)

#### GameBoard
**Location:** `src/components/game/GameBoard.tsx`

Visual game board with space positions.

```typescript
interface GameBoardProps {
  gameServices: IServiceContainer;
}
```

### Utility Components

#### ConnectionStatus
**Location:** `src/components/utility/ConnectionStatus.tsx`

Server connection indicator.

```typescript
interface ConnectionStatusProps {
  serverUrl: string;
}
```

#### ErrorBoundary
**Location:** `src/components/ErrorBoundary.tsx`

React error boundary for graceful error handling.

```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
```

---

## Movement System API

### Overview

The Movement System manages player navigation through game spaces with four movement types:

| Type | Description | Example |
|------|-------------|---------|
| **fixed** | Single destination | OWNER-SCOPE-INITIATION → OWNER-FUND-INITIATION |
| **choice** | Player selects destination | PM-DECISION-CHECK → [ENG, ARCH, PM] |
| **dice** | Dice roll determines destination | REG-DOB-PLAN-EXAM → [dice outcomes] |
| **none** | No movement (terminal) | FINISH |

### MovementService API

#### getValidMoves()
Returns array of valid destination spaces for current player.

```typescript
getValidMoves(playerId: string): string[]

// Example
const moves = movementService.getValidMoves('player1');
// Returns: ['ARCH-INITIATION', 'ENG-INITIATION', 'PM-DECISION-CHECK']
```

**Logic:**
1. Gets player's current space and visit type
2. Loads movement data from CSV
3. Applies path choice memory filtering (if applicable)
4. Returns destination array

#### validateMove()
Validates if a proposed move is legal.

```typescript
validateMove(playerId: string, destination: string): boolean

// Example
const isValid = movementService.validateMove('player1', 'ARCH-INITIATION');
// Returns: true or false
```

#### finalizeMove()
Executes the move and updates player state.

```typescript
finalizeMove(playerId: string, destination: string): void

// Example
movementService.finalizeMove('player1', 'ARCH-INITIATION');
// Updates player.currentSpace, player.visitedSpaces, path choice memory
```

**Side Effects:**
- Updates `player.currentSpace`
- Adds to `player.visitedSpaces` map
- Stores path choice memory (if applicable)
- Increments visit count

#### getMovementType()
Returns movement type for a space.

```typescript
getMovementType(space: string, visitType: VisitType): MovementType

// Example
const type = movementService.getMovementType('PM-DECISION-CHECK', 'First');
// Returns: 'choice'
```

### Path Choice Memory

Some spaces lock player choices for compliance (e.g., DOB regulations).

#### Interface
```typescript
interface Player {
  pathChoiceMemory?: {
    'REG-DOB-TYPE-SELECT'?: 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT';
    // Extensible for future spaces
  };
}
```

#### Behavior
**First Visit:** Player chooses between Plan Exam or Professional Certification
```typescript
// All options available
getValidMoves('player1')
// Returns: ['REG-DOB-PLAN-EXAM', 'REG-DOB-PROF-CERT']

finalizeMove('player1', 'REG-DOB-PLAN-EXAM')
// Stores: pathChoiceMemory['REG-DOB-TYPE-SELECT'] = 'REG-DOB-PLAN-EXAM'
```

**Subsequent Visit:** Choice locked to previous selection
```typescript
// Filtered to remembered choice only
getValidMoves('player1')
// Returns: ['REG-DOB-PLAN-EXAM']
```

### Dice Movement

For dice-based spaces, destinations come from `DICE_OUTCOMES.csv`.

#### Flow
```typescript
// 1. Player rolls dice
const result = await turnService.rollDice('player1');
// Returns: { value: 4, destination: 'ARCH-INITIATION' }

// 2. System auto-presents single-option choice
// ChoiceModal shows: "Move to ARCH-INITIATION"

// 3. Player confirms
movementService.finalizeMove('player1', 'ARCH-INITIATION');
```

### CSV Data Structure

#### MOVEMENT.csv
```csv
space_name,visit_type,movement_type,destination_1,destination_2,destination_3
CON-INITIATION,First,fixed,CON-ISSUES
PM-DECISION-CHECK,First,choice,ENG-INITIATION,ARCH-INITIATION,PM-DECISION-CHECK
REG-DOB-PLAN-EXAM,First,dice
FINISH,First,none
```

#### DICE_OUTCOMES.csv
```csv
space_name,visit_type,outcome_1,outcome_2,outcome_3,outcome_4,outcome_5,outcome_6
REG-DOB-PLAN-EXAM,First,REG-FDNY-FEE-REVIEW,REG-DOB-PLAN-EXAM,ARCH-INITIATION,ARCH-INITIATION,REG-FDNY-FEE-REVIEW,REG-FDNY-FEE-REVIEW
```

---

## Type Definitions

### Core Types

#### Player
```typescript
interface Player {
  id: string;
  name: string;
  color: string;
  currentSpace: string;
  money: number;
  time: number;
  projectScope: number;

  // Cards
  availableCards: CardsByType;
  activeCards: ActiveCard[];
  discardedCards: Card[];

  // Movement
  visitedSpaces: Map<string, number>;
  pathChoiceMemory?: PathChoiceMemory;

  // Loans
  loans?: Loan[];

  // Snapshots
  preSpaceEffectSnapshot?: Player;
}
```

#### Card
```typescript
interface Card {
  card_id: string;
  card_name: string;
  card_type: CardType;
  effect_text: string;
  cost: number;
  duration?: number;
  phase_restriction?: string;
  is_transferable: boolean;
}

type CardType = 'W' | 'B' | 'E' | 'L' | 'I';
```

#### GameState
```typescript
interface GameState {
  // Game metadata
  gameRound: number;
  globalTurnCount: number;
  currentPlayerId: string;
  phase: 'SETUP' | 'PLAY' | 'END';

  // Players
  players: Player[];

  // Cards
  decks: CardDecks;

  // Logging
  actionLog: ActionLogEntry[];
  currentExplorationSessionId: string | null;

  // UI state
  pendingChoice: PendingChoice | null;
  notifications: Notification[];
}
```

#### Effect Types
```typescript
type Effect =
  | ResourceChangeEffect
  | CardDrawEffect
  | CardDiscardEffect
  | CardActivationEffect
  | PlayerMovementEffect
  | TurnControlEffect
  | ChoiceEffect
  | EffectGroupTargeted
  | ConditionalEffect
  | RecalculateScopeEffect
  | LogEffect;

interface EffectContext {
  playerId: string;
  playerName?: string;
  diceRoll?: number;
  metadata?: Record<string, any>;
}
```

### Movement Types

```typescript
type MovementType = 'fixed' | 'choice' | 'dice' | 'none';
type VisitType = 'First' | 'Subsequent';

interface MovementData {
  space_name: string;
  visit_type: VisitType;
  movement_type: MovementType;
  destinations: string[];
}

interface PathChoiceMemory {
  'REG-DOB-TYPE-SELECT'?: 'REG-DOB-PLAN-EXAM' | 'REG-DOB-PROF-CERT';
  // Extensible
}
```

---

## Additional Resources

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and patterns
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Testing strategies
- **[CODE_STYLE.md](./CODE_STYLE.md)** - UI patterns and conventions
- **[CHANGELOG.md](../../CHANGELOG.md)** - Change history

---

**Last Updated:** December 9, 2025
**Maintained By:** Claude (AI Lead Programmer)
