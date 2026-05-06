# Unravel Codes: The Game

**Status:** Beta (May 2026)
**Version:** 2.59.0
**Test Coverage:** 99 test files (run via batch script — see Testing below)
**Public URL:** `https://game.unravelcodes.com`

## Overview

Unravel Codes: The Game is a multi-player board game that simulates the construction project management process, from initial design through regulatory approval and construction. Players navigate through various spaces representing real-world construction phases, manage resources (money and time), collect cards representing work scope and regulatory requirements, and compete to complete their projects first.

Built with modern web technologies and a clean service-oriented architecture, the game supports both single-device and multi-device gameplay with real-time state synchronization.

## Quick Start

### Play Online (Recommended)
Visit the public URL: `https://game.unravelcodes.com`

1. Click "Create New Game" to start a session
2. Share the game link with friends/family
3. Each player uses their own device with the player URL

### Local Development

#### Prerequisites
- Node.js (v20 or higher — production runs Node 20)
- npm (v10 or higher)

#### Installation
```bash
# Clone or navigate to the repository
cd /mnt/d/unravel/current_game/Game_Alpha

# Install dependencies
npm install
```

#### Running the Game
```bash
# Start both frontend and backend servers
npm run dev
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

The `npm run dev` command automatically starts:
- **Vite dev server** (port 3000) - Frontend with hot module reloading
- **Express backend server** (port 3001) - State persistence for multi-device play

### Alternative Startup Commands
```bash
# Frontend only (no state persistence)
npm run dev:vite

# Backend only
npm run server

# Production build
npm run build
```

## Multi-Device Gameplay

The game supports multiple players on different devices with real-time state synchronization:

1. Start a game in the Game Lobby
2. Share the game URL with game ID (`?g=G1`) with other players
3. Use QR codes or short URLs (`?g=G1&p=P1`, `?g=G1&p=P2`) to connect devices
4. Each player controls their turn from their own device
5. State syncs automatically across all connected devices

**Remote Play:** Players can join from anywhere in the world using the public URL.

**Multi-Game Support:** Multiple game sessions can run simultaneously (G1, G2, G3, etc.).

## Testing

### Recommended Test Execution
```bash
# Run tests in batches (recommended)
./tests/scripts/run-tests-batch-fixed.sh

# Run specific test suites
npm test tests/services/
npm test tests/components/
npm test tests/E2E-

