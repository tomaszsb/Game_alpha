# API Reference — Unravel Codes: The Game

**Last Updated:** August 1, 2026
**Status:** Beta (v3.1.85)

> **Scope of this doc:** server REST endpoints + a one-line summary of each service in `IServiceContainer`. For full TypeScript signatures, the source under `src/types/ServiceContracts.ts` is authoritative — this doc used to duplicate those interfaces and went stale fast. For architectural context (DI, real cycles, handler pattern, REAL/TEMP) see [ARCHITECTURE.md](./ARCHITECTURE.md).

> **Known gap (found 2026-08-01):** the REST API table below covers ~13 of the ~55 routes actually registered in `server/server.js`. Whole feature areas are undocumented here — accounts/login (`/api/accounts/*`), the Teacher Layer's classroom instances (`/api/instances/*`), admin (`/api/admin/*` beyond `verify`), and playtester tracking (`/api/playtest/*`). This section only got a header/CSV/service-table refresh this pass, not a full endpoint audit — that's real, separate work (each route needs its handler read to describe correctly, not just listed).

---

## Server REST API

Express backend at `server/server.js`. Base URLs:

- **Local:** `http://localhost:3001`
- **Production:** `https://game.unravelcodes.com`

### Game management

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/games` | List active games (no token returned). **Requires `x-admin-password`** (2026-06-12: game codes are the join secret, so the full list is admin-only). |
| `POST` | `/api/games` | Create new game (returns `gameId` + `token`). Open by design (lobby button). |
| `GET` | `/api/games/:gameId/join-info` | Public lookup of `token` + basic game info by `gameId`. Used by the lobby's join-by-code flow (state endpoints below require the token in headers). Added v2.61.1. Deliberately open — the game code is the secret. |
| `GET` | `/api/games/:gameId/state` | Read current state (full `GameState`). Requires `X-Game-Token` header or `?token=` query. |
| `POST` | `/api/games/:gameId/state` | Replace state (rejects stale `clientVersion` with HTTP 409). Requires `X-Game-Token`. |
| `DELETE` | `/api/games/:gameId` | Delete a game. **Requires the game's token or `x-admin-password`** (2026-06-12; was unauthenticated). |
| `DELETE` | `/api/games/:gameId/state` | Reset a game's state. **Requires the game's token or `x-admin-password`** (2026-06-12; was unauthenticated). |

### Auth

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/admin/verify` | Admin password check (rate-limited 5 / 15 min) |

### Feedback

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/feedback` | Submit bug report (with optional screenshot). Open by design (in-game button). |
| `GET` | `/api/feedback` | List reports (no screenshots). **Requires `x-admin-password` or `?token={FEEDBACK_TOKEN}`** (2026-06-12, DEF-6: reports carry reporter PII). |
| `GET` | `/api/feedback/:id` | Full report incl. screenshot/consoleLogs/contact. **Same auth as list** (2026-06-12). |
| `PATCH` | `/api/feedback/:id` | Update report status. **Same auth as list** (2026-06-12). |
| `GET` | `/api/public/feedback/open` | Compact unresolved list for `/start`. Requires `?token={FEEDBACK_TOKEN}` (since v2.63.5). |

### Telemetry

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/logs` | Visitor logs. **Requires `x-admin-password` or `?token={FEEDBACK_TOKEN}`** (2026-06-12: logs carry visitor IPs). |
| `GET` | `/api/logs/summary` | Daily summary incl. visitor IP list. **Same auth** (2026-06-12). |

### Auth tokens

Each created game gets a unique game token. WebSocket connections and HTTP `state` writes require the token in `X-Game-Token` (added v2.39.3).

### CORS

CORS is restricted to `game.unravelcodes.com` + localhost in production (since v2.28.1). Configurable via `CORS_ORIGIN` env var.

---

## Service APIs

