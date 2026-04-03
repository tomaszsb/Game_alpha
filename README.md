# Unravel Codes: The Game

**Status:** Alpha Testing (April 2026)
**Version:** 2.39.3
**Test Coverage:** ~1,014 tests passing (100% success rate)
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
- Node.js (v16 or higher)
- npm (v8 or higher)

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
game_alpha/
├── src/                          # Application source code
│   ├── components/              # React UI components (expandable sections, modals, etc.)
│   ├── services/                # Business logic services (26 service files)
│   │   ├── DataService.ts       # CSV data loading and access
│   │   ├── StateService.ts      # Immutable state management
│   │   ├── TurnService.ts       # Turn sequence and player progression
│   │   ├── CardService.ts       # Card operations and deck management
│   │   ├── MovementService.ts   # Space transitions and pathfinding
│   │   ├── EffectEngineService.ts  # Card effects and duration-based mechanics
│   │   ├── ResourceService.ts   # Money and time tracking
│   │   ├── GameRulesService.ts  # Validation and win conditions
│   │   ├── ChoiceService.ts     # Player choice handling
│   │   ├── NegotiationService.ts # Player interactions
│   │   ├── NotificationService.ts # Unified notifications
│   │   ├── TargetingService.ts  # Multi-player targeting
│   │   ├── LoggingService.ts    # Centralized logging
│   │   └── PlayerActionService.ts # Command orchestration
│   ├── types/                   # TypeScript interfaces and contracts
│   ├── utils/                   # Pure utility functions
│   ├── context/                 # React context providers
│   └── styles/                  # CSS and styling (animations.css, theme constants)
├── tests/                        # Test suite (~1,027 tests across 87 test files)
│   ├── services/                # Service unit tests
│   ├── components/              # Component tests
│   ├── integration/             # Integration tests
│   ├── E2E/                     # End-to-end scenarios
│   └── scripts/                 # Test utility scripts
├── data/                         # Game CSV data (spaces, cards, movements, effects)
├── public/                       # Static assets and processed CSV files
├── server/                       # Backend Express server (state sync)
├── docs/                         # Technical documentation
│   ├── core/                    # CLAUDE.md, PROJECT_STATUS.md
│   ├── technical/               # Architecture, APIs, testing, code style
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
- **Service-Oriented Architecture:** Clean separation of concerns with dependency injection and 26 specialized services.
- **Immutable State Management:** Predictable state updates with snapshot support and version tracking.
- **Transactional Logging:** 100% accurate game log with exploration session tracking.
- **State Synchronization:** HTTP-based state sync with 500ms debouncing for multi-device play.
- **Comprehensive Testing:** ~1,014 tests covering services, components, and E2E scenarios.

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite 7
- **Backend:** Express (Node.js 20)
- **Testing:** Vitest 4, React Testing Library
- **Styling:** CSS3 with CSS variables and Framer Motion animations
- **Data:** CSV-based game configuration with automated processing pipeline

## Recent Updates

### April 2, 2026 (v2.39.3)
- **Security Hardening**: Implemented WebSocket authentication (X-Game-Token) and state schema validation.
- **Accessibility**: Converted Pro Ledger headers to buttons with `aria-expanded` support.
- **UX Polish**: Fixed modal exit animations (9 modals) and consolidated money formatting.
- **Critical Fix**: Resolved `process.stderr` crash in browser-side movement code.

### April 1, 2026 (v2.39.1)
- **Animation Overhaul**: Migrated ModalBase to Framer Motion for smooth entry/exit/shake animations.
- **Per-Action Narrative**: Added per-action story text in modals configured via Space Data Editor.

### March 31, 2026 (v2.37.0)
- **Data-Driven Pipeline**: Fee types and dice roll metadata now computed at processing time.
- **Affordability Gating**: All financial paths now require `canAfford()` validation in ResourceService.

### March 23, 2026 (v2.34.0)
- **Code Audit Cleanup**: Removed ~5,200 lines of dead code and deleted 37 unused files.
- **Service Decomposition**: Refactored TurnService into MovementExecutor and TurnTransitionHandler.


## Contributing

This project follows a service-oriented architecture with clear separation of concerns. When adding features:

1. Update or create services in `src/services/` for business logic
2. Update interfaces in `src/types/` for contracts
3. Create or update components in `src/components/` for UI
4. Add comprehensive tests in `tests/`
5. Update CSV data in `data/` if needed
6. Document changes in `CHANGELOG.md`

## License

MIT

## Support

For issues, questions, or contributions:
- **Issues:** See `docs/technical/TECHNICAL_DEBT.md` for known issues
- **Documentation:** Check `docs/` directory for comprehensive guides
- **Testing:** Run `./tests/scripts/run-tests-batch-fixed.sh` to verify functionality
