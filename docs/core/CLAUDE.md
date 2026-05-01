
## 🤖 **SESSION INITIALIZATION**

### **⚠️ CRITICAL: Read This First**
Before making ANY code changes or commits:
1. **BRANCH RULE**: Work on `master` branch unless otherwise directed.
2. Read [../technical/TESTING_GUIDE.md](../technical/TESTING_GUIDE.md)
3. **Golden Rule**: Run all tests before committing. No exceptions.
4. If tests fail, stop and fix them. Never commit broken tests.

### **🌐 Browser Automation**
Chrome must be running with `--remote-debugging-port=9222` for browser automation.
- **Game URL**: `https://game.unravelcodes.com`

**One-time setup (Admin PowerShell) - enables WSL to reach Chrome:**
```powershell
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=9222 connectaddress=127.0.0.1 connectport=9222
```

**Start Chrome with debugging** (regular PowerShell):
```powershell
taskkill /F /IM chrome.exe
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\temp\chrome-debug-profile"
```

- **MCP Configuration**: Uses `--browserUrl=http://172.22.128.1:9222` (Windows host IP from WSL)
- **After Chrome is running**: Restart Claude Code once to connect.

---

### **📁 WORKSPACE & DIRECTORY STRUCTURE**

**Working Directory**: `/mnt/d/unravel/current_game/Game_Alpha/`

**Status**: Beta (v2.58.0) — live in production at `https://game.unravelcodes.com`. Workstream 6 (engine-data separation) closed Apr 29, 2026. Workstreams 3 (Living Map) and 5 (Live Dictionary) remain for v3.0.0 ship.

**Directory Structure:**
```
Game_Alpha/
├── src/                          # Application source code
│   ├── components/              # React UI (board, modals, player, editor, setup, layout)
│   ├── services/                # 28 services (DI, see ARCHITECTURE.md)
│   ├── types/                   # TypeScript interfaces and contracts
│   ├── utils/                   # Pure utility functions
│   ├── context/                 # React context providers (ServiceProvider)
│   └── styles/                  # CSS variables, animations, theme
├── tests/                        # 99 test files (run via batch script)
│   ├── services/                # Service unit tests
│   ├── components/              # Component tests
│   ├── integration/             # Integration tests
│   ├── E2E/                     # End-to-end scenarios
│   ├── ghost/                   # Ghost Player regression bot
│   └── scripts/                 # Test utility scripts
├── public/data/                  # Game CSV data
│   ├── SOURCE_FILES/            # Editable source CSVs (Data Editor target)
│   └── CLEAN_FILES/             # Pipeline-processed CSVs the game reads at runtime
├── server/                       # Backend server.js + processGameData.js pipeline
├── docs/                         # Documentation
│   ├── core/                    # CLAUDE.md (this file), BETA_PLAN_V3, PROJECT_STATUS,
│   │                            #   PRODUCT_CHARTER, AUTHORED_COPY_REVIEW, narratives-draft
│   ├── technical/               # Architecture, APIs, testing, code style, board diagrams
│   ├── user/                    # User manual, release notes, bug reports
│   └── archive/                 # Historical milestones (read-only)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config (strict)
├── vite.config.ts               # Vite build config
├── vitest.config*.ts            # Test configs (dev / ci)
└── index.html                    # Entry point
```

> Note: `scripts/` directory exists at repo root but is currently empty — utility scripts have been collapsed into `server/processGameData.js` and the JS port that runs in Docker.

### **Running Tests:**
```bash
# Run test batches (recommended due to test isolation issue)
./tests/scripts/run-tests-batch-fixed.sh

# Run specific test suite
npm test tests/services/
npm test tests/components/

# Run single test file
npm test tests/services/TurnService.test.tsx
```

### **Development Commands:**
```bash
# Install dependencies
npm install

# Start development servers (both Vite + Backend)
npm run dev
# Note: Uses concurrently to run both:
#   - Vite dev server (frontend) on port 3000
#   - Express backend server (state sync) on port 3001
# Backend server is REQUIRED for multi-device state persistence

# Start only frontend (for testing without persistence)
npm run dev:vite

# Start only backend server
npm run server

# Build for production
npm run build

# Run all tests (may hang - use batches instead)
npm test
```

### **🚀 Deployment**

**Production Server:** unraid (192.168.86.57) via SSH alias
**Public URL:** https://game.unravelcodes.com
**Repo on server:** `/mnt/user/appdata/Game_alpha`

```bash
# Deploy (from WSL)
ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"

# Check status
ssh unraid "docker ps | grep game_alpha"
ssh unraid "docker logs --tail 20 game_alpha"

# Restart without rebuild
ssh unraid "docker restart game_alpha"
```

**Docker details:**
- Container: `game_alpha`, port 3080 → 3001
- Data volume: `server/data:/app/data`
- Notifications: ntfy topic `unravel-game-alerts`

