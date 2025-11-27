# Game Actions Guide

This guide explains the different types of actions in the game, what triggers them, and how they are processed by the unified service-oriented architecture.

## 1. The Core Concept: Actions, Effects, and Notifications

Every game event follows a standardized pattern:
1.  An **Action** is triggered (either by a player or the system).
2.  This Action is processed by a relevant **Service** (e.g., `TurnService`, `CardService`).
3.  The Service generates one or more **Effects**.
4.  The `EffectEngineService` processes these Effects, changing the game state (e.g., updating a player's money, moving them on the board).
5.  The **`NotificationService`** provides immediate user feedback across three channels:
    - **Button feedback** (short confirmation messages)
    - **Player notification areas** (medium-length status updates)
    - **GameLog** (detailed action history)

This creates a responsive, user-friendly experience where every action provides clear feedback.

---

## 2. Action Triggers: What Kicks Things Off?

There are two primary ways actions are initiated:

### Manual Triggers (Player-Driven)

These are actions you take by clicking a button.

| Button / Action | Component / Location | What it Does | Notification Feedback |
| :--- | :--- | :--- | :--- |
| **Start Game** | `PlayerSetup` | Transitions the game from the SETUP phase to the PLAY phase. | Game startup confirmation |
| **Roll Dice** | `TurnControlsWithActions` | Initiates a dice roll, which automatically triggers dice roll effects. | `🎲 Rolled ${value}` with effect summary |
| **Manual Action** | `TurnControlsWithActions` | On certain spaces, special buttons appear that allow players to trigger unique effects (e.g., "Draw 3 E-Cards"). | Action-specific feedback with outcomes |
| **End Turn** | `TurnControlsWithActions` | Ends the current player's turn and advances to the next player. | Turn completion confirmation |
| **Choose Path** | `TurnControlsWithActions` | On spaces like `PM-DECISION-CHECK`, players must choose their next path from a list of buttons. | `→ ${destination}` immediate feedback |
| **Make Choice** | `ChoiceModal` | A generic modal that appears when a card or space effect requires a player to make a decision. | `✅ Choice Made: Selected ${option}` |
| **Transfer Card** | `CardDetailsModal` | Allows a player to give a transferable card (L or E type) to another player. | Success: `Card transferred to ${player}` / Error: Transfer failure details |
| **Make/Accept/Decline Offer** | `NegotiationModal` | The core actions for the player-to-player negotiation system. | Offer status updates and completion confirmations |
| **Try Again** | `TurnControlsWithActions` | On certain spaces, allows a player to revert their turn to the state before they rolled the dice (usually with a time penalty). | Reversion confirmation with time penalty |
| **Get Funding** | `TurnControlsWithActions` | On `OWNER-FUND-INITIATION` space, triggers an automatic calculation that provides a direct cash deposit (seed money) based on project scope. | Funding details with the exact amount received |

### Automatic Triggers (System-Driven)

These actions happen automatically as a consequence of other events. You don't click a button for them, but you see their results.

| Event | Trigger | Example |
| :--- | :--- | :--- |
| **On-Arrival Effects** | A player lands on a new space. | Landing on `OWNER-FUND-INITIATION` automatically provides the player with a direct cash deposit (seed money) based on a percentage of their project scope. |
| **On-Leaving Effects** | A player leaves a space. | Leaving `OWNER-SCOPE-INITIATION` automatically adds a time penalty for "scope review". |
| **Dice Roll Effects** | A player rolls the dice. | Rolling a 4 on a certain space might automatically grant you money and a card draw. |
| **Card Effects** | A player plays a card. | Playing an Investment (I) card automatically adds money to your balance. |
| **Duration Effects** | A card's timer runs out. | A card with a 3-turn duration will automatically be discarded at the end of the third turn. |

---

## 3. Action Independence and Flexible Ordering

### The Freedom to Choose Action Order

Unlike many digital games that enforce rigid sequences, this game follows proper board game mechanics where **action order is flexible and strategic**. When multiple actions are available, players can choose the order that best suits their strategy.

### Key Independence Principles

**🎯 Movement Choices and Other Actions Are Independent**
- When at spaces like `PM-DECISION-CHECK` with multiple path options, players can:
  - **Roll dice first** → See results → Choose movement based on outcomes
  - **Perform manual space effects** → Then decide where to move
  - **Choose movement immediately** → Then handle other actions
  - **Any combination** that makes strategic sense

**🎲 Dice Rolls Don't Block Other Options**
- Rolling dice doesn't prevent choosing movement paths
- Players can see dice results before committing to movement
- Manual space effects remain available after dice rolls

**⚖️ Strategic Flexibility Examples**
- **PM-DECISION-CHECK scenario**: Player can roll for L card chance, see if they get a useful Life Event card, then choose their path based on the new card's effects
- **Resource management**: Check current resources → Perform manual effects → Decide movement based on updated situation
- **Risk assessment**: Try manual actions first → If they fail, choose conservative movement; if they succeed, choose aggressive path

### What Actions Must Be Sequential

While most actions are independent, some logical constraints remain:

- **Can't end turn** with pending movement choices (must resolve path selection)
- **Can't perform concurrent manual actions** (prevents race conditions)
- **Movement choice must be resolved** before advancing to the next player

This design respects player agency and strategic thinking, just like physical board games where you can examine your options before committing to a sequence.

---

## 4. Core Action Categories: How They Work

### Movement

*   **How it's Triggered:** Movement is primarily triggered in two ways:
    1.  **Automatic Movement:** After a dice roll, if there is only one possible path forward, the `MovementService` automatically moves your player piece.
    2.  **Choice-Based Movement:** If a space has multiple paths forward (like `PM-DECISION-CHECK`), a choice is presented. When you select a path, the `MovementService` moves your piece.
*   **Key Service:** `MovementService`

### Cards

*   **Drawing:** Cards are typically drawn as an *effect* of another action (dice roll, space effect, etc.). The `CardService` handles taking a card from the stateful deck and adding it to a player's hand.
*   **Playing:** Playing a card is a manual action that triggers the `effects_on_play` defined in the card's data. (Note: The UI for playing cards from the hand is a P2 feature).
*   **Transferring:** A manual action in the `CardDetailsModal` that uses the `CardService` to move a card from one player's hand to another.
*   **Key Service:** `CardService`

### Resources (Money & Time)

*   **How it Works:** Money and time are almost never changed directly. Instead, they are changed by effects processed through the `EffectEngineService`. An action (like a dice roll) creates an effect (e.g., `RESOURCE_CHANGE: money +500`), and the `ResourceService` applies that change to the player's state.
*   **Key Service:** `ResourceService`

### Player Interaction

*   **Choices:** When an action requires player input, the `ChoiceService` is used to create a `Choice` object in the game state. The UI (`ChoiceModal` or `TurnControlsWithActions`) displays the options. When a choice is made, the `ChoiceService` resolves it, `NotificationService` provides immediate feedback, and the game continues.
*   **Negotiations:** This is a multi-step process managed by the `NegotiationService` with full notification integration:
    1.  A player initiates a negotiation with a partner.
    2.  They create an offer (money and/or cards) → **Notification**: `Offer Made: Offered $X and Y card(s)`
    3.  The `NegotiationService` presents the offer to the partner.
    4.  The partner can accept → **Notification**: `Offer Accepted: Negotiation completed`
    5.  Or decline → **Notification**: `❌ Offer declined`
    6.  If accepted, the `NegotiationService` handles the transfer of assets.
*   **Key Services:** `ChoiceService`, `NegotiationService`, `NotificationService`

### Notification System Integration

*   **Three-Channel Feedback:** Every user action triggers notifications across three UI channels:
    - **Button Feedback**: Short confirmations (e.g., `✓`, `→ Market Research`) that appear on/near the clicked button
    - **Player Notification Areas**: Medium-length status updates in blue notification zones per player
    - **GameLog**: Comprehensive action history with full context and player attribution
*   **Unified API:** All actions use `NotificationService.notify(content, options)` where:
    - `content` contains `short`, `medium`, and `detailed` message variants
    - `options` specify `playerId`, `playerName`, and unique `actionType` for tracking
*   **Key Service:** `NotificationService`

---

## 4. Example Flow: A Single Dice Roll with Notification System

This shows how one click can trigger a chain of events with modern feedback systems.

```mermaid
graph TD
    A[Player clicks "Roll Dice"] --> B{TurnService.rollDice};
    B --> C{Dice roll is a 4};
    C --> D{EffectEngineService receives effects for rolling a 4};
    C --> K{NotificationService.notify<br>Button: "4"<br>Area: "🎲 Rolled 4 → +$500, +1 W card"<br>Log: "Player rolled 4 and gained..."};
    D --> E[Effect 1: RESOURCE_CHANGE<br>money: +500];
    D --> F[Effect 2: CARD_DRAW<br>type: W, count: 1];
    E --> G{ResourceService updates player money};
    F --> H{CardService draws a W card and adds to player hand};
    G & H --> I[Game State is Updated];
    K --> L[Button shows "✅ 4"];
    K --> M[Player notification area shows medium message];
    K --> N[GameLog shows detailed entry];
    I --> J[UI re-renders to show new money and card];
    L & M & N & J --> O[Complete user feedback achieved];
```

## 5. Architectural Patterns and Best Practices

### Service-Oriented Architecture
- **Dependency Injection**: All services are injected via `useGameContext()` hook
- **Single Responsibility**: Each service handles one domain (cards, movement, notifications, etc.)
- **Immutable State**: State changes only through service methods, never direct mutations
- **Event-Driven**: Services communicate through the `StateService` subscription system

### Notification Integration Pattern
Every user action follows this pattern:
```typescript
// 1. Perform the core action
const result = await someService.performAction(params);

// 2. Provide immediate user feedback
notificationService.notify(
  NotificationUtils.createSuccessNotification(
    'Action Name',
    'Details about what happened',
    playerName
  ),
  {
    playerId: currentPlayerId,
    playerName: currentPlayerName,
    actionType: 'unique_action_identifier'
  }
);
```

### Error Handling
- **Graceful Degradation**: Failed actions provide error notifications instead of crashes
- **User-Friendly Messages**: Technical errors are translated to user-understandable feedback
- **Non-Blocking UI**: Notifications never interrupt the game flow with modal dialogs

## 6. Data-Driven Game Mechanics

The game behavior is largely driven by CSV data files:
- **SPACE_EFFECTS.csv**: Defines what happens when players land on or leave spaces
- **CARDS.csv**: Contains all card definitions, effects, and metadata
- **MOVEMENTS.csv**: Specifies valid movement paths between spaces
- **DICE_OUTCOMES.csv**: Maps dice roll results to movement and effect outcomes

This data-driven approach allows for easy game balancing and content updates without code changes.
