# API Reference — Unravel Codes: The Game

**Last Updated:** August 1, 2026
**Status:** Beta (v3.1.85)

> **Scope of this doc:** server REST endpoints + a one-line summary of each service in `IServiceContainer`. For full TypeScript signatures, the source under `src/types/ServiceContracts.ts` is authoritative — this doc used to duplicate those interfaces and went stale fast. For architectural context (DI, real cycles, handler pattern, REAL/TEMP) see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Server REST API

Express backend at `server/server.js` (55 routes, all documented below as of 2026-08-01). Base URLs:

- **Local:** `http://localhost:3001`
- **Production:** `https://game.unravelcodes.com`

### Health

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check: status, git commit, active game count, WebSocket room/client counts. No per-game detail — game codes are the join secret, so a public health check must not leak them (that detail lives behind `/api/debug/games`, admin-only, below). |

### Game management

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/games` | List active games (no token returned). **Requires `x-admin-password`** (2026-06-12: game codes are the join secret, so the full list is admin-only). |
| `POST` | `/api/games` | Create new game (returns `gameId` + `token`). Open by design (lobby button) *unless* `instanceId` names a non-default classroom, in which case it requires that classroom's owning/co-teaching teacher session or `x-admin-password` — a stranger can't spawn games from a private classroom. Re-bakes the classroom's board before seeding; 503s if the bake fails. |
| `GET` | `/api/games/:gameId/join-info` | Public lookup of `token` + basic game info by `gameId`, plus a display-only player roster (id/name/color/avatar/connected — never money/hand/history) for the "which player are you?" picker. Used by the lobby's join-by-code flow (state endpoints below require the token in headers). Added v2.61.1. Deliberately open — the game code is the secret. Rate-limited 30/min/IP. |
| `GET` | `/api/games/:gameId/state` | Read current state (full `GameState`). Requires `X-Game-Token` header or `?token=` query. |
| `POST` | `/api/games/:gameId/state` | Replace state (rejects stale `clientVersion` with HTTP 409). Requires `X-Game-Token`. Auto-creates the game record if it doesn't exist yet (client supplies the token). Triggers a foreign-IP SMS alert on SETUP→PLAY transitions if the kill switch is on (capped 5/hour). |
| `DELETE` | `/api/games/:gameId` | Delete a game. **Requires the game's token or `x-admin-password`** (2026-06-12; was unauthenticated). |
| `DELETE` | `/api/games/:gameId/state` | Reset a game's state. **Requires the game's token or `x-admin-password`** (2026-06-12; was unauthenticated). |

### Legacy & debug game endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/gamestate` | Legacy single-game read — hardcoded game id `G0`, pre-dates the multi-game `/api/games/:gameId/*` API. No auth on read. |
| `POST` | `/api/gamestate` | Legacy single-game write. **Requires `G0`'s `X-Game-Token`** (gated 2026-06-12; previously unauthenticated — closed an accidental-fallback corruption path). |
| `DELETE` | `/api/gamestate` | Legacy single-game reset. **Requires `G0`'s token or `x-admin-password`** (2026-06-12; was unauthenticated). |
| `GET` | `/api/debug/state` | Full state dump for legacy game `G0`. **Admin only.** |
| `GET` | `/api/debug/games` | Full detail (version, state presence, player count, timestamps) for every active game — the per-game detail `/health` deliberately omits. **Admin only.** |

### Auth

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/admin/verify` | Admin password check (rate-limited 5 / 15 min) |

### Teacher accounts & sessions

Admin-mediated model: only the admin creates accounts or resets passwords (no self-signup, no "forgot password"). Login returns an opaque session token the client sends back as `X-Teacher-Session`; it authorizes writes to classrooms that account owns or co-teaches (see below). Reads stay open — sessions only gate writes.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/accounts/login` | Username + password → session token + public account. Rate-limited 5/15min/IP. |
| `POST` | `/api/accounts/logout` | Revoke the presented `X-Teacher-Session`. Idempotent. |
| `GET` | `/api/accounts/me` | Who-am-I — client calls this on boot to restore a session into UI state. Requires `X-Teacher-Session`. |

### Teacher instance layer (classrooms)

