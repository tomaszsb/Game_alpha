# Turn Processing Flow - Decision Trees & Diagrams

This document describes the complete logic flow when a player enters a new space and the player panel is rendered.

> **Related Diagrams (December 2025):**
> - **[TURN_FLOW_DIAGRAM.mmd](./TURN_FLOW_DIAGRAM.mmd)** - Detailed visual flowchart of current implementation including effect processing pipeline
> - **[TURN_FLOW_DIAGRAM_ASPIRATIONAL.mmd](./TURN_FLOW_DIAGRAM_ASPIRATIONAL.mmd)** - Proposed Real + Temporary State Model architecture
> - **[current_process.drawio](./current_process.drawio)** - Draw.io version with collapsible sections
>
> See also: [TECHNICAL_DEBT.md](./TECHNICAL_DEBT.md) for proposed refactors to the turn flow system.

## Table of Contents
1. [High-Level Flow](#1-high-level-flow)
2. [startTurn() Sequence](#2-startturn-sequence)
3. [processSpaceEffectsAfterMovement() Details](#3-processspaceeffectsaftermovement-details)
4. [handleMovementChoices() Details](#4-handlemovementchoices-details)
5. [Player Panel Rendering](#5-player-panel-rendering)
6. [NextStepButton Decision Tree](#6-nextstepbutton-decision-tree)
7. [Movement Choice Display](#7-movement-choice-display)
8. [Section Manual Action Buttons](#8-section-manual-action-buttons)
9. [Dice Roll Button Decision Tree](#9-dice-roll-button-decision-tree)
10. [Key State Variables](#10-key-state-variables)
11. [Effect Types Summary](#11-effect-types-summary)

---

## 1. High-Level Flow

```mermaid
flowchart TD
    A([Player Movement Completes]) --> B[TurnService.startTurn]
    B --> C[processSpaceEffectsAfterMovement]
    C --> D[handleMovementChoices]
    D --> E[Player Panel Renders]
    E --> F{Player Takes Action}
    F -->|Roll Dice| G[processTurnEffectsWithTracking]
    F -->|Manual Effect| H[Section Handler]
    F -->|End Turn| I[endTurn / nextPlayer]
    G --> E
    H --> E
    I --> J([Next Player's Turn])
```

---

## 2. startTurn() Sequence

```mermaid
flowchart TD
    subgraph TURN_START["TurnService.startTurn(playerId)"]
        T1([Movement Complete]) --> T2["1. clearAwaitingChoice()"]
        T2 --> T3["2. isProcessingArrival = true<br/>🔒 UI LOCKED"]
        T3 --> T4["3. startNewExplorationSession()<br/>(logging)"]
        T4 --> T5{"4. isInitialized()?"}
        T5 -->|NO| T5A["markAsInitialized()"]
        T5 -->|YES| T6
        T5A --> T6

        T6["5. processSpaceEffectsAfterMovement()<br/>(playerId, space, visitType)"]
        T6 --> T7["6. savePreSpaceEffectSnapshot()<br/>(if not exists)"]
        T7 --> T8["7. isProcessingArrival = false<br/>🔓 UI UNLOCKED"]
        T8 --> T9["8. handleMovementChoices(playerId)"]
        T9 --> T10([Turn Ready - Panel Renders])
    end

    style T3 fill:#FF6B6B,color:#fff
    style T8 fill:#90EE90
```

### Key Points:
- `processSpaceEffectsAfterMovement` and `handleMovementChoices` run **sequentially** (not parallel)
- UI is locked (`isProcessingArrival = true`) during effect processing
- `handleMovementChoices` only takes `playerId` - it gets `space` and `visitType` from player state

---

## 3. processSpaceEffectsAfterMovement() Details

```mermaid
flowchart TD
    subgraph MAIN["processSpaceEffectsAfterMovement(playerId, spaceName, visitType)"]
        START([Start]) --> GET_PLAYER["1. getPlayer(playerId)"]
        GET_PLAYER --> PLAYER_CHECK{Player exists?}
        PLAYER_CHECK -->|NO| ERROR1[/"Throw Error"/]
        PLAYER_CHECK -->|YES| SNAPSHOT_CHECK

        subgraph SNAPSHOT["2. Snapshot Check (Try Again Logic)"]
            SNAPSHOT_CHECK{"hasPreSpaceEffectSnapshot?"}
            SNAPSHOT_CHECK -->|YES| CALC_MANUAL_ONLY["Calculate manual effects only<br/>updateActionCounts()"]
            CALC_MANUAL_ONLY --> EARLY_RETURN([Return Early])
            SNAPSHOT_CHECK -->|NO| GET_EFFECTS
        end

        subgraph LOAD_DATA["3. Load Space Effects Data"]
            GET_EFFECTS["getSpaceEffects(spaceName, visitType)<br/>from SPACE_EFFECTS.csv"]
            GET_EFFECTS --> FILTER_CONDITIONS["filterSpaceEffectsByCondition()<br/>(scope_le_4M, scope_gt_4M, etc.)"]
            FILTER_CONDITIONS --> GET_SPACE_DATA["getSpaceByName(spaceName)"]
        end

        subgraph DICE_COND["4. Unified Dice Condition Handling"]
            %% As of December 26, 2025: All dice conditions use the unified condition column
            %% See TECHNICAL_DEBT.md for resolution details
            GET_SPACE_DATA --> CHECK_DICE_NEEDED{"ConditionEvaluator.anyEffectNeedsDiceRoll()?"}
            CHECK_DICE_NEEDED -->|NO| FILTER_AUTO
            CHECK_DICE_NEEDED -->|YES| ROLL_ONCE["Roll dice once (1-6)"]
            ROLL_ONCE --> FILTER_WITH_ROLL["filterSpaceEffectsByCondition(effects, player, diceRoll)<br/>Passes dice roll to evaluateCondition()"]
            FILTER_WITH_ROLL --> DICE_CARDS["Dice-conditional effects that passed filter<br/>are processed by EffectEngine"]
            DICE_CARDS --> FILTER_AUTO
        end

        subgraph FILTER_PROCESS["5. Filter & Process Auto Effects"]
            FILTER_AUTO["Filter out:<br/>- trigger_type = 'manual'<br/>- effect_type = 'time'"]
            FILTER_AUTO --> HAS_AUTO{Any auto<br/>effects left?}
            HAS_AUTO -->|NO| NO_EFFECTS(["No auto effects - Return"])
            HAS_AUTO -->|YES| CREATE_EFFECTS
        end

        subgraph EFFECT_ENGINE["7. Generate & Execute Effects"]
            CREATE_EFFECTS["EffectFactory.createEffectsFromSpaceEntry()"]
            CREATE_EFFECTS --> HAS_GENERATED{Effects<br/>generated?}
            HAS_GENERATED -->|NO| NO_PROCESSED(["No processed effects - Return"])
            HAS_GENERATED -->|YES| CREATE_CONTEXT
            CREATE_CONTEXT["Create EffectContext<br/>{source: 'space_arrival',<br/>triggerEvent: 'SPACE_ENTRY'}"]
            CREATE_CONTEXT --> ENGINE_CHECK{EffectEngineService<br/>available?}
            ENGINE_CHECK -->|NO| WARN_NO_ENGINE["Log warning"]
            ENGINE_CHECK -->|YES| PROCESS_EFFECTS
            PROCESS_EFFECTS["effectEngineService.processEffects()"]
            PROCESS_EFFECTS --> RESULT_CHECK{Success?}
            RESULT_CHECK -->|YES| LOG_SUCCESS["Log success"]
            RESULT_CHECK -->|NO| LOG_WARN["Log failures"]
        end

        LOG_SUCCESS --> END_MAIN([End])
        LOG_WARN --> END_MAIN
        WARN_NO_ENGINE --> END_MAIN
    end

    style START fill:#90EE90
    style END_MAIN fill:#90EE90
    style EARLY_RETURN fill:#FFD700
    style NO_EFFECTS fill:#FFD700
    style NO_PROCESSED fill:#FFD700
    style ERROR1 fill:#FF6B6B
```

### Subprocess Summary:
| Step | Subprocess | Purpose |
|------|------------|---------|
| 1 | getPlayer | Validate player exists |
| 2 | Snapshot Check | Skip auto effects if Try Again (preserve state) |
| 3 | Load Data | Get effects from CSV, filter by conditions |
| 4 | Unified Dice | Check if any effects need dice roll, roll once, pass to filter |
| 5 | Filter | Remove manual/time effects (handled elsewhere) |
| 6 | Execute | Run auto effects through EffectEngine |

> **Note:** As of December 26, 2025, dice condition handling was consolidated from 3 separate paths into 1 unified approach. All dice conditions now use the `condition` column in CSV (e.g., `dice_roll_3`) and are evaluated through `filterSpaceEffectsByCondition()` with the optional `diceRoll` parameter.

---

## 4. handleMovementChoices() Details

```mermaid
flowchart TD
    subgraph HMC["handleMovementChoices(playerId)"]
        H1([Start]) --> H2["getPlayer(playerId)"]
        H2 --> H3{Player exists?}
        H3 -->|NO| H4([Return])
        H3 -->|YES| H5["getMovement(player.currentSpace,<br/>player.visitType)"]

        H5 --> H6{"movement_type =<br/>'dice_outcome' or 'dice'?"}
        H6 -->|YES| H7(["SKIP - Return<br/>(handled after dice roll)"])
        H6 -->|NO| H8["getValidMoves(playerId)"]

        H8 --> H9{validMoves is array?}
        H9 -->|NO| H10([Return])
        H9 -->|YES| H11{validMoves.length > 1?}

        H11 -->|NO| H12(["Single destination<br/>No choice needed"])
        H11 -->|YES| H13["Create MOVEMENT choice<br/>setAwaitingChoice()"]
        H13 --> H14([Choice UI Shows])
    end

    style H1 fill:#90EE90
    style H7 fill:#FFD700
    style H14 fill:#87CEEB
```

### Three Paths That Create Movement Choices:

```mermaid
flowchart LR
    subgraph PATH1["Path 1: Turn Start"]
        P1A["handleMovementChoices()"]
        P1A --> P1B["For: choice/auto spaces"]
        P1B --> P1C["Guard: Skip dice/dice_outcome"]
    end

    subgraph PATH2["Path 2: After Dice Roll"]
        P2A["processTurnEffectsWithTracking()"]
        P2A --> P2B["For: dice_outcome/dice spaces"]
        P2B --> P2C["Single destination from roll"]
    end

    subgraph PATH3["Path 3: After Manual Effect"]
        P3A["restoreMovementChoiceIfNeeded()"]
        P3A --> P3B["For: choice/auto spaces"]
        P3B --> P3C["Guard: Skip dice/dice_outcome"]
    end

    PATH1 -.->|mutually exclusive| PATH2
    PATH2 -.->|mutually exclusive| PATH3
```

---

## 5. Player Panel Rendering

```mermaid
flowchart TD
    subgraph PANEL["PlayerPanel Component"]
        PP1["Header (avatar, name, location)"]
        PP1 --> PP2{"showMovementTransition?"}
        PP2 -->|YES| PP3["Movement Overlay"]
        PP2 -->|NO| PP4
        PP3 --> PP4{"isMyTurn?"}
        PP4 -->|NO| PP5["Wait Banner"]
        PP4 -->|YES| PP6
        PP5 --> PP6

        PP6["WinConditionBanner"]
        PP6 --> PP7{"currentCard exists?"}
        PP7 -->|YES| PP8["CurrentCardSection"]
        PP7 -->|NO| PP9
        PP8 --> PP9

        PP9["StorySection"]
        PP9 --> PP10["ProjectScopeSection"]
        PP10 --> PP11["FinancesSection"]
        PP11 --> PP12["TimeSection"]
        PP12 --> PP13["CardsSection"]

        PP13 --> PP14{"awaitingChoice?.type<br/>=== 'MOVEMENT'?"}
        PP14 -->|YES| PP15["Movement Choice Buttons"]
        PP14 -->|NO| PP16
        PP15 --> PP16

        PP16["NextStepButton"]
        PP16 --> PP17{"isMyTurn?"}
        PP17 -->|YES| PP18["TryAgainButton"]
        PP17 -->|NO| PP19([End])
        PP18 --> PP19
    end
```

---

## 6. NextStepButton Decision Tree

```mermaid
flowchart TD
    subgraph NSB["NextStepButton.getNextStepState()"]
        N1([Start]) --> N2{"currentPlayerId<br/>=== playerId?"}
        N2 -->|NO| N3["visible: false"]
        N2 -->|YES| N4{"awaitingChoice !== null?"}

        N4 -->|NO| N8
        N4 -->|YES| N5{"awaitingChoice.type<br/>=== 'MOVEMENT'?"}

        N5 -->|YES| N6{"moveIntent set?"}
        N5 -->|NO| N7["disabled: true<br/>tooltip: 'Complete [choice] first'"]

        N6 -->|YES| N8
        N6 -->|NO| N7A["disabled: true<br/>tooltip: 'Select destination first'"]

        N8{"requiredActions <=<br/>completedActionCount?"}
        N8 -->|NO| N9["disabled: true<br/>tooltip: 'Complete N more actions'"]
        N8 -->|YES| N10["disabled: false<br/>label: 'End Turn'"]
    end

    style N3 fill:#cccccc
    style N7 fill:#FF6B6B,color:#fff
    style N7A fill:#FF6B6B,color:#fff
    style N9 fill:#FFD700
    style N10 fill:#90EE90
```

### Text Version:
```
1. Is it my turn? (currentPlayerId === playerId)
   NO  → visible: false (hide button)
   YES → Continue

2. Is there a blocking choice awaiting?
   YES, type === 'MOVEMENT' AND moveIntent set?
        → Continue to check 3
   YES, type === 'MOVEMENT' AND NO moveIntent?
        → disabled: true, tooltip: "Select destination first"
   YES, other type (CARD, DICE...)?
        → disabled: true, tooltip: "Complete [choice type] first"
   NO  → Continue

3. Are all required actions complete?
   requiredActions <= completedActionCount?
   NO  → disabled: true, tooltip: "Complete N more actions"
   YES → disabled: false, label: "End Turn"
```

---

## 7. Movement Choice Display

```mermaid
flowchart TD
    MC1([Start]) --> MC2{"awaitingChoice !== null?"}
    MC2 -->|NO| MC3["Don't show choice buttons"]
    MC2 -->|YES| MC4{"awaitingChoice.type<br/>=== 'MOVEMENT'?"}
    MC4 -->|NO| MC5["Don't show choice buttons"]
    MC4 -->|YES| MC6{"isCurrentPlayersTurn?"}
    MC6 -->|NO| MC7["Show DISABLED buttons"]
    MC6 -->|YES| MC8["Show ENABLED buttons"]

    style MC3 fill:#cccccc
    style MC5 fill:#cccccc
    style MC7 fill:#FFD700
    style MC8 fill:#90EE90
```

---

## 8. Section Manual Action Buttons

```mermaid
flowchart TD
    subgraph SECTION["For Each Manual Effect in Section"]
        S1([Start]) --> S2{"effect.trigger_type<br/>=== 'manual'?"}
        S2 -->|NO| S3["Skip - auto effects<br/>already processed"]
        S2 -->|YES| S4{"evaluateCondition<br/>(effect.condition)?"}

        S4 -->|NO| S5["Don't show button<br/>(condition not met)"]
        S4 -->|YES| S6{"completedActions<br/>.manualActions[type]<br/>exists?"}

        S6 -->|YES| S7["Show completed status"]
        S6 -->|NO| S8{"isMyTurn?"}

        S8 -->|NO| S9["Show DISABLED button"]
        S8 -->|YES| S10["Show ENABLED button"]
    end

    style S3 fill:#cccccc
    style S5 fill:#cccccc
    style S7 fill:#87CEEB
    style S9 fill:#FFD700
    style S10 fill:#90EE90
```

### Condition Examples:
| Condition | Meaning | Used For |
|-----------|---------|----------|
| `scope_le_4m` | Project scope <= $4M | Movement paths, effect filtering |
| `scope_gt_4m` | Project scope > $4M | Movement paths, effect filtering |
| `dice_roll_1` through `dice_roll_6` | Dice rolled specific number | L-card draws, conditional effects |
| `high` | Dice rolled 4, 5, or 6 | Movement, conditional effects |
| `low` | Dice rolled 1, 2, or 3 | Movement, conditional effects |
| `always` | Always applies | Default effects |

> **Note:** Dice conditions (`dice_roll_X`, `high`, `low`) require a dice roll to be passed to `filterSpaceEffectsByCondition()`. The `ConditionEvaluator.anyEffectNeedsDiceRoll()` helper detects when a dice roll is needed.

---

## 9. Dice Roll Button Decision Tree

```mermaid
flowchart TD
    DR1([Start]) --> DR2{"hasPlayerRolledDice?"}
    DR2 -->|YES| DR3["HIDE - Already rolled"]
    DR2 -->|NO| DR4{"hasPlayerMovedThisTurn?"}

    DR4 -->|YES| DR5["HIDE - Already moved"]
    DR4 -->|NO| DR6{"requiresManualDiceRoll?"}

    DR6 -->|NO| DR7["HIDE - Auto dice"]
    DR6 -->|YES| DR8{"isProcessingArrival?"}

    DR8 -->|YES| DR9["HIDE - UI locked"]
    DR8 -->|NO| DR10{"awaitingChoice blocking?<br/>(not MOVEMENT type)"}

    DR10 -->|YES| DR11["HIDE - Choice pending"]
    DR10 -->|NO| DR12["SHOW 'Roll Dice' button"]

    style DR3 fill:#cccccc
    style DR5 fill:#cccccc
    style DR7 fill:#cccccc
    style DR9 fill:#FF6B6B,color:#fff
    style DR11 fill:#FFD700
    style DR12 fill:#90EE90
```

---

## 10. Key State Variables

| Variable | Type | Set When | Cleared When | Controls |
|----------|------|----------|--------------|----------|
| `isProcessingArrival` | boolean | Space entry starts | Effects processed | Locks entire UI |
| `hasPlayerMovedThisTurn` | boolean | After any movement | Turn ends | Hides Roll Dice |
| `hasPlayerRolledDice` | boolean | After Roll Dice click | Turn ends | Hides Roll Dice |
| `awaitingChoice` | Choice \| null | Choice needed | Choice resolved | Blocks End Turn |
| `awaitingChoice.type` | string | With choice | With choice | Determines UI |
| `moveIntent` | string \| null | Destination selected | Movement complete | Enables End Turn |
| `requiredActions` | number | Space effects counted | Turn ends | End Turn enable |
| `completedActionCount` | number | Action completed | Turn ends | End Turn enable |
| `completedActions` | object | Actions tracked | Turn ends | Button states |

### State Flow:
```mermaid
stateDiagram-v2
    [*] --> Arriving: Movement Complete
    Arriving --> Processing: isProcessingArrival=true
    Processing --> Ready: isProcessingArrival=false

    Ready --> AwaitingChoice: Multiple destinations
    Ready --> AwaitingDice: Requires dice roll
    Ready --> AwaitingManual: Has manual effects

    AwaitingChoice --> DestinationSelected: Player selects
    AwaitingDice --> DiceRolled: Player rolls
    AwaitingManual --> ActionComplete: Player acts

    DestinationSelected --> CanEndTurn: All complete
    DiceRolled --> CanEndTurn: All complete
    ActionComplete --> CanEndTurn: All complete

    CanEndTurn --> [*]: End Turn clicked
```

---

## 11. Effect Types Summary

```mermaid
flowchart TD
    subgraph CSV["SPACE_EFFECTS.csv Structure"]
        direction LR
        C1["space_name"]
        C2["visit_type"]
        C3["trigger_type"]
        C4["effect_type"]
        C5["effect_action"]
        C6["effect_value"]
        C7["condition"]
    end

    subgraph TRIGGER["trigger_type Values"]
        T1["auto"] --> T1A["Execute immediately<br/>in processSpaceEffectsAfterMovement()"]
        T2["manual"] --> T2A["Show as button<br/>in UI sections"]
    end

    subgraph EFFECT["effect_type Values"]
        E1["money"] --> E1A["Add/subtract money"]
        E2["time"] --> E2A["Add/subtract time<br/>ON LEAVING SPACE"]
        E3["cards"] --> E3A["Draw/discard cards"]
        E4["dice"] --> E4A["Dice-based effects<br/>(movement, etc.)"]
        E5["turn"] --> E5A["End turn effects"]
        E6["fee"] --> E6A["Fee deductions<br/>(percent of scope)"]
    end

    style T1 fill:#90EE90
    style T2 fill:#FFD700
    style E2A fill:#FF6B6B,color:#fff
```

### Important Note on Time Effects:
**Time effects (`effect_type: 'time'`) are NOT processed on space entry!**

They are processed in `processLeavingSpaceEffects()` when the player leaves the space. This represents the time spent working at that location.

---

## Complete Flow Diagram

```mermaid
flowchart TD
    subgraph MOVEMENT["Player Movement"]
        M1([Player selects destination]) --> M2["MovementService.movePlayer()"]
        M2 --> M3["Update player.currentSpace"]
        M3 --> M4["Update player.visitType"]
    end

    M4 --> START

    subgraph TURN_START["TurnService.startTurn()"]
        START([Start Turn]) --> CLR["clearAwaitingChoice()"]
        CLR --> LOCK["isProcessingArrival = true"]
        LOCK --> LOG["startNewExplorationSession()"]
        LOG --> INIT{"isInitialized?"}
        INIT -->|NO| MARK["markAsInitialized()"]
        INIT -->|YES| PROC
        MARK --> PROC

        PROC["processSpaceEffectsAfterMovement()"]

        subgraph PSEM["Process Space Effects"]
            PS1["Get effects from CSV"]
            PS1 --> PS2["Filter by conditions"]
            PS2 --> PS3{"Auto dice?"}
            PS3 -->|YES| PS4["Roll + apply"]
            PS3 -->|NO| PS5
            PS4 --> PS5{"L card dice?"}
            PS5 -->|YES| PS6["Roll + maybe draw"]
            PS5 -->|NO| PS7
            PS6 --> PS7["Filter auto only"]
            PS7 --> PS8["EffectEngine.process()"]
        end

        PROC --> SNAP["savePreSpaceEffectSnapshot()"]
        SNAP --> UNLOCK["isProcessingArrival = false"]
        UNLOCK --> HMC["handleMovementChoices()"]

        subgraph HMCB["Handle Movement Choices"]
            HM1{"dice/dice_outcome?"}
            HM1 -->|YES| HM2["Skip"]
            HM1 -->|NO| HM3["getValidMoves()"]
            HM3 --> HM4{"> 1 move?"}
            HM4 -->|YES| HM5["Create choice"]
            HM4 -->|NO| HM6["No choice"]
        end

        HMC --> READY([Turn Ready])
    end

    READY --> RENDER

    subgraph RENDER["Player Panel Render"]
        R1["Sections render"]
        R1 --> R2{"awaitingChoice<br/>MOVEMENT?"}
        R2 -->|YES| R3["Show destination buttons"]
        R2 -->|NO| R4
        R3 --> R4["NextStepButton evaluates"]
        R4 --> R5{"All actions<br/>complete?"}
        R5 -->|NO| R6["Button disabled"]
        R5 -->|YES| R7["Button enabled"]
    end

    R7 --> ACTION

    subgraph ACTION["Player Actions"]
        A1{"What action?"}
        A1 -->|Roll Dice| A2["processTurnEffectsWithTracking()"]
        A1 -->|Manual Effect| A3["Section handler"]
        A1 -->|Select Dest| A4["setMoveIntent()"]
        A1 -->|End Turn| A5["endTurn()"]

        A2 --> RENDER
        A3 --> RENDER
        A4 --> RENDER
        A5 --> NEXT([Next Player])
    end

    style LOCK fill:#FF6B6B,color:#fff
    style UNLOCK fill:#90EE90
    style R7 fill:#90EE90
    style R6 fill:#FFD700
```

---

## File References

| Component/Service | File Path | Key Functions |
|-------------------|-----------|---------------|
| TurnService | `src/services/TurnService.ts` | `startTurn()`, `processSpaceEffectsAfterMovement()`, `handleMovementChoices()`, `filterSpaceEffectsByCondition()` |
| PlayerPanel | `src/components/player/PlayerPanel.tsx` | Main container component |
| NextStepButton | `src/components/player/NextStepButton.tsx` | `getNextStepState()` |
| ConditionEvaluator | `src/utils/ConditionEvaluator.ts` | `evaluate()`, `isDiceCondition()`, `anyEffectNeedsDiceRoll()`, `isDiceConditionStatic()` |
| EffectFactory | `src/utils/EffectFactory.ts` | `createEffectsFromSpaceEntry()`, `parseSpaceEffect()` |
| EffectEngineService | `src/services/EffectEngineService.ts` | `processEffects()` |
| GameRulesService | `src/services/GameRulesService.ts` | `evaluateCondition()` - handles dice_roll_X conditions |
| StateService | `src/services/StateService.ts` | State management |

---

*Document generated: December 2025*
*Based on codebase analysis of Game Alpha turn processing system*
