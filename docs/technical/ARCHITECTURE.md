# Architecture Guide - Unravel Codes: The Game

**Last Updated:** August 1, 2026
**Status:** Beta (v3.1.85) — live in production
**Test Coverage:** 183 test files, 2,582+ tests passing (1 pre-existing skip) as of v3.1.84. Plain `npm test` now runs the full suite directly in ~100s — the 20-30 min ghost-bot gates that used to force batch workarounds were split out to `npm run test:ghost` in v3.1.14. `./tests/scripts/run-tests-batch-fixed.sh` (23 batches) still exists and still passes, but is no longer required for a clean run.

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

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Express (Node.js) for multi-device state sync
- **Testing:** Vitest, React Testing Library
- **Styling:** CSS3 with CSS variables
- **Data:** CSV-based game configuration

---

## Core Services

### Service Overview

All services are fully typed and comply with TypeScript strict mode (`npm run typecheck` returns 0 errors, verified as of v3.1.85). 33 service files in `src/services/` (ApprovalService added v2.65.0; PlayerActionService deleted v3.1.9 — it was the classic panel's card-play orchestrator, dead since the v3.0.128–137 panel removal, which also deleted `CardModal`/`CardsSection`/`ActionCenterPanel`/`CardPortfolioDashboard`; the live play path is `CardService.playCard`). **The classic panel is gone entirely** — `PlayerPanelV2` + `ScoreboardV2` + `TurnCommitControl` are now the only player UI (no toggle, no fallback). Five service files were added in July 2026 alongside the domain-event refactor and the TurnService split — `GameEventBus`, `LogWriter`, `ToastWriter`, `TurnEffectsOrchestrator`, `ManualActionProcessor` — listed below.

```typescript
// Core Services (in IServiceContainer)
DataService            // CSV data loading and caching; engine-data lookups (Workstream 6 flags)
StateService           // Immutable game state management; REAL/TEMP turn lifecycle
TurnService            // Turn progression and win conditions
CardService            // Card operations and deck management (incl. playCard — the one manual play path; also the Homeowner Violation mechanic, v3.1.84 — see below)
MovementService        // Space transitions, pathfinding, path-choice memory + cross-space rules
GameRulesService       // Validation and win conditions; condition evaluator
EffectEngineService    // Unified effect processing (delegates to handlers)
ResourceService        // Money, time tracking with affordability gating
ChoiceService          // Player choice handling; also backs NegotiationService's partner-side accept/decline (v3.1.83)
NegotiationService     // Player-to-player interactions — trading is reachable in production via card E075 "Backchannel Favor" (v3.1.83)
NotificationService    // Unified notification system
TargetingService       // Multi-player effect targeting
LoggingService         // Centralized game logging with exploration sessions

// Extracted/Specialized Services
ServerSyncService      // HTTP state sync (extracted from StateService, Jan 2026)
CardEffectService      // Card draw/replace/return operations
FinancialEffectHandler // Financial effect processing for EffectEngineService
CardEffectHandler      // Card effect processing for EffectEngineService
WebSocketSyncService   // WebSocket real-time state synchronization
SpeechService          // Text-to-speech character voice narration
ApprovalService        // Plan-approval state machine (Workstream 7, v2.65.0) — pure-logic, no state mutation; returns PlayerUpdateData partials that callers apply via StateService
GameEventBus           // Synchronous, ordered dispatch for typed GameEvents (domain-event stage 2, Jul 2026) — see "Game Event Bus" under State Management
LogWriter              // Subscribes to GameEventBus; writes the permanent-log half of each event via LoggingService (domain-event stage 3, v3.1.7)
ToastWriter            // Subscribes to GameEventBus; fires the toast half of each event via NotificationService (domain-event stage 3, v3.1.7)

// Internal helper services
DiceService            // Dice rolling and outcome lookup
SpaceEffectService     // Space effect retrieval; data-driven design fee math
DiceRollProcessor      // Dice roll processing with callbacks
SpaceArrivalProcessor  // Space arrival effect processing
TurnStateManager       // REAL/TEMP state lifecycle + per-player per-turn TurnCostLedger (moneySpent/cardsConsumed/lifeEventsDrawn)
TurnTransitionHandler  // Extracted from TurnService.nextPlayer() (Mar 2026); also runs the Violation daily-accrual check each turn-end (v3.1.84)
MovementExecutor       // Extracted from TurnService.endTurnWithMovement() (Mar 2026)
TurnEffectsOrchestrator // Extracted from TurnService (Jul 2026) — converts a space's CSV effect rows into Effect objects and runs them through EffectEngine
ManualActionProcessor  // Extracted from TurnService (Jul 2026) — everything that runs when a player presses a manual action button (draw/replace/give cards, money, time, funding)
TooltipService         // Tooltip content management
```

> **Removed services (historical):** PlayerViewStateService (deleted v2.34.0); MovementChoiceManager merged into MovementService (Mar 2026).

### Homeowner Violation Mechanic (v3.1.84)

Two life-event cards (L050 "Notice of Violation", L051 "Immediately Hazardous Violation") add a stateful mini-mechanic that doesn't fit the generic CSV-effect pipeline: drawing either gives the player a corrective Work Package and starts a 180-day countdown to file an Affidavit of Correction, with a civil penalty sized as a percentage of that Work Package's cost (rate depends on tier — small/large project scope, split at $500k — and on-time vs. late filing). L051 additionally accrues a daily penalty once the deadline passes unfiled.

L050/L051 are special-cased directly in `CardService.applyCardEffects` (same pattern as E075 "Backchannel Favor" — see NegotiationService below) rather than expressed as generic Effect objects:

- `handleNoticeOfViolation()` (private) — draws the corrective Work Package, sets six new `Player` fields (`violationStatus`/`violationVariant`/`violationTier`/`violationDeadlineDay`/`violationPenaltyBase`/`violationAccrualCheckpoint`)
- `fileAffidavitOfCorrection()` — the player-initiated action that resolves it, charging the on-time or late rate
- `processViolationDailyAccrual()` — called once per turn-end via `TurnTransitionHandler`, charges L051's overdue-day penalty with a checkpoint so days already charged are never double-billed

Pure fee/tier math (no state access, unit-testable in isolation) lives in `src/utils/violationRules.ts`. An unresolved violation at game end is charged the late rate as a backstop and surfaced in `EndGameModal`.

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

### Circular Dependency Resolution (Setter Injection)

**Scope (April 2026 audit):** Setter injection is used in this codebase **only** to resolve two genuine circular dependencies. It is not a general pattern, and new setter-injection methods should not be added casually. If a dependency *can* be passed through the constructor, it *must* be — that is the default.

**The two intentional cycles:**

1. **`StateService` ↔ `GameRulesService`** — StateService needs GameRulesService to evaluate conditional-effect predicates. GameRulesService needs StateService to query current game state. Resolved via `stateService.setGameRulesService()` at `ServiceProvider.tsx`.

2. **`TurnService` ↔ `EffectEngineService` ↔ `CardService`** (3-way cycle) — TurnService needs EffectEngine to process turn effects; CardService needs EffectEngine to process card effects; EffectEngine needs both TurnService (for TURN_CONTROL effects) and CardService (for card-producing effects). Resolved via `turnService.setEffectEngineService()` and `cardService.setEffectEngineService()` at `ServiceProvider.tsx`, plus four downstream forwards inside TurnService to its handlers (`spaceArrivalProcessor`, `turnTransitionHandler`, `turnEffectsOrchestrator`, `manualActionProcessor` — the latter two added when TurnService was split apart in July 2026) which also participate in the cycle.

These are architectural — collapsing them would require an event bus or command bus, which has its own cost (indirection, harder to trace). They are accepted as-is. Every service with a setter-injected dependency has an `assertDependenciesReady()` guard that throws at the first method call if initialization was skipped, so a silent half-initialized state is impossible.

```typescript
// TurnService needs EffectEngineService, but EffectEngineService needs TurnService
const turnService = new TurnService(dataService, stateService, /* ... */);
const effectEngineService = new EffectEngineService(/* ... */);

// Resolve circular dependency via setters
turnService.setEffectEngineService(effectEngineService);
effectEngineService.setTurnService(turnService);
```

**Assertion Checks (December 2025):**

Services with setter-injected dependencies include assertion methods to catch initialization errors early:

```typescript
// In TurnService
private assertDependenciesReady(): void {
  if (!this.effectEngineService) {
    throw new Error(
      'TurnService not fully initialized: EffectEngineService not set. ' +
      'Call setEffectEngineService() before using TurnService methods.'
    );
  }
}

// Called at start of public methods
async takeTurn(playerId: string): Promise<TurnResult> {
  this.assertDependenciesReady();
  // ... method logic
}
```

**Services with setter injection (intentional — part of a real cycle):**
- `StateService.setGameRulesService()` — cycle 1
- `TurnService.setEffectEngineService()` — cycle 2 (3-way)
- `CardService.setEffectEngineService()` — cycle 2 (3-way)
- `SpaceArrivalProcessor.setEffectEngineService()`, `TurnTransitionHandler.setEffectEngineService()`, `TurnEffectsOrchestrator.setEffectEngineService()`, `ManualActionProcessor.setEffectEngineService()` — forwarded by TurnService as part of cycle 2

**Not a pattern to copy:** Other setter methods (e.g. `EffectEngineService.setNotificationService/setDataService`, handler setters, `CardService.setChoiceService`) exist historically but are being eliminated in favor of constructor injection because the dependency they receive is not part of a real cycle. (The `setCardEffectService` method on TurnService was the last false-cycle setter; migrated to constructor injection in v2.59.0.)

### Handler Pattern (January 2026)

Large services like EffectEngineService delegate to specialized handlers for cleaner code organization:

```typescript
// Handler pattern for EffectEngineService
class EffectEngineService {
  private financialEffectHandler?: FinancialEffectHandler;
  private cardEffectHandler?: CardEffectHandler;

  // Handlers set via dependency injection
  setFinancialEffectHandler(handler: FinancialEffectHandler): void {
    this.financialEffectHandler = handler;
  }

  // Effect processing delegates to handlers
  async processEffect(effect: Effect, context: EffectContext): Promise<EffectResult> {
    switch (effect.effectType) {
      case 'RESOURCE_CHANGE':
      case 'FEE_DEDUCTION':
        if (!this.financialEffectHandler) {
          throw new Error('FinancialEffectHandler not set');
        }
        return this.financialEffectHandler.handleResourceChange(effect, context);

      case 'CARD_DRAW':
      case 'CARD_DISCARD':
        if (!this.cardEffectHandler) {
          throw new Error('CardEffectHandler not set');
        }
        return this.cardEffectHandler.handleCardDraw(effect, context);
    }
  }
}
```

**Benefits:**
- Single-responsibility handlers (~200-400 lines each)
- Easier testing of isolated concerns
- Clear separation between financial and card operations
- EffectEngineService reduced from 2,104 to 1,553 lines (26% reduction)

### ServerSyncService (January 2026)

Extracted from StateService to separate network synchronization from state management:

```typescript
// StateProvider callback pattern for decoupling
interface StateProvider {
  getCurrentState(): GameState;
  setCurrentState(state: GameState, serverVersion?: number): void;
}

class ServerSyncService {
  constructor(private stateProvider: StateProvider) {}

  // Debounced sync to prevent spam during rapid changes
  debouncedSync(): void { /* ... */ }

  // Load state from server on app init
  async loadFromServer(): Promise<boolean> { /* ... */ }

  // Version tracking for conflict resolution
  setServerVersion(version: number): void { /* ... */ }
}
```

**Features:**
- Debounced state syncing (500ms batching)
- Version tracking for conflict resolution (HTTP 409 handling)
- Graceful degradation when server unavailable

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

**Component Integration** (illustrative pattern — the current production component playing this role is `PlayerPanelV2`/`PlayerCardDetailV2`, not a standalone `CardPortfolio`; the classic panel's `CardPortfolio` was removed with the rest of the classic UI):
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

> **Visual Diagram:** For a flowchart of turn processing, see [TURN_FLOW_DIAGRAM.mmd](./TURN_FLOW_DIAGRAM.mmd).

### Action Processing Pipeline

Every game event follows this standardized flow:

```
User Action → Service Method → Effect[] → EffectEngine → State Update → UI Update
```

### Action Types and Triggers

#### Manual Actions (Player-Initiated)

| Action | Component | Service | Effect Types |
|--------|-----------|---------|--------------|
| **Roll Dice** | PlayerPanelV2 (action buttons) | TurnService | MovementChoice, TurnControl |
| **Play Card** | PlayerPanelV2 / PlayerCardDetailV2 | CardService | ResourceChange, CardDraw, etc. |
| **End Turn** | PlayerPanelV2 (TurnCommitControl) | TurnService | TurnControl, Logging |
| **Choose Path** | ChoiceModal | MovementService | PlayerMovement |
| **Transfer Card** | CardDetailsModal | CardService | CardTransfer |
| **Make Offer** | NegotiationModal | NegotiationService (partner accept/decline routed through ChoiceService, v3.1.83) | Multi-player effects |
| **Try Again** | PlayerPanelV2 (TurnCommitControl) | TurnService | StateRevert, Logging |

> Component names above reflect the current V2-only UI. The classic panel (`ActionCenterPanel`, `TurnControls`, `CardPortfolio`/`CardsSection`, `CardModal`) was fully removed in v3.0.128–137 and swept for remaining dead code (`PlayerActionService`) in v3.1.9. `PlayerPanelV2` + `ScoreboardV2` + `TurnCommitControl` are the only player UI now — no classic/V2 toggle exists.

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
  | ChoiceOfEffectsEffect    // Player picks which of several effects applies
  | EffectGroupTargeted      // Multi-player targeting
  | ConditionalEffect       // Dice roll conditional logic
  | RecalculateScopeEffect   // Project scope recalculation
  | FeeDeductionEffect       // Loan fee deductions (percentage-based)
  | LogEffect               // Game logging
  | PlayCardEffect           // Programmatically triggers a card play
  | OwnerSeedMoneyEffect      // Owner's automatic starting-funding effect
  | ContractorUpdateEffect    // Contractor-mechanic state changes
  | DurationStoredEffect      // Registers a multi-turn active effect
  | PlayerAgreementRequiredEffect // Blocks on a specific player's yes/no (also used by NegotiationService's ChoiceService-backed accept/decline)
```

18 `effectType` string values exist in `src/types/EffectTypes.ts` as of v3.1.85 (up from 12); the list above is the complete current set. The Homeowner Violation mechanic (L050/L051, v3.1.84) is a deliberate exception to this pipeline — see "Homeowner Violation mechanic" under Core Services above; it's special-cased directly in `CardService.applyCardEffects` rather than expressed as Effect objects.

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

### REAL/TEMP State Model (Try Again Feature)

As of December 2025, the "Try Again" feature uses an explicit **REAL + TEMPORARY** state model:

```typescript
// Turn lifecycle:
// 1. Turn starts → createTempStateFromReal() creates working copy
// 2. All effects → Apply to TEMP state only
// 3. Try Again → applyToRealState(penalty), discardTempState(), endTurnWithMovement()
// 4. End Turn → commitTempToReal() finalizes all changes
```

**Try Again uses the "Pay-and-Wait" model (v2.36.3):**
- Player pays the time penalty (applied to REAL state) and their turn ends immediately
- `tryAgainOnSpace()` returns `shouldAdvanceTurn: true`, and the caller (`GameLayout.handleTryAgain`) calls `endTurnWithMovement()` to advance to the next player
- The player retries the space on their next turn with a fresh TEMP state
- `clearTurnActions()` and `discardTempState()` both call `updateActionCounts()` to keep the End Turn button state consistent after reset

**Key State Types (StateTypes.ts):**
```typescript
interface TurnStateModel {
  realStates: { [playerId: string]: PlayerTurnState | null };   // Committed state
  tempStates: { [playerId: string]: PlayerTurnState | null };   // Working state
  activeTurnPlayers: string[];
  tryAgainCounts: { [playerId: string]: number };
}
```

**Key Methods:**
- `createTempStateFromReal(options)` - Creates fresh TEMP from REAL at turn start
- `commitTempToReal(playerId)` - Finalizes TEMP → REAL on End Turn
- `discardTempState(playerId)` - Discards working state on Try Again
- `applyToRealState(playerId, changes)` - Applies penalties to committed state
- `hasActiveTempState(playerId)` - Checks if player has active turn state
- `getTryAgainCount(playerId)` - Returns number of retries this turn

**Benefits:**
1. No conditional effect processing - always process all effects on TEMP
2. Clear separation - REAL = committed, TEMP = working
3. Multiple Try Agains naturally supported
4. Time penalties accumulate correctly on REAL state

**TurnCostLedger — layered on top, not a replacement (v3.1.84 framing, mechanism predates it):** `TurnStateManager` also tracks a per-player, per-turn `TurnCostLedger` (`moneySpent`, `cardsConsumed`, `lifeEventsDrawn`), hooked at `ResourceService.spendMoney`/`recordCost` (money outflows) and `CardService.playCard`/`drawCards` (user-initiated card consumption). It rides alongside the REAL/TEMP model rather than replacing it: applied to REAL before a TEMP discard in `tryAgainOnSpace()`, cleared on `commitTempToReal()` and fresh-turn `createTempStateFromReal()`. A full "Snapshot Try Again" redesign was evaluated and explicitly declined in favor of this lighter-weight ledger — see `docs/core/BETA_PLAN_V3.md` Workstream 2.

> **Reference:** See [CHANGELOG.md](../../CHANGELOG.md) — search for *"REAL/TEMP State Model"* (Dec 26, 2025 entry) for the historical implementation rationale.

### Context API Integration

Components access services via React Context:

```typescript
const { stateService, cardService, turnService } = useGameContext();

// Direct service calls with full TypeScript support
const player = stateService.getPlayer(playerId);
const result = await cardService.playCard(playerId, cardId);
```

### The `useSyncedGameState` Hook (July 2026)

For components that need the **full** live game state (as opposed to a selector slice — see Selective Subscriptions below), `src/hooks/useSyncedGameState.ts` wraps `StateService` in React's `useSyncExternalStore`:

```typescript
export function useSyncedGameState(stateService: IStateService): GameState {
  // subscribe(): forwards stateService.subscribe(), invalidating a cached
  // snapshot whenever the store actually fires a change
  // getSnapshot(): returns the cached GameState, only re-fetching from
  // stateService.getGameState() after a real change — required because
  // getGameState() deep-copies on every call and is NOT referentially
  // stable between reads (useSyncExternalStore requires a stable reference
  // until something actually changes, or React can loop)
  return useSyncExternalStore(subscribe, getSnapshot);
}
```

This replaced an ad-hoc `useState` + `useEffect(() => stateService.subscribe(...))` pattern that ESLint's `react-hooks/set-state-in-effect` rule flagged across roughly 7 components (`GameLog`, `SpaceExplorerPanel`, `GameLayout`, `TVDisplay`, `ChoiceModal`, `NegotiationModal`, `PlayerSetup`) — each synchronously seeded local state before the subscription callback took over, which can "tear" (different components seeing different snapshots mid-render) under React's concurrent rendering. `useSyncExternalStore` is React's own recommended tool for this "read from a store I don't own" case. It's the standard pattern now for any new component reading the full live game state.

### Selective Subscriptions (Performance Optimization)

As of December 2025, StateService supports **selective subscriptions** to reduce unnecessary re-renders. Instead of notifying all subscribers on every state change, components can specify exactly which parts of state they care about:

```typescript
// Traditional subscription - triggers on EVERY state change
stateService.subscribe((gameState) => {
  // Called even when unrelated state changes
  setPlayers(gameState.players);
});

// Selective subscription - only triggers when selected value changes
stateService.subscribeWithSelector(
  // Selector: extract only the values you need
  (state) => ({
    currentPlayerId: state.currentPlayerId,
    awaitingChoiceType: state.awaitingChoice?.type || null
  }),
  // Callback: only called when extracted values change
  (selected, fullState) => {
    setCurrentPlayerId(selected.currentPlayerId);
  },
  // Optional equality function for complex comparisons
  (a, b) => a.currentPlayerId === b.currentPlayerId &&
            a.awaitingChoiceType === b.awaitingChoiceType
);
```

**Benefits:**
- Components only re-render when their relevant data changes
- Reduces cascade re-renders during turn transitions
- PlayerPanelV2's action buttons and TurnCommitControl: only respond to action-related state changes
- GameBoard: ignores player resources, only responds to position/movement changes

**When to Use:**
- Components that only need specific state slices
- High-frequency render components (buttons, status displays)
- Components that don't need to respond to unrelated state changes

### Service-Level Caching

GameRulesService uses internal caching for expensive calculations:

```typescript
// calculateProjectScope uses cache keyed by player's W card array
// Cache is invalidated only when player's cards actually change
const projectScope = gameRulesService.calculateProjectScope(playerId);
// First call: calculates and caches
// Subsequent calls with same cards: returns cached value instantly
```

This eliminates redundant calculations during turn transitions where the same value might be requested 50+ times by different components and services.

### Game Event Bus (December 2025; typed union since domain-event stage 2, July 2026)

For automatic actions that require UI feedback (dice-conditional L card draws, movement, etc.), StateService provides a typed event bus. This started as a single flat `AutoActionEvent` interface with ~15 optional fields shared across all 8 event types; [docs/archive/domain-events-20260717.md](../archive/domain-events-20260717.md) stage 2 promoted it to a discriminated union (`src/types/GameEvents.ts`) dispatched through a dedicated `GameEventBus` (`src/services/GameEventBus.ts`) — each event name now only carries the fields it actually uses:

```typescript
// src/types/GameEvents.ts — one variant of the GameEvent union
interface MovementEvent {
  type: 'movement';
  playerId: string;
  playerName: string;
  playerColor?: string;      // For movement overlay theming
  spaceName: string;
  fromSpace?: string;
  toSpace?: string;
  success: boolean;
  message: string;
}
// GameEvent = MovementEvent | LifeEventEvent | SeedMoneyEvent | ... (27 variants as of v3.1.85, up from 8 at stage 2 —
// stage 3 (v3.1.7) collapsed 9 duplicated dual-channel log+toast call sites into typed events; stage 4 (v3.1.8) moved
// emitter ownership so the class deciding what happened also decides what to announce; newest addition is
// NegotiationRequestedEvent (v3.1.83, powers the E075 "Backchannel Favor" trading card — see NegotiationService)

// Services emit events when automatic actions occur
stateService.emitGameEvent({
  type: 'life_event',
  playerId: player.id,
  playerName: player.name,
  diceValue: 1,
  requiredRoll: 1,
  cardType: 'L',
  cardName: 'Broken Leg',
  success: true,
  spaceName: 'PM-DECISION-CHECK',
  message: 'Rolled 1 and drew: Broken Leg'
});

// GameLayout subscribes to show modal notifications
useEffect(() => {
  const unsubscribe = stateService.subscribeToGameEvents((event) => {
    // Convert to TurnEffectResult and show DiceResultModal
    setDiceResult(convertToTurnEffectResult(event));
    setIsDiceResultModalOpen(true);
  });
  return () => unsubscribe();
}, [stateService]);
```

GameLayout's subscription above drives modal display, but it's only one of three current consumers of the same bus. `LogWriter` (`src/services/LogWriter.ts`) and `ToastWriter` (`src/services/ToastWriter.ts`) — both instantiated once in `ServiceProvider.tsx` — subscribe independently: `LogWriter` writes the permanent-log half of each event via `LoggingService.info()`, `ToastWriter` fires the toast half via `NotificationService.notify()`. Splitting the dual-channel "log this AND toast that" logic into two dedicated listeners (rather than one call site doing both) is what stage 3 of the domain-event refactor collapsed 9 duplicated call sites into.

---

## Data Architecture

### Teacher instance layer (v3.0.74–76, Phases 1–2)

Production data now flows through a per-classroom "bake" — full design + invariants in [TEACHER_LAYER_DESIGN.md](../core/TEACHER_LAYER_DESIGN.md):

```
repo stock (public/data) ──deploy──▶ writable stock (refreshed EVERY deploy)
                                          │
classroom config (instances/<id>/config.json:      │  bake (instanceResolver.js:
  slots/positions, used/off, teacher copies,  ─────┤   validate → overlay → atomic
  detours; atomic single-file writes)              │   dir swap, version-stamped)
                                          ▼
                          instances/<id>/resolved/{SOURCE_FILES,CLEAN_FILES}
                                          │
                              served at /data (legacy writable stock = fallback)
```

Server modules: `instanceStore.js` (config CRUD, write tokens), `instanceResolver.js` (bake), `instanceValidation.js` (protection tiers, detour resolution, validation report), `instanceCatalog.js` (full-deck catalog for the Classroom Setup screen), `migrateInstance.js` (one-time classroom-1 migration + `npm run migrate:check`). Game creation is gated on `configVersion == resolvedVersion`. The old data-deploy gap (stock preserved forever after first boot) is eliminated: stock follows the deploy, customizations live in the config, no merge exists.

### CSV Data Files

Game data is stored in CSV files at `public/data/CLEAN_FILES/` (regenerated by `server/processGameData.js` from `public/data/SOURCE_FILES/`):

| File | Purpose |
|------|---------|
| **GAME_CONFIG.csv** | Per-space configuration. 25 columns as of v3.1.85 (was 19 at v2.58.0) — added `pos_x`/`pos_y` (BoardCanvas coordinates), `funding_source`, `has_final_review_gate`, `approval_role`, `npc_speaker`, `display_label_override`, `review_loop_message`, among others, alongside the original Workstream 6 flags. |
| **MOVEMENT.csv** | Movement type + destinations per (space, visit_type). |
| **CARDS_EXPANDED.csv** | Card definitions (W/B/E/L/I types). |
| **SPACE_CONTENT.csv** | UI text per space (Title, Event, Action, Outcome). |
| **SPACE_EFFECTS.csv** | Effects per (space, visit_type, action). |
| **DICE_EFFECTS.csv** | Dice-roll effect mappings with structured metadata. |
| **DICE_OUTCOMES.csv** | Dice-roll destination mappings for dice-movement spaces. |
| **DICE_ROLL_INFO.csv** | Per (space, visit_type, die value 1-6) outcome descriptions read by `EffectFactory`. |
| **LOGIC_QUESTIONS.csv** | Yes/no decision-chain rows for `path=LOGIC` spaces. |
| **PATH_CHOICE_RULES.csv** | Cross-space exclusion rules driven by stored path choices (Workstream 6 #4). |
| **CARD_TYPES.csv** | Card-type display labels ("Work Package", "Bank Loan", etc.) via `DataService.getCardTypeLabel()` — added so real-life-voice card-type names live in data, not hardcoded literals. |
| **ACTION_TOOLTIPS.csv** | Button tooltip why/context copy (`action_type`, `action_value`, `button_label`, `tooltip_why`, `tooltip_context`). No `SOURCE_FILES` counterpart — this CSV is its own source of truth. |
| **GLOSSARY.csv** | In-game dictionary term definitions, synced from the volunteer glossary/dictionary tool (see the glossary auto-sync workflow). |

> **Removed:** `MODAL_CONFIG.csv` no longer exists in `CLEAN_FILES` and is not referenced anywhere in `src/` — its role was absorbed by the files above (`DICE_ROLL_INFO.csv`, `ACTION_TOOLTIPS.csv`) as those surfaces evolved. If you find a doc still citing it, that doc is stale.
>
> **Board rendering:** `BoardCanvas` (React Flow, coordinate-driven from `GAME_CONFIG.csv`'s `pos_x`/`pos_y`, with drag-to-save in admin mode) has been the sole board renderer since v3.0.0 (2026-05-23). The original snake/zig-zag `BoardV3` walker and its supporting `boardLayout.ts` utilities were retired the same release — net ~2,400 lines removed.

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
import cardsCSV from '../data/CARDS_EXPANDED.csv';
```

### Data Loading and Caching

```typescript
class DataService {
  private cache: Map<string, any> = new Map();

  async loadCards(): Promise<Card[]> {
    if (this.cache.has('cards')) {
      return this.cache.get('cards');
    }

    const response = await fetch('/data/CLEAN_FILES/CARDS_EXPANDED.csv');
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

**Service Unit Tests** (Vitest — use `vi`, not `jest`):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CardService', () => {
  let cardService: CardService;
  let mockDataService: ReturnType<typeof createMockDataService>;
  let mockStateService: ReturnType<typeof createMockStateService>;

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

**Component Tests** (illustrative — the real current suite is `tests/components/player/PlayerPanelV2.test.tsx`, `CardPortfolio` no longer exists):
```typescript
describe('PlayerPanelV2', () => {
  it('should display player cards', () => {
    const { getAllByTestId } = render(
      <PlayerPanelV2 gameServices={mockServices} playerId="player1" />
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

**As of v3.1.14, plain `npm test` runs the full suite directly** (~100s) — the hang that used to force batch workarounds was the 20-30 min ghost-bot ("smart-bot win-rate") gates running inline; they were split out into their own `npm run test:ghost` command, so the default suite no longer includes them. `./tests/scripts/run-tests-batch-fixed.sh` (23 batches) still exists and still passes if you want isolation between directories, but it's no longer the required path.

```bash
# Full suite (recommended, no batching needed)
npm test

# Ghost-bot regression gates (slow, run separately)
npm run test:ghost

# Run by directory, or a specific file, if you want isolation
npm test tests/services/
npm test tests/services/TurnService.test.tsx
```

---

## Code Quality Standards

> See [CODE_STYLE.md](./CODE_STYLE.md) for the authoritative project conventions. Summary:

### File size

- **No line-count budget.** The April 2026 audit explicitly dropped the prior "<200 lines per service / <300 max" rule. Split only on a concrete pain signal — see [BETA_PLAN_V3.md Workstream 4](../core/BETA_PLAN_V3.md). Current large-service sizes (July 2026, for orientation, not a target): CardService 2,358 lines (grew with the Homeowner Violation mechanic, v3.1.84), StateService 1,911, EffectEngineService 1,543, TurnService 1,121 (shrank from 2,076 after two rounds of extraction — SpaceArrivalProcessor/DiceRollProcessor/MovementExecutor/TurnTransitionHandler, then TurnEffectsOrchestrator/ManualActionProcessor in July 2026, both listed under Core Services above).

### TypeScript Requirements

- **Strict Mode:** Enabled. `npm run typecheck` must return 0 errors on every commit.
- **`no-explicit-any` is `warn`, permanently, by decision (v3.1.76):** not a backlog item awaiting promotion to `error`. Tier 4 (April 2026) narrowed 50 of the original 109 `any` usages; a later site-by-site re-audit (v3.1.76) found the remaining sites split three ways — platform casts no type can express (`(window as any).opera`, etc.), honest free-form bags (log/measurement records, `Promise` reject signatures mirroring TypeScript's own), and a couple of real gaps that are work, not lint work (`ActiveEffect.effectData: any`). 35 warnings / 0 errors as of v3.1.85. New `any` usages still need a justification — the permanent-`warn` decision covers the existing intentional sites, not a blanket pass.
- **Interface Contracts:** All services implement `I*Service` interfaces in `ServiceContracts.ts`.

### Code Review Checklist

- [ ] No `window.*` access (use dependency injection)
- [ ] All dependencies injected via props/constructor
- [ ] TypeScript strict mode passes (0 errors)
- [ ] Unit tests for business logic (Vitest, not Jest)
- [ ] Component tests for UI behavior
- [ ] No new `any` without justification
- [ ] Single responsibility principle
- [ ] CSV data accessed through DataService only
- [ ] New per-space behavior driven by Spaces.csv flags (Workstream 6 invariant)

### Service Development Guidelines

1. **Dependency Injection:** Constructor-based. Setter injection only for the two real cycles documented above.
2. **Interface Contracts:** Implement `ServiceContracts` interfaces.
3. **Immutable Patterns:** Return new objects, never mutate.
4. **Error Handling:** Try-catch with meaningful messages; route through `notificationService` for user-facing errors.

### Component Development Guidelines

1. **Single Responsibility:** UI rendering and event handling.
2. **Props-Based Data:** No global state access.
3. **Service Integration:** Use `useGameContext()` hook.
4. **Error Handling:** Graceful degradation with user feedback.

---

## Additional Topics

For related architecture topics, see:

- **[API_REFERENCE.md](./API_REFERENCE.md)** - Component and service APIs
- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - Comprehensive testing strategy
- **[CODE_STYLE.md](./CODE_STYLE.md)** - UI patterns and code conventions
- **[CHANGELOG.md](../../CHANGELOG.md)** - Technical change history

---

**Last Updated:** August 1, 2026
**Maintained By:** Claude (AI Lead Programmer)