---

## 📝 **DOCUMENTATION PRINCIPLES** (December 8, 2025)

### **Golden Rule: Update Existing Docs, Don't Create New Ones**

**IMPORTANT**: When documenting changes, update existing living documents rather than creating new archive files.

### **Why This Matters**
- **Prevents documentation sprawl**: Easier to find information
- **Reduces duplication**: Single source of truth for each topic
- **Easier maintenance**: Update one file instead of many
- **Better discoverability**: Information is where people expect it

### **Where to Document Changes**

**UPDATED: December 9, 2025 - New Consolidated Structure**

| Type of Change | Document to Update | Location |
|----------------|-------------------|----------|
| **Technical changes, bug fixes, features** | `CHANGELOG.md` | Root |
| **User-facing changes, UI improvements** | `RELEASE_NOTES.md` | `docs/user/` |
| **Architecture patterns, service design** | `ARCHITECTURE.md` | `docs/technical/` |
| **Component/service APIs** | `API_REFERENCE.md` | `docs/technical/` |
| **Testing strategy, test patterns** | `TESTING_GUIDE.md` | `docs/technical/` |
| **Code conventions, style rules** | `CODE_STYLE.md` | `docs/technical/` |
| **User instructions, gameplay** | `USER_MANUAL.md` | `docs/user/` |
| **Project health, current status** | `PROJECT_STATUS.md` | `docs/core/` |
| **Current tasks, priorities** | `TODO.md` | Root |

**Quick Reference:**
- **Root:** README.md, TODO.md, CHANGELOG.md
- **docs/core/:** CLAUDE.md, BETA_PLAN_V3.md, PROJECT_STATUS.md, PRODUCT_CHARTER.md, AUTHORED_COPY_REVIEW.md, narratives-draft.md
- **docs/technical/:** ARCHITECTURE.md, API_REFERENCE.md, TESTING_GUIDE.md, CODE_STYLE.md, TURN_FLOW_DIAGRAM.mmd, how-the-board-is-drawn.md, how-the-prototypes-draw-the-board.md
- **docs/user/:** USER_MANUAL.md, RELEASE_NOTES.md, bug_report.docx
- **docs/archive/:** Historical milestones only (read-only)

### **ENFORCEMENT RULES (Critical)**

**🚨 DO NOT create new documentation files without:**
1. ✅ Checking the table above first
2. ✅ Verifying no existing file covers the topic
3. ✅ Getting user approval for new files
4. ✅ If creating new file, delete/consolidate an old one (zero-sum game)

**📝 When documenting work:**
- **Session work** → CHANGELOG.md (NOT new archive files)
- **Architecture decisions** → Update ARCHITECTURE.md (NOT new planning docs)
- **API changes** → Update API_REFERENCE.md (NOT new component docs)
- **User features** → Update RELEASE_NOTES.md (NOT new UI docs)

**❌ NEVER create files like:**
- `SESSION_SUMMARY-20251209.md` → Put in CHANGELOG.md
- `NEW_FEATURE_PLAN-20251209.md` → Put in TODO.md or CHANGELOG.md
- `COMPONENT_GUIDE-20251209.md` → Update API_REFERENCE.md

**✅ This structure is final. Keep it this way.**

### **When to Create New Documents**

**ONLY create new documents when:**
- ✅ Introducing entirely new systems requiring dedicated guides
- ✅ Major architectural redesigns needing separate planning docs
- ✅ New user-facing features requiring tutorial/walkthrough
- ✅ Creating reference documentation for new subsystems

**DO NOT create new documents for:**
- ❌ Regular feature implementations (use CHANGELOG)
- ❌ Bug fixes (use CHANGELOG)
- ❌ Session summaries (information belongs in CHANGELOG)
- ❌ Incremental improvements (use appropriate existing docs)

### **Archive Folder (`docs/archive/`)**

The archive folder is for:
- **Historical reference only**: Completed roadmaps, old plans, deprecated approaches
- **Major milestones**: Final reports marking completion of large initiatives
- **Not for**: Regular session notes, incremental changes, or ongoing work

**Before creating an archive document**, ask:
- Is this information better suited for CHANGELOG or release notes?
- Will this be the definitive reference, or just a snapshot in time?
- Does this document a completed major initiative (not just a session)?

### **Example: shipping a feature**

For a typical feature ship (e.g. v2.49.0 logic-tree movement restored):
- ✅ `CHANGELOG.md` — technical details, files changed, test results
- ✅ `docs/user/RELEASE_NOTES.md` — user-facing summary
- ❌ Don't create `LOGIC_MOVEMENT_RESTORED-2026XXXX.md` in archive

CHANGELOG + Release Notes = sufficient documentation for incremental work. Archive is for major-initiative wrap-ups only.

---

## 🎯 **MISSION & RESPONSIBILITIES**