All services are constructor-injected (with two real cycles using setter injection — see [ARCHITECTURE.md](./ARCHITECTURE.md#circular-dependency-resolution-setter-injection)). For full type signatures see [`src/types/ServiceContracts.ts`](../../src/types/ServiceContracts.ts).

### Core services

| Service | Responsibility |
|---|---|
| `DataService` | Loads CSVs from `public/data/CLEAN_FILES/`. Exposes lookups for spaces, cards, movements, effects, dice outcomes, modal config, logic questions, path-choice rules, and Workstream 6 per-space flags. |
| `StateService` | Single source of truth for `GameState`. Immutable updates, REAL/TEMP turn lifecycle, snapshot capture, server version tracking for sync conflict resolution. |
| `TurnService` | Turn lifecycle: `startTurn`, `endTurn`, `nextPlayer`, `tryAgainOnSpace`, `rollDiceWithFeedback`. Orchestrates effect engine + movement. |
| `CardService` | Card draw/play/transfer/discard. Per-player decks. Card effect parsing into `Effect[]` via `EffectFactory`. |
| `MovementService` | Valid moves, dice destinations, logic-question walker, path-choice memory + cross-space exclusion via `PATH_CHOICE_RULES.csv`. |
| `EffectEngineService` | Processes `Effect[]` from cards/spaces/dice. Delegates RESOURCE_CHANGE/FEE_DEDUCTION to `FinancialEffectHandler`, CARD_DRAW/DISCARD/ACTIVATION/PLAY_CARD to `CardEffectHandler`. |
| `ResourceService` | Money + time updates with `canAfford()` gating. Funding history tracking. |
| `GameRulesService` | Win condition, condition evaluator (`scope_le_4m`, `dice_roll_N`, etc.), validation. |
| `ChoiceService` | Player-choice modals (movement, card selection, logic questions, etc.). |
| `NegotiationService` | Player-to-player negotiations on `Negotiate=YES` spaces. |
| `NotificationService` | Unified notifications (toasts, banners, modals). |
| `ApprovalService` | DOB/FDNY approval tracking + end-game missing-approval penalty. Optional in `IServiceContainer` (only `MovementService`/`DiceRollProcessor` read it directly); always populated in production. |
| `TargetingService` | Multi-player effect targeting (e.g. "person to right takes a card"). |
| `LoggingService` | Action log with exploration-session-aware commit/rollback for Try Again. |
| `PlayerActionService` | High-level command surface for UI components. |

### Sync services

| Service | Responsibility |
|---|---|
| `ServerSyncService` | Debounced HTTP state sync (500ms), conflict handling via 409 + reload. |
| `WebSocketSyncService` | WebSocket push for cross-device updates. Pre-increments local version before HTTP POST to suppress self-echo (BUG-001/002 fix v2.41.1). |

### Helper services

| Service | Responsibility |
|---|---|
| `DiceService` | Dice rolling and outcome lookup. |
| `DiceRollProcessor` | Dice-effect processing with callbacks. |
| `SpaceEffectService` | Space-effect retrieval; data-driven design fee math (`fee_calculation_method`). |
| `SpaceArrivalProcessor` | Effects on arrival. |
| `TurnStateManager` | REAL/TEMP state lifecycle + per-turn cost ledger for Try Again semantics. |
| `TurnTransitionHandler` | Extracted from `TurnService.nextPlayer()` (Mar 2026). |
| `MovementExecutor` | Extracted from `TurnService.endTurnWithMovement()` (Mar 2026). |
| `CardEffectService` | Card draw/replace/return high-level operations (separate from `CardEffectHandler`). |
| `TooltipService` | Tooltip content. |
| `SpeechService` | TTS character-voice narration via Web Speech API. |

---

## Type definitions

Authoritative source: [`src/types/`](../../src/types/). Key entry points:

- `StateTypes.ts` — `GameState`, `Player`, `MutablePlayerState`, `TurnStateModel`
- `DataTypes.ts` — `Card`, `GameConfig`, `SpaceEffect`, `DiceEffect`, `Movement`, `PathChoiceRule`
- `EffectTypes.ts` — `Effect` discriminated union (`RESOURCE_CHANGE`, `FEE_DEDUCTION`, `CARD_DRAW`, `CARD_DISCARD`, `CARD_ACTIVATION`, `PLAY_CARD`, `PLAYER_MOVEMENT`, `TURN_CONTROL`, `CHOICE`, `EFFECT_GROUP_TARGETED`, `CONDITIONAL_EFFECT`, `RECALCULATE_SCOPE`, `LOG`)
- `ServiceContracts.ts` — `I*Service` interfaces and `IServiceContainer`

---

## CSV data files

Game CSVs live under `public/data/`. `SOURCE_FILES/` is the editable layer (Data Editor target); `CLEAN_FILES/` is the runtime-loaded output of `server/processGameData.js`.

| CSV | Purpose |
|---|---|
| `Spaces.csv` (source) → `GAME_CONFIG.csv` (clean) | Per-space configuration. 25 columns as of v3.1.85. |
| `MOVEMENT.csv` | Movement type + destinations per (space, visit_type). |
| `SPACE_EFFECTS.csv` | Effects per (space, visit_type, action). |
| `SPACE_CONTENT.csv` | Per-space narrative/story content. |
| `DICE_EFFECTS.csv` | Dice-roll effect mappings. |
| `DICE_OUTCOMES.csv` | Dice-roll destination mappings for dice-movement spaces. |
| `DICE_ROLL_INFO.csv` | Player-facing copy for dice-roll prompts. |
| `CARDS_EXPANDED.csv` | Card definitions (W/B/E/L/I types). |
| `CARD_TYPES.csv` | Per-card-type metadata (labels, styling). |
| `ACTION_TOOLTIPS.csv` | Tooltip copy for action buttons. |
| `GLOSSARY.csv` | In-game term definitions (the dictionary panel). |
| `LOGIC_QUESTIONS.csv` | Yes/no decision-chain rows for `path=LOGIC` spaces. |
| `PATH_CHOICE_RULES.csv` | Cross-space exclusion rules driven by stored path choices (Workstream 6 #4). |

`MODAL_CONFIG.csv` (previously listed here) no longer exists — its role was absorbed by the CSVs above (verify against `DataService.ts` if precision matters; this doc doesn't duplicate load-order detail).

---

## Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) — DI, effect engine, REAL/TEMP, handler pattern
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) — How to run tests
- [CODE_STYLE.md](./CODE_STYLE.md) — Project conventions
- [CHANGELOG.md](../../CHANGELOG.md) — Per-version history