# Run single test file
npm test tests/services/TurnService.test.tsx
```

**Note:** Running all tests together (`npm test`) may hang due to test isolation issues with module-level mocks. Use batch execution (see [Testing Guide](docs/technical/TESTING_GUIDE.md)) for best results.

## Project Structure

```
Game_Alpha/
├── src/                          # Application source code
│   ├── components/              # React UI components (board, modals, player, editor, ...)
│   ├── services/                # 28 business-logic services (DataService, StateService,
│   │                            #   TurnService, CardService, MovementService,
│   │                            #   EffectEngineService, ResourceService, GameRulesService,
│   │                            #   ChoiceService, NegotiationService, NotificationService,
│   │                            #   TargetingService, LoggingService, PlayerActionService,
│   │                            #   ServerSyncService, WebSocketSyncService, SpeechService,
│   │                            #   plus internal helpers: DiceService, DiceRollProcessor,
│   │                            #   SpaceEffectService, SpaceArrivalProcessor, TurnStateManager,
│   │                            #   TurnTransitionHandler, MovementExecutor, TooltipService,
│   │                            #   FinancialEffectHandler, CardEffectHandler, CardEffectService)
│   ├── types/                   # TypeScript interfaces and contracts
│   ├── utils/                   # Pure utility functions
│   ├── context/                 # React context providers (ServiceProvider, GameContext)
│   └── styles/                  # CSS variables, animations, theme
├── tests/                        # 99 test files (run via batch script — see below)
│   ├── services/                # Service unit tests
│   ├── components/              # Component tests
│   ├── integration/             # Integration tests
│   ├── E2E/                     # End-to-end scenarios
│   ├── ghost/                   # Ghost Player regression bot
│   └── scripts/                 # Test utility scripts
├── public/data/                  # Game CSV data
│   ├── SOURCE_FILES/            # Editable source CSVs (Data Editor target)
│   └── CLEAN_FILES/             # Pipeline-processed CSVs the game reads
├── server/                       # Backend Express server (state sync, processGameData.js)
├── docs/                         # Documentation
│   ├── core/                    # CLAUDE.md, BETA_PLAN_V3, PROJECT_STATUS, PRODUCT_CHARTER
│   ├── technical/               # Architecture, APIs, testing, code style, board diagrams
│   ├── user/                    # User manual, release notes
│   └── archive/                 # Historical milestones
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration (strict mode)
├── vite.config.ts               # Vite build configuration
└── vitest.config*.ts            # Test configurations (dev/ci)
```

## Key Features

### Gameplay Features
- **Dynamic Movement System:** Players navigate through construction phases with fixed paths, dice-based movement, and conditional choices.
- **Resource Management:** Track money (from bank loans, investments, owner funding) and time (project duration).
- **Card System:** Five card types (W-Work, B-Bank, E-Expeditor, L-Life Events, I-Investment) with 404 unique cards.
- **NPC Character Portraits:** 9 distinct NPC roles with randomized appearances and first-person narratives.
- **Multi-Player Effects:** Cards that affect other players, requiring negotiation and strategic interactions.
- **Try Again Mechanic:** Snapshot-based undo system for exploring different choices.

### Technical Features
- **Security-First Architecture:** WebSocket authentication, state schema validation, and admin rate limiting.
- **Service-Oriented Architecture:** Clean separation of concerns with dependency injection across 28 services.
- **Immutable State Management:** REAL/TEMP state model with per-turn cost ledger for Try Again semantics.
- **Engine-Data Separation:** Per-space behavior driven by Spaces.csv flags (lock points, scope guards, fee math, auto-funding, regulatory phase, resume hubs) — educators can configure new spaces without code changes.
- **Transactional Logging:** Exploration-session-aware game log with commit/rollback semantics.
- **State Synchronization:** HTTP-based state sync with 500ms debouncing + WebSocket push for multi-device play.
- **Headless Regression Gate:** Ghost Player bot plays 50 random games per CI run; strict mode requires zero exceptions and ≥90% wins.

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite 7
- **Backend:** Express (Node.js 20)
- **Testing:** Vitest 4, React Testing Library
- **Styling:** CSS3 with CSS variables and Framer Motion animations
- **Data:** CSV-based game configuration with automated processing pipeline

## Recent Updates

See [CHANGELOG.md](CHANGELOG.md) for full per-version history. Highlights:

### April 26–29, 2026 (v2.51.0 → v2.58.0) — Workstream 6: Engine-Data Separation
Eight scenarios lifting hardcoded space-ID references into `Spaces.csv` flags so educators can configure new spaces without code changes: starting space, scope-zero guard, resume hubs, points-of-no-return, regulatory phase, design fee math (flat vs % of scope), setup-phase auto-funding, and path-choice memory + cross-space exclusion via `PATH_CHOICE_RULES.csv`. Phase 6.2 type loosening (`pathChoiceMemory: Record<string, string>`) shipped together. Phase 6.3 cosmetic mappings (display label override, review-loop message) closed in v2.58.0.

### April 21, 2026 (v2.49.0–v2.50.0)
- **Logic-tree movement restored** at REG-FDNY-FEE-REVIEW via new `LOGIC_QUESTIONS.csv` walker.
- **Story as composed per-action narratives**: in-page accordion replacing flat Action/Outcome blocks.

### April 16–18, 2026 (v2.47.1 → v2.48.4) — April Deficiency Cleanup
Tier 1 doc/code hygiene · Tier 2 30 typecheck errors resolved · Tier 3 false-cycle setter injection killed + dead negotiation pathway removed · Tier 4 Buckets B/C/D narrowed 50 of 109 `any` usages.

### April 8, 2026 (v2.41.0–v2.41.1)
G148 playtest fixes + Ghost Player hardening. WebSocket self-echo race condition fixed.

### April 4–6, 2026 (v2.40.0) — Beta Workstreams 1 & 2
Ghost Player regression gate + snapshot-based "Try Again" semantics with per-turn cost ledger.

## Contributing

Solo project — see [docs/core/CLAUDE.md](docs/core/CLAUDE.md) for AI session rules and [docs/core/BETA_PLAN_V3.md](docs/core/BETA_PLAN_V3.md) for current Beta strategy.

## License

MIT

## Support

- **Strategy & open work:** [TODO.md](TODO.md), [docs/core/BETA_PLAN_V3.md](docs/core/BETA_PLAN_V3.md)
- **Architecture:** [docs/technical/ARCHITECTURE.md](docs/technical/ARCHITECTURE.md)
- **Testing:** Run `./tests/scripts/run-tests-batch-fixed.sh` (full `npm test` may hang — see [docs/technical/TESTING_GUIDE.md](docs/technical/TESTING_GUIDE.md))