**Status:** Game Alpha (Unravel Codes: The Game) is in **BETA** phase (April 2026), live in production at `https://game.unravelcodes.com`. Workstream 6 (engine-data separation) closed Apr 29, 2026 in v2.58.0.

Your mission is to maintain and enhance Game Alpha, a fully functional multi-player board game with modern service-oriented architecture, dependency injection, and a Ghost Player regression gate.

**Current Focus:** Voice rewrite merge (`docs/core/AUTHORED_COPY_REVIEW.md`), story-narrative authoring rollout, and the two remaining Beta workstreams blocking v3.0.0 (Living Map + Live Dictionary). See `TODO.md` for active priorities and `BETA_PLAN_V3.md` for strategy.

### **Core Responsibilities:**
- Maintain production system stability and test coverage
- Implement features as prioritized in `TODO.md`
- Fix bugs and address user-reported issues
- Optimize performance and user experience
- **Follow documentation structure** - update existing docs, don't create new ones

### **Code Quality Standards:**
- **All code:** TypeScript with strict type checking. `npm run typecheck` must return 0 errors.
- **Testing:** All 23 batches in `./tests/scripts/run-tests-batch-fixed.sh` must be green. Ghost Player strict + try-again-happy variants both pass.
- **Components:** Single responsibility. No line-count budget — split when a specific method becomes painful, not on size alone (see [BETA_PLAN_V3.md Workstream 4](./BETA_PLAN_V3.md) for the dropped-line-budget rationale).
- **Services:** Same — large stable services (TurnService 2,076, StateService 1,867) are accepted as cohesive. Setter injection only for the two documented real cycles.
- **Architecture:** Follow established patterns (see ARCHITECTURE.md). New per-space behavior should live in Spaces.csv flags, not hardcoded space-ID checks (Workstream 6 invariant).

### **Before Committing:**
1. ✅ Run relevant test batches (`./tests/scripts/run-tests-batch-fixed.sh`)
2. ✅ Verify TypeScript compilation (`npm run typecheck`)
3. ✅ Update appropriate documentation (see matrix above)
4. ✅ Follow commit message conventions

---

## 📚 **REFERENCE DOCUMENTATION**

For detailed information, refer to these consolidated documents:

**Architecture & Code:**
- **[ARCHITECTURE.md](../technical/ARCHITECTURE.md)** - System design, services, patterns, effect engine
- **[API_REFERENCE.md](../technical/API_REFERENCE.md)** - Component/service APIs, movement system
- **[CODE_STYLE.md](../technical/CODE_STYLE.md)** - TypeScript standards, patterns, conventions
- **[TESTING_GUIDE.md](../technical/TESTING_GUIDE.md)** - Test strategy, requirements, patterns

**Project Management:**
- **[TODO.md](../../TODO.md)** - Current tasks, priorities, completed work
- **[CHANGELOG.md](../../CHANGELOG.md)** - Complete technical history
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Current health and metrics

**User Documentation:**
- **[USER_MANUAL.md](../user/USER_MANUAL.md)** - Gameplay guide
- **[RELEASE_NOTES.md](../user/RELEASE_NOTES.md)** - User-facing changes

**Historical Reference:**
- **[docs/archive/](../archive/)** - Major milestones and design decisions

---

**Remember:** Game Alpha is production-ready. Focus on maintaining quality, stability, and user experience. Update existing docs - don't create new ones. Follow the documentation matrix above.

---

## 🎮 **UAT PLAYTESTING GUIDELINES** (January 31, 2026)

### **Efficient Playtesting Approach**
When conducting User Acceptance Testing via browser automation:

1. **Play First, Debug Later**: Complete the game flow before deep-diving into bugs
2. **Document Briefly**: Note bugs with 1-2 sentences, don't investigate code immediately
3. **Test All Features**: Explicitly test E cards, dictionary links, negotiations, Try Again
4. **Use a Checklist**: Cover all game mechanics systematically

### **Playtest Checklist**
- [ ] Complete a full game from OWNER to FINISH
- [ ] Play at least one E card (Expeditor)
- [ ] Click dictionary links to test integration
- [ ] Use Try Again feature at least once
- [ ] Test card replacement when prompted
- [ ] Observe all notification messages for clarity
- [ ] Test movement choice UI on multi-destination spaces

### **Bug Documentation Format**
```
| Severity | Location | Issue | Reproduction Steps |
|----------|----------|-------|-------------------|
| Critical/Minor | Space/Component | Brief description | How to trigger |
```

### **When to Fix vs Document**
- **Fix immediately**: Game-blocking bugs (can't continue playing)
- **Document only**: UX issues, text errors, cosmetic bugs
- **Workaround**: If possible, use Try Again or console to continue testing

---

**Last Updated:** April 30, 2026
**Charter Version:** 3.5 (Beta-live + Workstream 6 close-out)