"Instances" are per-classroom board configurations (Teacher Layer): each classroom has its own space on/off toggles, teacher-authored card copies, and narrative insertions spliced onto board edges. Games are seeded from a classroom's resolved (baked) board — `POST /api/games` above. Reads are open by design (board content is public); writes require the classroom's write token (`X-Instance-Token`), the owning/co-teaching account's session (`X-Teacher-Session`), or `x-admin-password`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/instances/mine` | The logged-in teacher's own classrooms (owned or co-taught). Requires `X-Teacher-Session`. |
| `POST` | `/api/instances` | Teacher self-service classroom creation — caller becomes owner automatically, id generated from the display name. Requires `X-Teacher-Session`. |
| `GET` | `/api/instances/:id` | Public read: metadata, config version, slots/detours/teacherCopies, resolved bake stamp, last validation report. Write token never included. |
| `GET` | `/api/instances/:id/catalog` | Classroom Setup screen's data source: full stock card deck (not just the resolved/filtered board) + classroom overrides, protection tiers, copies, last validation report. |
| `DELETE` | `/api/instances/:id` | Delete a classroom. Owner or admin only; the default classroom can never be deleted. Running games keep their own baked board, so this never disturbs a game in progress. |
| `POST` | `/api/instances/:id/board` | Toggle spaces on/off (`changes: { spaceName: { used, detour? } }`). Supports `dryRun:true` for the hybrid-confirm UI's before/after preview before committing. |
| `POST` | `/api/instances/:id/copies` | Create a teacher copy of a stock card under a stable id — the slot plays the copy, the stock original stays in the library. |
| `PATCH` | `/api/instances/:id/copies/:copyId` | Update a teacher copy's field overrides (`overrides: { visit_type: { field: value } }`). |
| `DELETE` | `/api/instances/:id/copies/:copyId` | Delete a teacher copy. |
| `POST` | `/api/instances/:id/insertions` | Add a teacher-authored narrative space spliced onto an existing board edge (fixed, choice, or dice). Requires `from`, `to`, `displayName`. |
| `PATCH` | `/api/instances/:id/insertions/:insertionId` | Update an insertion's fields (`patch: { field: value }`). |
| `DELETE` | `/api/instances/:id/insertions/:insertionId` | Remove an insertion. |
| `POST` | `/api/instances/:id/positions` | Save dragged tile positions for the classroom's board layout (`positions: { spaceName: { x, y } }`). Replaced the old whole-`Spaces.csv` round-trip through `save-source-files` — positions are classroom config now, so they survive every deploy. |

All mutation routes (`board`/`copies`/`insertions`/`positions`) share one flow: authorize → apply the change to the loaded config → validate against current stock data → on success, save + re-bake. A validation failure returns HTTP 422 with the report instead of saving. Every mutation route accepts `dryRun:true` to preview the validation report without saving, and an optional `baseConfigVersion` for optimistic concurrency — a stale base returns HTTP 409 instead of silently clobbering a concurrent edit from another tab/teacher.

### Admin: accounts & classrooms

Everything below requires `x-admin-password`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/accounts` | List all teacher accounts (management UI's owner picker). |
| `POST` | `/api/admin/accounts` | Create a teacher account — the only way accounts come into being. |
| `POST` | `/api/admin/accounts/:id/reset-password` | Reset a teacher's password; revokes their existing sessions. |
| `DELETE` | `/api/admin/accounts/:id` | Delete a teacher account. Revokes sessions and releases any classrooms they owned back to admin-only (the rooms survive). |
| `GET` | `/api/admin/instances` | List every classroom (never includes write tokens). |
| `POST` | `/api/admin/instances` | Create a classroom, optionally binding an owner account in one step. |
| `POST` | `/api/admin/instances/:id/owner` | Bind, rebind, or clear (`owner: null`) a classroom's owner. |
| `GET` | `/api/admin/settings` | Read runtime settings (currently just the foreign-game-alert kill switch). |
| `POST` | `/api/admin/settings` | Update runtime settings. |

### Admin: game data management

Everything below requires `x-admin-password`; rate-limited 5/15min/IP.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/admin/save-source-files` | Write edited `Spaces.csv`/`DiceRoll Info.csv` (+ optional `ModalConfig.csv`) to the writable data dir and regenerate `CLEAN_FILES`. Backs the in-app Data Editor. Live edits don't survive the next deploy — content's home is the repo. |
| `POST` | `/api/admin/reset-to-baseline` | Restore all CSVs from the deployed `BASELINE/` snapshot (overwriting any live edits) and regenerate `CLEAN_FILES`. 404s if the deployment has no baseline dir. |

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

### Playtest tracking

Funnel-tracking for the `/challenge` outreach flow (landing → preview → reminder signup → play). No auth on the tracking/carrier/push-key routes (fire-and-forget analytics + public config); `remind-me`/`schedule-push` are rate-limited separately and stricter (5/hour/IP) since they trigger a real outbound email/SMS/push send on the caller's behalf.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/playtest/track` | Log a funnel event — one of `landing_view`, `preview_click`, `reminder_selected`, `bookmark_click`, `play_click`, `return_visit`, `share_click`. 400s on an unrecognized event name. |
| `GET` | `/api/playtest/carriers` | List supported SMS carrier gateways (for the "text me a reminder" form). |
| `GET` | `/api/playtest/push-public-key` | VAPID public key for browser push subscriptions. 503 if push isn't configured on this deployment. |
| `POST` | `/api/playtest/schedule-push` | Schedule a browser push reminder for a future `sendAt`. Rate-limited 5/hour/IP. 503 if push isn't configured. |
| `POST` | `/api/playtest/remind-me` | Send (or, with a future `sendAt`, schedule) an email/SMS reminder. Validates the recipient before responding, so a bad address/carrier fails on the form rather than silently at send time. Rate-limited 5/hour/IP. |
| `GET` | `/api/admin/playtest-stats` | Aggregated funnel counts by event and campaign source, parsed from the visitor log. **Admin only.** |

### Admin stats dashboard

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/stats/summary` | Visitor/traffic stats backing the `/admin/stats` page — windowed (`24h`/`7d`/`30d`/`all`), filterable by source/action/country/origin, with geo-country lookup and bot filtering. IPs redacted to a /24-ish prefix by default (`?full=true` for real addresses, still admin-gated). Log entries are parsed once and cached 45s so repeated dashboard refreshes don't re-parse the full log file each time. **Admin only.** |

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
