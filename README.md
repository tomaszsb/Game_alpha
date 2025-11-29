# Game Alpha - Construction Project Management Board Game

**Status:** Production Ready (November 2025)
**Version:** 1.0.0
**Test Coverage:** 617 tests passing (100% success rate)

## Overview

Game Alpha is a multi-player board game that simulates the construction project management process, from initial design through regulatory approval and construction. Players navigate through various spaces representing real-world construction phases, manage resources (money and time), collect cards representing work scope and regulatory requirements, and compete to complete their projects first.

Built with modern web technologies and a clean service-oriented architecture, the game supports both single-device and multi-device gameplay with real-time state synchronization.

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)

### Installation
```bash
# Clone or navigate to the repository
cd /mnt/d/unravel/current_game/Game_Alpha

# Install dependencies
npm install
```

### Running the Game
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

1. Start the game and add players on the main device
2. Use QR codes or short URLs (`?p=P1`, `?p=P2`) to connect mobile devices
3. Each player can control their turn from their own device
4. State syncs automatically across all connected devices

**Note:** Backend server (port 3001) is **required** for multi-device features.

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

**Note:** Running all 617 tests together (`npm test`) may hang due to test isolation issues with module-level mocks. Use batch execution for best results.

## Project Structure

```
Game_Alpha/
├── src/                          # Application source code
│   ├── components/              # React UI components (expandable sections, modals, etc.)
│   ├── services/                # Business logic services (8 core services)
│   │   ├── DataService.ts       # CSV data loading and access
│   │   ├── StateService.ts      # Immutable state management
│   │   ├── TurnService.ts       # Turn sequence and player progression
│   │   ├── CardService.ts       # Card operations and deck management
│   │   ├── MovementService.ts   # Space transitions and pathfinding
│   │   ├── EffectEngineService.ts  # Card effects and duration-based mechanics
│   │   ├── ResourceService.ts   # Money and time tracking
│   │   └── GameRulesService.ts  # Validation and win conditions
│   ├── types/                   # TypeScript interfaces and contracts
│   ├── utils/                   # Pure utility functions
│   ├── context/                 # React context providers
│   └── styles/                  # CSS and styling (animations.css, theme constants)
├── tests/                        # Test suite (617 tests)
│   ├── services/                # Service unit tests
│   ├── components/              # Component tests
│   ├── integration/             # Integration tests
│   ├── E2E/                     # End-to-end scenarios
│   └── scripts/                 # Test utility scripts
├── data/                         # Game CSV data (spaces, cards, movements, effects)
├── public/                       # Static assets and processed CSV files
├── server/                       # Backend Express server (state sync)
├── docs/                         # Technical documentation
│   ├── architecture/            # Technical architecture and design
│   ├── guides/                  # User and developer guides
│   ├── project/                 # Project management and status
│   └── archive/                 # Archived/obsolete documentation
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration (strict mode)
├── vite.config.ts               # Vite build configuration
└── vitest.config*.ts            # Test configurations (dev/ci)
```

## Key Features

### Gameplay Features
- **Dynamic Movement System:** Players navigate through construction phases with fixed paths, dice-based movement, and conditional choices
- **Resource Management:** Track money (from bank loans, investments, owner funding) and time (project duration)
- **Card System:** Five card types (W-Work, B-Bank, E-Extra, L-Loan, I-Investment) with 100+ unique cards
- **Multi-Player Effects:** Cards that affect other players, requiring negotiation and strategic interactions
- **Try Again Mechanic:** Snapshot-based undo system for exploring different choices

### Technical Features
- **Service-Oriented Architecture:** Clean separation of concerns with dependency injection
- **Immutable State Management:** Predictable state updates with snapshot support
- **Transactional Logging:** 100% accurate game log with exploration session tracking
- **Real-Time Synchronization:** WebSocket-based state sync for multi-device play
- **Comprehensive Testing:** 617 tests covering services, components, and E2E scenarios
- **TypeScript Strict Mode:** Type-safe codebase with 12 remaining errors (down from 28+)

## Technology Stack

- **Frontend:** React 18, TypeScript, Vite
- **Backend:** Express (Node.js)
- **Testing:** Vitest, React Testing Library
- **Styling:** CSS3 with CSS variables and animations
- **Data:** CSV-based game configuration
- **State Management:** Custom immutable state service with subscriber pattern

## Documentation

### Getting Started
- **Quick Start:** This README
- **Development Guide:** `docs/project/CLAUDE.md` - Developer charter and workflows
- **Project Status:** `docs/project/TODO.md` - Current tasks and completion history

### Architecture
- **Technical Deep Dive:** `docs/project/TECHNICAL_DEEP_DIVE.md` - System architecture
- **Testing Guide:** `docs/architecture/TESTING_REQUIREMENTS.md` - Test strategy and patterns
- **Changelog:** `docs/architecture/CHANGELOG.md` - Version history and changes

### Project Management
- **Product Charter:** `docs/project/PRODUCT_CHARTER.md` - Vision and objectives
- **Technical Debt:** `docs/project/TECHNICAL_DEBT.md` - Known issues and limitations

## Development Workflow

### Code Quality Standards
- All code: TypeScript with strict type checking
- Testing: Comprehensive test coverage for all changes
- Components: Single responsibility, <200 lines preferred
- Services: Focused, well-documented, testable
- Architecture: Follow established patterns and conventions

### Before Committing
1. Run relevant test batches to ensure no regressions
2. Verify TypeScript compilation (`npm run typecheck`)
3. Update documentation if needed
4. Follow commit message conventions

### TypeScript Strict Mode
Currently reducing TypeScript errors toward 0:
- **Current:** 12 errors remaining (down from 28+)
- **Target:** 0 errors for full strict mode compliance
- **Remaining:** Legacy files (App.tsx, ErrorBoundary.tsx, DataEditor.tsx, GameSpace.tsx)

## Recent Updates

### November 27-28, 2025
- Fixed button positioning issues in Player Panel (buttons no longer float over game board)
- Simplified NextStepButton to only handle "End Turn" action
- Enhanced development workflow: `npm run dev` now starts both frontend and backend servers
- Reduced TypeScript errors from 28+ to 12
- Organized documentation with new `docs/archive/` directory

### November 24, 2025
- Implemented short URL system for QR codes (`?p=P1` instead of long player IDs)
- Added Display Settings feature for per-player panel visibility control
- Optimized layout to hide player columns when all panels are hidden
- Enhanced device detection for mobile and desktop connections

### November 14, 2025
- Fixed critical CSV processing bugs in movement system
- Implemented path choice memory for regulatory compliance
- Enhanced data validation and processing tools
- All E2E tests passing including happy path scenarios

## Contributing

This project follows a service-oriented architecture with clear separation of concerns. When adding features:

1. Update or create services in `src/services/` for business logic
2. Update interfaces in `src/types/` for contracts
3. Create or update components in `src/components/` for UI
4. Add comprehensive tests in `tests/`
5. Update CSV data in `data/` if needed
6. Document changes in `docs/architecture/CHANGELOG.md`

## License

MIT

## Support

For issues, questions, or contributions:
- **Issues:** See `docs/project/TECHNICAL_DEBT.md` for known issues
- **Documentation:** Check `docs/` directory for comprehensive guides
- **Testing:** Run `./tests/scripts/run-tests-batch-fixed.sh` to verify functionality
