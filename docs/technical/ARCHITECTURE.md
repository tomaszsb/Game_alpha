# Architecture Guide - Game Alpha

**Last Updated:** December 9, 2025
**Status:** Production Ready
**Test Coverage:** 966/967 tests passing

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Services](#core-services)
3. [Architectural Patterns](#architectural-patterns)
4. [Game Actions Flow](#game-actions-flow)
5. [Effect Engine System](#effect-engine-system)
6. [State Management](#state-management)
7. [Data Architecture](#data-architecture)
8. [Testing Architecture](#testing-architecture)
9. [Code Quality Standards](#code-quality-standards)

---

## System Overview

### Design Philosophy

Game Alpha is built on a **service-oriented architecture** with strict dependency injection, eliminating the Service Locator anti-patterns of the prototype (code2026). The system follows these core principles:

- **Clean Separation of Concerns:** Business logic in services, UI logic in components
- **Dependency Injection:** No global state access (`window.*`), all dependencies injected
- **Immutable State:** All state updates return new objects, enabling snapshots and time-travel
- **Type Safety:** TypeScript strict mode with 100% compliance
- **Comprehensive Testing:** Unit, component, integration, and E2E test coverage

### Technology Stack

- **Frontend:** React 18, TypeScript, Vite
- **Backend:** Express (Node.js) for multi-device state sync
- **Testing:** Vitest, React Testing Library
- **Styling:** CSS3 with CSS variables
- **Data:** CSV-based game configuration

---

## Core Services

### Service Overview (14 Production Services)

All services are fully typed and comply with TypeScript strict mode:

```typescript
DataService           // CSV data loading and caching
StateService          // Immutable game state management
TurnService           // Turn progression and win conditions
CardService           // Card operations and deck management
PlayerActionService   // Command orchestration
MovementService       // Space transitions and pathfinding
GameRulesService      // Validation and win conditions
EffectEngineService   // Unified effect processing
ResourceService       // Money, time, reputation tracking
ChoiceService         // Player choice handling
NegotiationService    // Player-to-player interactions
NotificationService   // Unified notification system
TargetingService      // Multi-player effect targeting
LoggingService        // Centralized game logging
```

### Service Dependency Pattern

Services follow constructor-based dependency injection:

```typescript
class CardService {
  constructor(
    private dataService: DataService,
    private stateService: StateService,
    private effectEngineService: EffectEngineService
  ) {}

  playCard(playerId: string, cardId: string): CardPlayResult {
    // Business logic with injected dependencies
    const card = this.dataService.getCardById(cardId);
    const player = this.stateService.getPlayer(playerId);
    // ... validation and effect processing
  }
}
```

### Service Contracts

All services implement interfaces defined in `ServiceContracts.ts`:

```typescript
interface ICardService {
  playCard(playerId: string, cardId: string): Promise<CardPlayResult>;
  drawCards(playerId: string, count: number, type?: CardType): void;
  transferCard(fromId: string, toId: string, cardId: string): TransferResult;
  // ... other methods
}
```

---

## Architectural Patterns

### 1. Dependency Injection

**Problem Solved:** Eliminates Service Locator anti-pattern from code2026 prototype

**Pattern:**
```typescript
// ❌ ANTI-PATTERN (code2026)
const dataService = window.gameServices.dataService;

// ✅ CORRECT PATTERN (Game Alpha)
const { dataService } = useGameContext();
```

**Component Integration:**
```typescript
function CardPortfolio({ gameServices }: { gameServices: IServiceContainer }) {
  const { cardService, stateService } = gameServices;

  const handlePlayCard = async (cardId: string) => {
    await cardService.playCard(playerId, cardId);
  };

  return <CardGrid cards={player.availableCards} onPlay={handlePlayCard} />;
}
```

### 2. Immutable State Updates

**Pattern:**
```typescript
// Player state updates always return new objects
const updatePlayer = (player: Player, changes: Partial<Player>): Player => ({
  ...player,
  ...changes
});

// Resource updates create new state
stateService.updatePlayer({
  id: player.id,
  money: player.money + amount
});
```

**Benefits:**
- Enables snapshot-based "Try Again" feature
- Predictable state changes
- Easy debugging and testing
- Time-travel debugging support

### 3. Service Orchestration

Higher-level services orchestrate lower-level services:

```typescript
class TurnService {
  async startTurn(playerId: string): Promise<void> {
    // Orchestrates multiple services
    await this.loggingService.startNewExplorationSession();
    await this.effectEngineService.processSpaceArrivalEffects(playerId);
    this.notificationService.notifyTurnStart(playerId);
  }
}
```

### 4. Error Handling Strategy

**Consistent error handling across all services:**

```typescript
try {
  const result = await serviceMethod(params);
  this.notificationService.success(result.message);
} catch (error) {
  this.loggingService.error('Operation failed', { error, context });
  this.notificationService.error('User-friendly error message');
  throw error; // Re-throw for component-level handling
}
```

---

## Game Actions Flow

### Action Processing Pipeline

Every game event follows this standardized flow:

```
User Action → Service Method → Effect[] → EffectEngine → State Update → UI Update
```

### Action Types and Triggers

#### Manual Actions (Player-Initiated)

| Action | Component | Service | Effect Types |
|--------|-----------|---------|--------------|
| **Roll Dice** | TurnControls | TurnService | MovementChoice, TurnControl |
| **Play Card** | CardPortfolio | CardService | ResourceChange, CardDraw, etc. |
| **End Turn** | TurnControls | TurnService | TurnControl, Logging |
| **Choose Path** | ChoiceModal | MovementService | PlayerMovement |
| **Transfer Card** | CardDetailsModal | CardService | CardTransfer |
| **Make Offer** | NegotiationModal | NegotiationService | Multi-player effects |
| **Try Again** | TurnControls | TurnService | StateRevert, Logging |

#### Automatic Actions (System-Triggered)

| Trigger | Service | Effect Types |
|---------|---------|--------------|
| **Space Arrival** | TurnService | Space effects from CSV |
| **Turn End** | TurnService | Card expiration, duration effects |
| **Card Activation** | EffectEngine | Duration-based effects |
| **Win Condition** | GameRulesService | GameEnd effect |

### Example: Card Play Flow

```typescript
// 1. User clicks "Play Card" button
<button onClick={() => handlePlayCard(cardId)}>Play</button>

// 2. Component calls service
const handlePlayCard = async (cardId: string) => {
  try {
    const result = await cardService.playCard(playerId, cardId);
    // Result contains: success, effects, message
  } catch (error) {
    // Error handling with user feedback
  }
};

// 3. CardService processes
async playCard(playerId: string, cardId: string): Promise<CardPlayResult> {
  // Validation
  const card = this.dataService.getCardById(cardId);
  const player = this.stateService.getPlayer(playerId);
  this.validateCardPlay(player, card);

  // Create effects from card data
  const effects = EffectFactory.createEffectsFromCardData(card, playerId);

  // Execute effects
  await this.effectEngineService.executeEffects(effects, { playerId });

  // Update card state
  this.stateService.moveCardToActive(playerId, cardId);

  return { success: true, effects, message: `Played ${card.card_name}` };
}

// 4. EffectEngine processes each effect
// 5. State updates trigger UI re-render
```

---

## Effect Engine System

### Overview

The **Unified Effect Engine** is the core architectural achievement of Game Alpha. It standardizes all game events into Effect objects, creating a single processing pipeline.

### Effect Types (Discriminated Union)

```typescript
type Effect =
  | ResourceChangeEffect      // Money, time, reputation changes
  | CardDrawEffect           // Drawing cards from decks
  | CardDiscardEffect        // Discarding cards
  | CardActivationEffect     // Activating duration-based cards
  | PlayerMovementEffect     // Moving between spaces
  | TurnControlEffect        // Turn skipping, extra turns
  | ChoiceEffect            // Player decision dialogs
  | EffectGroupTargeted      // Multi-player targeting
  | ConditionalEffect       // Dice roll conditional logic
  | RecalculateScopeEffect   // Project scope recalculation
  | LogEffect               // Game logging
```

### Effect Processing Flow

```typescript
// Data Source → EffectFactory → Effect[] → EffectEngine → State Change

// 1. Card CSV data
const cardData = dataService.getCardById('W001');

// 2. EffectFactory creates Effect objects
const effects = EffectFactory.createEffectsFromCardData(cardData, playerId);
// Returns: [
//   { effectType: 'RESOURCE_CHANGE', payload: { resourceType: 'TIME', value: -2 } },
//   { effectType: 'CARD_DRAW', payload: { cardType: 'W', count: 1 } }
// ]

// 3. EffectEngine executes
await effectEngineService.executeEffects(effects, context);
// Internally routes to:
//   - ResourceService.adjustResource() for RESOURCE_CHANGE
//   - CardService.drawCards() for CARD_DRAW

// 4. State updates automatically trigger UI re-render
```

### EffectFactory Patterns

**Card Effect Creation:**
```typescript
EffectFactory.createEffectsFromCardData(card, playerId);
```

**Space Effect Creation:**
```typescript
EffectFactory.createEffectsFromSpaceEffects(spaceEffects, context);
```

**Dice Effect Creation:**
```typescript
EffectFactory.createEffectsFromDiceEffects(diceEffects, context);
```

### Conditional Effects (Dice-Based)

For cards with "Roll a die. On 1-3 [effect]. On 4-6 [effect]." mechanics:

```typescript
{
  effectType: 'CONDITIONAL_EFFECT',
  payload: {
    playerId: string,
    condition: {
      type: 'DICE_ROLL',
      ranges: [
        { min: 1, max: 3, effects: [/* effects if 1-3 */] },
        { min: 4, max: 6, effects: [/* effects if 4-6 */] }
      ]
    }
  }
}
```

**Runtime Evaluation:**
```typescript
// Engine evaluates dice roll against ranges
const matchingRange = ranges.find(r => diceRoll >= r.min && diceRoll <= r.max);
await this.processEffects(matchingRange.effects, context);
```

---

## State Management

### StateService Architecture

Game Alpha uses a **custom StateService** instead of Redux for these reasons:

1. **Simplicity:** Direct method calls instead of action creators + reducers
2. **Performance:** Minimal overhead, targeted updates
3. **Type Safety:** Full TypeScript support without Redux complexity
4. **Dependency-Free:** No external state management libraries

### State Structure

```typescript
interface GameState {
  // Game metadata
  gameRound: number;              // Current game round
  globalTurnCount: number;        // Total turns taken
  currentPlayerId: string;        // Active player
  phase: 'SETUP' | 'PLAY' | 'END';

  // Player data
  players: Player[];              // All player states

  // Card data
  decks: CardDecks;               // Remaining cards in decks

  // Logging
  actionLog: ActionLogEntry[];    // Game history
  currentExplorationSessionId: string | null;

  // UI state
  pendingChoice: PendingChoice | null;
  notifications: Notification[];
}
```

### Immutable Update Pattern

```typescript
class StateService {
  updatePlayer(updates: Partial<Player> & { id: string }): void {
    const currentState = this.getState();
    const playerIndex = currentState.players.findIndex(p => p.id === updates.id);

    // Create new player object
    const updatedPlayer = {
      ...currentState.players[playerIndex],
      ...updates
    };

    // Create new players array
    const updatedPlayers = [
      ...currentState.players.slice(0, playerIndex),
      updatedPlayer,
      ...currentState.players.slice(playerIndex + 1)
    ];

    // Create new state
    this.setState({
      ...currentState,
      players: updatedPlayers
    });

    // Notify subscribers (triggers React re-render)
    this.notifySubscribers();
  }
}
```

### Context API Integration

Components access services via React Context:

```typescript
const { stateService, cardService, turnService } = useGameContext();

// Direct service calls with full TypeScript support
const player = stateService.getPlayer(playerId);
const result = await cardService.playCard(playerId, cardId);
```

---

## Data Architecture

### CSV Data Files

Game data is stored in CSV files at `/public/data/CLEAN_FILES/`:

| File | Purpose | Key Fields |
|------|---------|-----------|
| **GAME_CONFIG.csv** | Space configuration | space_name, phase, starting_position |
| **MOVEMENT.csv** | Movement connections | from_space, path_type, destinations |
| **CARDS.csv** | Card definitions | card_id, card_name, effect_text, cost |
| **SPACE_CONTENT.csv** | UI text | space_name, story_text, action_text |
| **SPACE_EFFECTS.csv** | Space effects | space_name, effect_type, value |
| **DICE_EFFECTS.csv** | Dice roll effects | space_name, dice_value, effect |
| **DICE_OUTCOMES.csv** | Dice destinations | space_name, dice_value, destination |

### Data Access Pattern

**✅ CORRECT:** Always use DataService

```typescript
const cards = dataService.getCardsByType('W');
const spaceConfig = dataService.getGameConfigBySpace(spaceName);
const movements = dataService.getMovementsBySpace(spaceName);
```

**❌ NEVER:** Direct CSV access or hardcoded data

```typescript
// DON'T DO THIS
import cardsCSV from '../data/CARDS.csv';
```

### Data Loading and Caching

```typescript
class DataService {
  private cache: Map<string, any> = new Map();

  async loadCards(): Promise<Card[]> {
    if (this.cache.has('cards')) {
      return this.cache.get('cards');
    }

    const response = await fetch('/data/CLEAN_FILES/CARDS.csv');
    const csvText = await response.text();
    const cards = this.parseCSV(csvText);

    this.cache.set('cards', cards);
    return cards;
  }
}
```

---

## Testing Architecture

### Test Organization

```
tests/
├── services/           # Service unit tests (90%+ coverage target)
├── components/         # Component tests (UI behavior)
├── integration/        # Service interaction tests
├── E2E/               # End-to-end gameplay scenarios
└── scripts/           # Test utility scripts
```

### Testing Patterns

**Service Unit Tests:**
```typescript
describe('CardService', () => {
  let cardService: CardService;
  let mockDataService: jest.Mocked<DataService>;
  let mockStateService: jest.Mocked<StateService>;

  beforeEach(() => {
    mockDataService = createMockDataService();
    mockStateService = createMockStateService();
    cardService = new CardService(mockDataService, mockStateService);
  });

  it('should play card and execute effects', async () => {
    const result = await cardService.playCard('player1', 'W001');
    expect(result.success).toBe(true);
    expect(mockStateService.updatePlayer).toHaveBeenCalled();
  });
});
```

**Component Tests:**
```typescript
describe('CardPortfolio', () => {
  it('should display player cards', () => {
    const { getAllByTestId } = render(
      <CardPortfolio gameServices={mockServices} playerId="player1" />
    );
    expect(getAllByTestId('card-item')).toHaveLength(3);
  });
});
```

**E2E Tests:**
```typescript
describe('E2E: Happy Path', () => {
  it('should complete full game from start to finish', async () => {
    // Setup game with 2 players
    // Play through turns
    // Verify win condition
  });
});
```

### Test Execution

**Recommended:** Run tests in batches to avoid module-level mock isolation issues

```bash
# Run by directory
npm test tests/services/
npm test tests/components/

# Run specific file
npm test tests/services/TurnService.test.tsx
```

---

## Code Quality Standards

### File Size Limits

- **Components:** <1,000 lines (prefer <400)
- **Services:** <300 lines
- **Utilities:** <150 lines
- **Tests:** No limit (comprehensive coverage required)

### TypeScript Requirements

- **Strict Mode:** Enabled (tsconfig.json)
- **No `any` Types:** Use proper interfaces
- **Full Type Coverage:** All functions, props, state typed
- **Interface Contracts:** All services implement interfaces

### Code Review Checklist

- [ ] No `window.*` access (use dependency injection)
- [ ] All dependencies injected via props/constructor
- [ ] TypeScript types for all interfaces
- [ ] Unit tests for business logic
- [ ] Component tests for UI
- [ ] File size limits respected
- [ ] Single responsibility principle
- [ ] CSV data accessed through DataService only

### Service Development Guidelines

1. **Dependency Injection:** Constructor-based injection
2. **Interface Contracts:** Implement ServiceContracts interfaces
3. **Immutable Patterns:** Return new objects, never mutate
4. **Error Handling:** Try-catch with meaningful messages
5. **Testing:** 90%+ coverage target

### Component Development Guidelines

1. **Single Responsibility:** UI rendering only
2. **Props-Based Data:** No global state access
3. **TypeScript Required:** All props fully typed
4. **Service Integration:** Use `useGameContext()` hook
5. **Error Handling:** Graceful degradation with user feedback

---

## Additional Topics

For related architecture topics, see:

- **[API_REFERENCE.md](./API_REFERENCE.md)** - Component and service APIs
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Comprehensive testing strategy
- **[CODE_STYLE.md](./CODE_STYLE.md)** - UI patterns and code conventions
- **[CHANGELOG.md](../../CHANGELOG.md)** - Technical change history

---

**Last Updated:** December 9, 2025
**Maintained By:** Claude (AI Lead Programmer)
