
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

**Status**: Beta (v3.0.39, late-May 2026) — live in production at `https://game.unravelcodes.com`. Workstreams 3 (Living Map), 5 (Live Dictionary), 6 (engine-data separation), 7 (Plan Approval Mechanic) all closed; v3.0.0 shipped 2026-05-23. Current focus is playtest-driven UX polish + bug-fix blocks (CHANGELOG is the per-version log). TODO.md has the prioritized backlog.

**Directory Structure:**
```
Game_Alpha/
├── src/                          # Application source code
│   ├── components/              # React UI (board, modals, player, editor, setup, layout)
│   ├── services/                # 29 services (DI, see ARCHITECTURE.md)
│   ├── types/                   # TypeScript interfaces and contracts
│   ├── utils/                   # Pure utility functions
│   ├── context/                 # React context providers (ServiceProvider)
│   └── styles/                  # CSS variables, animations, theme
├── tests/                        # 115 test files (run via vitest sweep)
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

> `scripts/` (utility scripts, run via `node scripts/<name>.mjs`):
> - `set-narrative.mjs` — write per-action narratives into SPACE_EFFECTS.csv
> - `regen-clean-files.mjs` — re-run the pipeline to refresh CLEAN_FILES from SOURCE_FILES
> - `merge-voice-rewrite.mjs` — voice-rewrite doc parser (Pass 2 / ModalConfig.csv work)
> - `seed-board-positions.mjs` — board coordinate seeding (Workstream 3 prep)

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
# Deploy — run from a regular Windows terminal (PowerShell / cmd).
# The `unraid` SSH host alias is in Windows ssh config; it is NOT in WSL
# by default. Either run these from Windows, or replicate the alias to
# WSL's ~/.ssh/config first.
ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"

# Check status
ssh unraid "docker ps | grep game_alpha"
ssh unraid "docker logs --tail 20 game_alpha"

# Restart without rebuild
ssh unraid "docker restart game_alpha"
```

> Tip: never re-run deploy on the user's behalf via Bash from WSL — produce the command for them to paste. They run it.

> **`deploy.sh` builds from committed+pushed code only** (it `git pull`s, then builds). A fix sitting uncommitted in the working tree will NOT ship — the build silently rebuilds the last commit's version. Before handing over the deploy command, `git status -sb`; if there are uncommitted fix files (or the branch is `ahead`), commit + push FIRST. After deploy, confirm the build log's `Version:` / `unravel-codes@X.Y.Z` line matches the intended version. (Bit us in v3.0.33 — first deploy rebuilt v3.0.32 because the fix wasn't committed.)

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

**Status:** Game Alpha (Unravel Codes: The Game) is in **BETA**, live in production at `https://game.unravelcodes.com`. All four major workstreams (3 Living Map, 5 Live Dictionary, 6 engine-data separation, 7 Plan Approval Mechanic) closed by mid-May 2026. v3.0.0 shipped 2026-05-23; current line is v3.0.39+.

Your mission is to maintain and enhance Game Alpha, a fully functional multi-player board game with modern service-oriented architecture, dependency injection, and a Ghost Player regression gate.

**Current Focus:** Playtest-driven UX polish + bug-fix blocks (e.g. v3.0.34–39 was the "Life Event richer effects" / Try-Again rollback / DiceResultModal duplication / quick-wins block). Story narrative authoring (5/~75 rows done) and voice rewrite Pass 2 (ModalConfig.csv copy) remain as creator-driven content workstreams. See `TODO.md` for active priorities and `BETA_PLAN_V3.md` for strategy.

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
- **Services:** Same — large stable services (TurnService ~2,100, StateService ~1,890) are accepted as cohesive. Setter injection only for the two documented real cycles.
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

## 🧭 **TACTICAL PATTERNS (Session Learnings)**

Compact field notes accumulated from real sessions. Read these BEFORE doing the
matching kind of work — each pattern saved a real chunk of guess-and-check.

### Parallel-systems audit before extending state, log, or movement rules (v3.0.62–v3.0.64, 2026-06-04)

Three sequential bugs in two days surfaced the same architectural shape: two systems answer the same conceptual question, a new rule lands in one, the other goes stale, drift breaks something. v3.0.61's FINAL-REVIEW gate fix patched `MovementService.getValidMoves` but not `MovementExecutor.executeMovement` dice path → v3.0.61 still crashed on end-turn → v3.0.62 patched the dice path. v3.0.62's Try Again worked on state (`discardTempState`) but not log (`globalActionLog` entries committed at end-of-turn anyway) → ghost log entries in post-game viewer → v3.0.63 added `discardCurrentSession` symmetric to `discardTempState`. v3.0.63 retrospective spotted ActionCenterPanel re-deriving `GameRulesService.canEndTurn` line-for-line → v3.0.64 dropped the duplicate.

**Pattern:** before extending ANY of these subsystems — state lifecycle (`TEMP/REAL`), logging (sessions/`isCommitted`), movement (`getValidMoves` + `getDiceDestination` + `validateMove`), turn gating (`canEndTurn`) — grep for parallel consumers FIRST. If the same conceptual rule exists in two functions/components, you must update both or surface the drift as a known limitation.

**Diagnostic greps:**
- Movement rule: `Grep "getValidMoves\|getDiceDestination\|validateMove"` — three call sites today, must all agree on destination after gate/path-memory/resume-hub overrides.
- Logging rule: `Grep "isCommitted\|globalActionLog\.filter"` — display layers diverge on filter rules (PlayerLogSection filters isCommitted; PostGameLogViewer doesn't).
- Turn gate: `Grep "canEndTurn\|requiredActions.*completedActionCount"` — service has canonical impl, components and TurnService.endTurnWithMovement each have their own counter check.
- Visit type: `Grep "player\.visitType\|hasPlayerVisitedSpace"` — stored field vs. recomputed from `visitedSpaces.includes`. MovementService.validateMove recomputes; everyone else trusts the field.

**Open structural debts** in TODO under "Parallel-systems audit":
- ✅ (1) merge `getValidMoves`/`getDiceDestination` → **DONE v3.0.66 Phase 2.1** (one resolver, optional `{ diceRoll }` narrows base before override stack).
- ⏳ (2) unify state TEMP/REAL with log sessions into one `TurnTransaction` → **Phase 2.2 queued**.
- ✅ (3) lift log filter to shared helper → **DONE v3.0.65 Phase 1.2** (`getDisplayableLogEntries` in `src/utils/logFiltering.ts`, consumed by PlayerLogSection + GameLog + PostGameLogViewer; canonical `isCommitted && visibility === 'player'`).
- ✅ (4) visitType stored-vs-computed → **AUDITED + CLOSED v3.0.65 Phase 1.1** — the "parallel system" framing was **wrong**: `hasPlayerVisitedSpace(destinationSpace)` answers a different question than `player.visitType` (destination's prior-visit status vs current space's visit type). No parallel system to delete. Pinned a small data invariant instead via `tests/services/MovementService-visitTypeInvariant.test.ts`.
- ⏳ (5) notification + logging event bus, (6) money/moneySources denormalization, (7) three effect pipelines under one `EffectExecutor` — all deferred (lower priority + higher risk surface, per TODO's own notes).

**Symptom map** — when you see these, suspect a parallel-systems gap:
- "Button enabled but click throws" or "button disabled but everything's ready" → `canEndTurn` divergence.
- Log shows actions that didn't happen / state shows different total than log narrates → state/log split.
- Crash with `"Invalid move: X is not a valid destination"` → getValidMoves vs getDiceDestination drift.
- "First" visit behavior on a Subsequent visit (or vice versa) → visitType drift.

### Audit-before-refactor — verify the "parallel system" actually exists (v3.0.65 Phase 1.1, 2026-06-04)

When a TODO frames structural debt as "two systems doing the same conceptual thing," **read the code carefully BEFORE deleting one of them.** The framing can be sloppy. Phase 1.1 was scoped as "delete `MovementService.hasPlayerVisitedSpace`, route `validateMove` through stored `player.visitType`." On inspection: `hasPlayerVisitedSpace(destinationSpace)` is computing visit type for the **destination** the player is moving to — `player.visitType` describes the **current** space. There is no parallel system; they answer different questions, and you can't substitute one for the other.

The audit (15 min) saved a code-golf cleanup that would have changed nothing meaningful. The honest residual concern was a small data integrity invariant — pinned by `tests/services/MovementService-visitTypeInvariant.test.ts` (5 cases: `visitedSpaces` non-empty + contains `currentSpace` + no duplicates + when `visitType='First'` last entry === currentSpace) — without touching production code. The TODO entry was updated to reflect the honest finding ("AUDITED + CLOSED — no actual parallel system; replaced with smaller invariant test").

**Rule:** before code-changing any TODO that says "merge X and Y," do a 5-min read of both code paths and answer: "Do these answer the same question, or different questions that happen to share underlying data?" Different-questions ≠ parallel system. The drift trap is real only when the same conceptual rule lives in two places.

**Signal to use this pattern:** the user's "audit before reducing X" rule (memory: `feedback_audit_before_cleanup.md`). When the TODO is yours to interpret (not user-prescribed), assume it might be wrong about the scope. When the user explicitly directed the work, the audit is still useful but the bar for declaring "TODO is wrong" is higher.

### Grep for ALL callers when refactoring a service boundary — dead code lurks (v3.0.66 Phase 2.1, 2026-06-04)

When refactoring a service method that's part of a "parallel systems" merge (e.g. unifying `MovementService.getDiceDestination` consumers under `getValidMoves({ diceRoll })`), grep across `src/` for EVERY caller before declaring scope. Phase 2.1 found three callers:
1. `MovementExecutor.executeMovement` — live, refactored to use the new API.
2. `MovementService.getValidMoves` itself — internal use, refactored.
3. **`PlayerActionService.handlePlayerMovement`** — dead! Its parent method `PlayerActionService.rollDice` had zero src callers (only `playCard` is invoked from `CardActions.tsx`). The actual UI calls `turnService.rollDiceWithFeedback` and `turnService.endTurnWithMovement` instead.

Verified `rollDice` was **superseded** (not just dropped) — `DiceRollProcessor.rollDiceWithFeedback` is the richer successor that decouples dice roll from movement (movement now deferred to END TURN via `MovementExecutor`). Old code was monolithic auto-move-on-roll; new architecture is roll → see consequences → take other actions → end turn → move. Better UX, and the v3.0.62 crash family lived in this newer architecture.

Cleanup deleted from `PlayerActionService.ts` (~185 lines), `IPlayerActionService` (2 method signatures), and `PlayerActionService.test.ts` (~250 lines, 2 `describe` blocks — kept the one test asserting `playCard` doesn't sneakily end the turn since that's still a meaningful behavior pin). Total: **~435 lines removed** in the same commit as Phase 2.1. The dead code was a third place that would have needed parallel-systems patches if it had a live caller.

**Rule:** when a service method has 2+ apparent callers, search for ALL of them with `Grep "<methodName>(" path=src`. Any caller whose parent function has zero src callers is dead code — delete it alongside the refactor rather than maintaining it in sync forever. Also check the caller is **superseded** vs just removed (look for a newer method that does the same work plus more) — if superseded, the dead code is a fossil; if removed, you might be deleting functionality that should be restored.

### `describe.skip` does NOT skip TypeScript validation — delete directly for dead-code (v3.0.66 Phase 2.1, 2026-06-04)

Tempting pattern when you want to delete a large block of tests but the Edit tool's single-string match is awkward for >100 line ranges: mark the block as `describe.skip('LEGACY — to be deleted')` and clean up later. **DO NOT DO THIS.** TypeScript still validates the body inside a skipped describe — calls to methods that no longer exist on the service will still fail typecheck. The tests don't run at runtime, but the file won't compile.

Fix: delete the block directly. For ranges too large for a single Edit, use a node fs one-liner:

```bash
node -e "const fs=require('fs');const t=fs.readFileSync(P,'utf8').split('\n');const a=t.findIndex(l=>l.includes('<start anchor>'));const b=t.findIndex(l=>l.includes('<end anchor>'));fs.writeFileSync(P,[...t.slice(0,a),...t.slice(b+1)].join('\n'))"
```

Find start/end anchor lines (often the opening `describe(...)` and the matching `});`), slice them out, write back. Faster than 5 sequential Edit calls and cleaner than `describe.skip`. Used in Phase 2.1 to delete the 267-line dead `rollDice` + `endTurn` test blocks in one shot.

### `regen-clean-files.mjs` is also a slip-through detector (v3.0.61, 2026-06-02)

If a previous fix edited a `CLEAN_FILES/*.csv` directly without carrying the change back to the matching `SOURCE_FILES/*.csv`, running `node scripts/regen-clean-files.mjs` will silently OVERWRITE the orphan edit. Whatever was in CLEAN-but-not-SOURCE disappears.

This bit us in v3.0.61: while doing a data-driven lift, the regen wiped v3.0.7's `{fundingAmount}` token at OWNER-FUND-INITIATION because commit `b9d85cb` had only touched CLEAN. The token would have silently vanished from the next deploy. Caught and fixed by adding the token to SOURCE.

**Rule:** EVERY edit to `CLEAN_FILES/*.csv` must be paired with the same edit (or its SOURCE equivalent) in `SOURCE_FILES/*.csv`. If you find yourself reaching for the CLEAN file because the SOURCE pipeline doesn't yet support the change, fix the pipeline first.

**Diagnostic:** before any session that's likely to touch CSV data, run regen first and check `git diff public/data/CLEAN_FILES/`. Anything that comes back is an orphan CLEAN edit that needs reconciling. Same applies whenever you've done a SOURCE/processGameData/pipeline change — regen then diff to confirm only intended things changed.

**Bonus diagnostic from this session:** after fixing v3.0.7's token, also grep `git log --pretty=format:"%h %s" -- public/data/CLEAN_FILES/SPACE_CONTENT.csv` and check whether any other commits touched ONLY CLEAN_FILES (no paired SOURCE_FILES change). v3.0.61's regen audit found just the one (b9d85cb); the rest of the history was clean.

### Wiring an existing service into the ghost bot can expose dead production code (v3.0.61, 2026-06-02)

TODO L64 was framed as a tiny test-infra change: wire `ApprovalService` into `tests/ghost/bootstrapServices.ts` so the regression bot exercises Workstream 7. First run: 15 hard failures all at `REG-DOB-FINAL-REVIEW` with `Invalid move: REG-DOB-PLAN-EXAM is not a valid destination`. Not a bot bug — a REAL production crash that nobody had hit yet because production play rarely reached FINAL-REVIEW without DOB approval (the gate's "missing-approval" branch was dead code in normal flow). Players hitting it via W-card scope revoke or L-card `revokes_approval` would have crashed.

**Pattern:** wiring an unused service into the ghost is NOT just test-infra cleanup. The ghost makes random choices and reaches edge-condition state that organic playtest never explores. Code paths that look "obviously dead in practice" can be live for the bot. Be ready for the wire-up to surface a real bug.

**Reverse-applies:** if a unit test passes but the same code path crashes under the ghost, the bug is almost certainly in a SIBLING service the unit test mocked but the ghost wires for real. Trace the route the bot took (the trail strings in the failure summary) to find the actual seam.

**Fix shape used in v3.0.61:** the gate logic in ApprovalService correctly returned `{passed: false, routeTo: 'REG-DOB-PLAN-EXAM'}` and DiceRollProcessor correctly set `moveIntent` to it. The miss was MovementService.getValidMoves never knowing about the gate-bounce destination, so downstream validateMove rejected the move. Added a 6-line block to getValidMoves that consults `dataService.hasFinalReviewGate(currentSpace)` + `approvalService.checkFinalReviewGate(player)` and collapses validMoves to `[gate.routeTo]` when the gate fails. Data-driven via a new `has_final_review_gate` CSV column on GAME_CONFIG.

### Bump `package.json` when releasing — UI version label reads it at build time (v3.0.51→v3.0.55 incident, 2026-06-02)

User reported deployed game showed `v3.0.51 · 35f3573 ⚠ 10 behind` after multiple "v3.0.55" commits had supposedly shipped. Two stacked causes diagnosed via `git log` + `vite.config.ts:13`:

1. **`package.json` version was never bumped** across the v3.0.52–55 sprint. The UI label `vX.Y.Z` reads from `pkg.version` at vite build time ([vite.config.ts:13](../../vite.config.ts#L13) → `__APP_VERSION__` define). Commit messages saying "v3.0.55 — ..." do not change `pkg.version`.
2. **Docker image was still built from `35f3573`** because the deploy run that brought v3.0.52–55 commits down to Unraid never actually rebuilt against the newer HEAD (probably an earlier failed/partial deploy).

Fix: bumped `package.json` (and the two `version` entries in `package-lock.json`: top-level + `packages."".version`), committed, pushed, re-ran `deploy.sh` on Unraid. Header now reads `v3.0.55 · 2b99a30`, no "N behind".

**Rule:** every release commit MUST bump `package.json`. Treat `version: "X.Y.Z"` as part of the release atomically — bump it in the same commit that ships the version-tagged work, OR in a dedicated `chore: bump package version to X.Y.Z` commit immediately before deploy. Three places:
- `package.json` → `"version": "X.Y.Z"`
- `package-lock.json` → top-level `"version": "X.Y.Z"`
- `package-lock.json` → `"packages": { "": { "version": "X.Y.Z" } }`

**Diagnostic:** if the live UI version doesn't match what you intended to ship, check `grep version package.json` BEFORE blaming the deploy. The "⚠ N behind" indicator means the deployed commit is N commits behind HEAD — but a stuck version number means `package.json` is the deeper miss, even after a clean deploy.

### Pin LF line endings via `.gitattributes` on Windows-edited repos (2026-06-02)

This project's working tree lives on a Windows D: drive (`D:\Unravel\Current_Game\Game_Alpha`). Without `.gitattributes` or `core.autocrlf`, Windows tools repeatedly flipped LF→CRLF on edit/save, producing massive phantom diffs that masked real changes. On 2026-06-02, `git status` was showing 44 modified files with ~30,727 insertions / 30,683 deletions — and `git diff --ignore-cr-at-eol` revealed **zero real content changes**.

Fix: added [`.gitattributes`](../../.gitattributes) with `* text=auto eol=lf` (plus explicit `binary` lines for images/fonts/PDFs), set `git config core.autocrlf input` locally, and `git restore`-d the 44 churned files. Worktree went clean. Future Windows-side edits will normalize on commit.

**Rule:** if `git status` shows huge modification counts on files you haven't touched, FIRST run `git diff --ignore-cr-at-eol --stat` to confirm whether it's CRLF noise. If yes, don't `git add -A` it — that adds a giant noise commit. Restore the files (`git restore` on names from `git diff --name-only`), then add `.gitattributes` if missing.

The `.gitattributes` is now committed (`2211b5f`), so this shouldn't recur. But: when cloning fresh on a new Windows machine, run `git config core.autocrlf input` in the local repo to belt-and-suspenders the policy.

### Push BEFORE handing the user a deploy command (v3.0.44/45 process incident, 2026-05-31)

The Unraid deploy script runs `git pull` first. If commits are local-only, the deploy pulls nothing new, builds the stale bundle, and the user sees no change in the browser even after Ctrl+Shift+R. This wasted ~30 min on 2026-05-31 — user reported "no v3.0.44 strings showing" because both commits were sitting on local master, never pushed.

**Rule:** when you commit a version intended for deploy, push in the same motion. `git commit ... && git push origin master`. Treat commit-without-push as half-done. Don't say "ready to deploy, here's the ssh command" until `git log origin/master..master` returns empty.

Diagnostic: if user reports a deploy didn't produce expected behavior, FIRST run `git log origin/master..master --oneline` to check for unpushed commits. Header banner shows `v X.Y.Z · <commit>` — if commit hash there isn't your latest local commit, push is missing.

### `sessionStorage` in `useState` initializer = white-screen risk (v3.0.49 crash → v3.0.51 hotfix)

```ts
// ❌ unsafe — Comet, private mode, sandboxed webviews can throw SecurityError
const [x, setX] = useState(() => sessionStorage.getItem(key) !== 'yes');
```

A throw inside `useState`'s initializer crashes the WHOLE component tree on mount. White-screen on phone-join. Same risk for `localStorage`, `cookies` access, anything that can throw under privacy/sandbox constraints. v3.0.49 shipped this exact bug on the haptic-prime gate; v3.0.51 wrapped all access in `safeSessionGet/safeSessionSet` (try/catch returning sensible defaults).

**Rule:** any browser-storage access inside a hook initializer or a render function MUST be wrapped in try/catch. The fallback should let the component render normally — at worst the feature degrades (state doesn't persist), but the page loads.

Also applies to: `navigator.vibrate()` (best-effort, never block on it), `window.matchMedia()` in some contexts, `performance.*` in sandboxed iframes.

### Live UX-bug capture via chrome-devtools MCP — for "cryptic string" feedback

When a feedback report names a player-facing string that's "wrong" but you can't easily grep for it (the report's exact string may no longer exist in code, or there are 6 producers and you need to know which fired), don't guess. Navigate the live deployed game via chrome-devtools MCP and pull the actual log via the game's own API:

```js
// from chrome-devtools__evaluate_script after navigate
const url = new URL(window.location.href);
const r = await fetch(`/api/games/${url.searchParams.get('g')}/state?token=${url.searchParams.get('token')}`);
const j = await r.json();
return j.state?.globalActionLog || [];
```

This caught 6 cryptic log strings + 2 unrelated dupes in v3.0.44 that grep alone would have missed. The producers fired with `OWNER-SCOPE-INITIATION` instead of `Scope Initiation`; without the live snapshot I'd have either over-fixed (every producer that uses spaceName) or under-fixed (only the one I happened to grep).

**Rule:** if the bug is "what the user sees in the app right now", the source of truth is the running app, not the source code. MCP makes this cheap — under 30s to a real inventory.

### Multiple log producers per one event — grep the format, not just the literal

v3.0.44 fixed `EffectFactory.createEffectsFromDiceRoll`'s "Player 1 rolled N at <space>" log. Playtest showed the dice-roll log was STILL appearing in old format on some spaces — `SpaceArrivalProcessor.ts:104` was a SECOND producer writing the same conceptual event with its own format string (`🎲 Player 1 rolled ${diceRoll} at ${spaceName}`). Same on card draws (v3.0.47 dedupe): `CardEffectHandler.handleCardDraw` wrote the log TWICE — once via `logCardDraw()` direct call AND once via a `resultingEffects: [LOG]` block routed through `EffectEngineService`.

**Rule:** when fixing a log producer, grep for the message *format* (`rolled.*at|Drew.*Work Packages|entered space`) across `src/`, not just the literal string you found. There will often be 2-3 producers per "event" (one from the orchestrator, one from the effect engine, one from a notification helper). Verify after fix by walking the live game one turn and checking the log entry count vs. expected event count.

> **Also consult the `mcp__memory` knowledge graph** for cross-session patterns.
> Seeded 2026-05-12 with entities: `Unravel Codes`, `Voice rule override chain`,
> `SPACE_EFFECTS.csv schema`, `Deploy verification pattern`,
> `React Flow custom node data injection`, `Stale game-id URL 404 pattern`,
> plus a per-session `Session YYYY-MM-DD (vX.Y.Z)` log.
> Search with `mcp__memory__search_nodes` — entity names are short and descriptive.
> At session end, write new patterns and ship logs to keep the graph current.
> This is the manual equivalent of Anthropic's "dreaming" feature
> (Managed Agents only as of 2026-05-06); the goal is the same:
> turn one session's hard-won discovery into a future session's first hit.

### Life Event (L) card effects — `onlyResourceEffects` filter now covers all 5 deferred slices (v3.0.39)

Auto-drawn life events (space-arrival dice-conditional `draw_L`, or `handleCardDraw`) historically NEVER applied their effects — fixed v3.0.37 with `applyCardEffects(playerId, cardId, { onlyResourceEffects: true })` at both draw sites. The filter was widened in v3.0.39 to cover all 5 originally-deferred slices ("Kids A–E"):

- **Kid A (approval-revoke)**: dropped the `!options?.onlyResourceEffects` gate at [CardService.ts:1121](src/services/CardService.ts#L1121). Safe because v3.0.39 chunk-3 routes approval writes through TEMP (Try-Again rollback-aware).
- **Kid B (free E-card draws)**: filter allows `CARD_DRAW(E)` (L005/L007/L010). Auto-draw handler doesn't apply effects on E cards → no recursion.
- **Kid C (multi-turn duration L002/L004/L008)**: parser/engine **N×N over-stack** bug fixed — see separate TACTICAL entry below.
- **Kid D (dice-conditional L009)**: new `diceRoll?: number` option on `applyCardEffects`. When `card_mechanic='dice_conditional'` AND diceRoll provided, the card's `tick_modifier` is patched to the range-matched value via the `dice_range_*` columns BEFORE `parseCardIntoEffects` runs (which is dice-range-unaware). SpaceArrivalProcessor passes diceRoll; CardEffectHandler doesn't (unconditional path still skips dice-conditional cards).
- **Kid E (forced discard L003/L048)**: filter allows `CARD_DISCARD`; new public `CardEffectHandler.autoPickForcedDiscards` flag — production keeps the per-player choice modal (`requiresUserChoice`), but headless ghost bot ([tests/ghost/bootstrapServices.ts](tests/ghost/bootstrapServices.ts)) sets it to true and the handler auto-picks oldest cards via the existing slice fallback. **This is the original deadlock landmine** — two prior attempts hung the ghost gate. The Option-2 split (modal for humans, auto-pick for bot) is the right model for any "forced choice" effect a headless test needs to traverse.

**The trap still stands** for any *future* effect that fans out a `requiresUserChoice` modal: don't run it inline in the arrival path without the bot-bypass equivalent. The v3.0.39 ghost gate ran 50 games clean (zero hard failures, 14m12s) which empirically validated the autoPickForcedDiscards approach.

### Global+duration card fan-out — parser-vs-engine N×N over-stack (v3.0.39 Kid C fix)

Latent bug since the original CARD_DRAW/CARD_DISCARD global-fan-out (L049 v3.0.14, L003/L048 v3.0.17): cards with both `scope=Global` AND `duration=Turns` produce N² applications per player because both layers fan-out and they don't coordinate.

**The seam:** `CardService.parseCardIntoEffects` fans out per player (one RESOURCE_CHANGE/CARD_DRAW/CARD_DISCARD per `gameState.players`). Then `EffectEngineService.processCardEffects` reads `cardData.target` and `cardData.duration_count`:
- Non-duration path → `processEffectsWithTargeting` → for each `targetPlayerId`, `effects.map(cloneEffectWithNewPlayerId)` re-targets each effect to that player. So N pre-fanned effects × N targets = N² effects per player.
- Duration path → similar inner loop, same N² shape, plus stored as `activeEffects` so the over-stack fires every turn for N turns.

L002 ("All filing times +2 for next 3 turns") in a 3-player game would queue 3 active effects per player × 3 turns × +2 = each player loses 18 days instead of 6.

**Fix shape (Kid C):**
- For `scope=Global` + `duration=Turns`: parser emits ONE effect (source player), and the engine's targetRule loop fans it out per player. Single source of fan-out.
- For `scope=Global` + immediate (no duration, e.g. L008, L049, L003): parser keeps the per-player fan-out at parse time (so phase-filter at parser level can use each player's *current* phase), AND `CardService.applyCardEffects` overrides `effectiveCard.target = 'Self'` on the auto-life-event path so `processEffectsWithTargeting` takes its fast-path (line 1106-1108: target='Self' → `processEffects` directly, no re-clone). Single source of fan-out again.

**Audit pattern when adding a new global-fan-out path:** check whether the engine will also fan via `targetRule`. If yes, either suppress one layer (single source) or route via the engine only (cleanest for duration; trickier for phase-filtered immediate). The N×N is silent — unit tests that only check `parseCardIntoEffects` mock output will pass while production over-stacks. The Kid C tests in [CardService.test.ts](tests/services/CardService.test.ts) now assert effect count + target rule for both shapes.

**Deferred:** phase-filtered duration cards (L004 affected_phase=CONSTRUCTION) need apply-time re-evaluation of the phase filter (a player's phase changes between turns). Currently the filter is parser-only and gets bypassed by the Kid C single-emit. Follow-up — needs a phase-aware `applyActiveEffects` branch.

### Try-Again rollback for any new player-state field (v3.0.39 chunk 3 pattern)

When you add a player-state field that's mutated mid-turn and the player expects Try-Again to roll it back (the v3.0.39 case was approval state: `dobApprovalStatus` / `fdnyApprovalStatus` / `dobApprovedDestinations` / `fdnyApprovedDestinations`), the recipe is:

1. **Add the field to `MutablePlayerState`** in [StateTypes.ts](src/types/StateTypes.ts) (the union types are open-bag, just append).
2. **Update `TurnStateManager.extractMutableState`** ([TurnStateManager.ts](src/services/TurnStateManager.ts)) to capture the field into the snapshot — careful with array/object copies (`[...value]` / `{...value}`) so the snapshot doesn't share reference with the live player.
3. **Update `TurnStateManager.applyToRealState`** with a per-field copy line. Comment notes when a `'none'`/`[]` value is legitimate (so a `!== undefined` guard reads correctly).
4. **Update `StateService.discardTempState`** restore block at line ~1438 — add the field to the `updatePlayer` payload so Try-Again writes the snapshot value back to live state.
5. **Route the write site through `updateTempState`** instead of `updatePlayer`. The `updatePlayer` path is direct REAL-state write; `updateTempState` writes to the TEMP snapshot AND mirrors to main state for UI feedback, so on Try-Again the mirror gets reverted from REAL.

The `commitTempToReal` flow (`StateService.ts:1379` → spreads `committedState` over the player) automatically picks up new MutablePlayerState fields — no change needed there.

**Why this pattern is reusable:** the same 5-step recipe will work for any new approval-like field (e.g. future per-player permits, escrow accounts, regulator-specific flags). The TEMP/REAL model is the rollback engine; MutablePlayerState is its config; the 5 steps wire a new field in.

**Critically, the 3-write-sites-via-`updateTempState` step is the easy thing to forget** — if a future caller does `updatePlayer({ id, dobApprovalStatus: 'denied' })`, Try-Again won't restore it because that path bypasses TEMP entirely. Grep for `updatePlayer(.*<field>` periodically.

### Ghost gate — slow, and a hang swallows its own timeout

`tests/ghost/ghostPlayer.test.ts` is the bot regression gate (strict 50 + try-again 50 + space-coverage). Field notes:
- **It's slow:** ~15–20 min for 50 games, ~27 min for the full 3-test gate. A *synchronous* hang blocks the event loop, so vitest's per-test timeout never fires — the run only stops when your wrapper `timeout` kills it (looks like a deadlock; verify the wrapper value first — 16 games need ~290s, 50 need 20+ min, so capping too short masquerades as a hang).
- **Don't debug against it.** Reason about safety-by-construction + run a tiny `runGhostBatch(4–8)` spot-check; run the full gate ONCE at the end. vitest swallows `console.log` on pass — write diagnostics to a file via `appendFileSync` to capture numbers.
- **Win-rate floor is the SECONDARY gate; "0 hard failures" (EXCEPTION/INVARIANT) is primary.** The strict floor was recalibrated 45→36 (v3.0.37) after correctness fixes (life events applying + v3.0.35 construction-cost/loan charges) made the economy correctly harder → the random bot wins less (clean 45/50 → with life events 39/50, 0 hard failures). Recalibrate the floor consciously when a correctness fix shifts the deterministic count; don't chase the old number.

### Live verification by cheating state (skip the RNG grind)

To verify a deep-game fix without playing ~30 turns through RNG approval loops: `GET /api/games/:id/state?token=` → mutate the returned `state` (e.g. `players[0].currentSpace`, `visitType`, `dobApprovalStatus`/`fdnyApprovalStatus`, clear `moveIntent`, or set `isGameOver`+`winner` for the end screen) → `POST /api/games/:id/state` with body `{ state, clientVersion }` and the `x-game-token` header → reload the browser to pull it. Schema validation is lenient (needs `players[]`, `gamePhase`, `currentPlayerId`, `gameRound`, `isGameOver`, and per-player `id/name/money`). Used in v3.0.35/37 to jump to CON-INITIATION and FINISH and confirm construction-cost recording + end-game stats live.

### Voice rule — where to override game-language

Players keep reporting leftover "Roll for W Cards" / "Draw 3 E cards" / "Cards"
language. Fix at the **formatter** layer, NOT in CSVs. The CSV `description`
columns are auto-generated as game-language by the pipeline; rewriting them
will regenerate. The override chain:

| Player-visible string | Source | Override at |
|---|---|---|
| Manual card-action button label ("Get Bank Loan") | `formatManualEffectButton` card branch | `src/utils/buttonFormatting.ts` |
| Manual **dice** action button label ("Get Work Packages") | `formatManualEffectButton` dice branch — maps `effect_value` ("W Cards", "Fees Paid", "Time outcomes", "Quality", "Multiplier", "Next Step") → DICE_BUTTON constants | `src/utils/buttonFormatting.ts` |
| Contextual dice button on movement spaces | `formatDiceRollButton` | `src/utils/buttonFormatting.ts` |
| All dice button strings (single source) | `DICE_BUTTON` object | `src/constants/uiStrings.ts` |
| **Canonical card-type name accessor** (single source of truth) | `getCardTypeName(type, count?)` | `src/utils/cardTypeNames.ts` |
| Underlying labels the helper reads | `colors.game.cardTypes[X].label` | `src/styles/theme.ts` |
| Dice result modal card chips / formattedValue | Uses canonical `getCardTypeName` (no local map) | `src/components/modals/DiceResultModal.tsx` |
| Dice result modal secondary `effect.description` ("Took on 3 Work Packages", "Repaid 2 Bank Loans") | `describeCardAction(action, cardType, count)` — per-type verb table × W/B/E/I/L | `src/services/DiceService.ts` (called from `DiceRollProcessor.ts`) |
| Outcome banner strings ("Got 3 Work Packages") | `formatDiceRollFeedback` / `formatActionFeedback` (both import canonical helper) | `src/utils/buttonFormatting.ts` |
| Tooltip-why / tooltip-context strings on action buttons | `tooltip_why` / `tooltip_context` columns | `public/data/CLEAN_FILES/ACTION_TOOLTIPS.csv` (single source — no SOURCE_FILES counterpart) |
| In-flight verb ("🎲 Deciding…" not "🎲 Rolling…") | Inline string | `src/components/player/ActionCenterPanel.tsx` |

**Friendly card-type name canon** (use everywhere): W → "Work Package", B → "Bank Loan", E → "Expeditor", I → "Investment", L → "Life Event". Never surface the letter or the word "card" to players. As of v2.63.6 these all flow from one place (`theme.ts` labels → `getCardTypeName`); when adding a new place that names a card type, import the helper instead of inlining the string.

**Audit at all four leak surfaces** (v2.61.1 → v3.0.3 → v3.0.5 sweep history): when a "card(s)" report comes in, the leak is rarely in just one spot. Sweep ALL of:

1. **Pending-action button labels** — `ActionCenterPanel` (fixed v2.61.1) AND its four sister sections (`TimeSection`, `ProjectScopeSection`, `FinancesSection`, `EventsSection`). Each section had its own `getButtonLabel` helper still returning `effect.description` first. Fixed v3.0.3.
2. **Notifications + player log** — `CardEffectHandler.logCardDraw` / `notifyLifeEventDraw` / the CARD_DRAW LOG payload AND `NotificationUtils.createDiceRollNotification` / `createCardPlayNotification`. Toast notifications were showing raw letter codes ("2 W"). Fixed v3.0.5.
3. **NPC-specific modals** — `NegotiationModal` offer summary + per-type rows, `EducationalCardSelectionModal` empty state. Fixed v3.0.5.
4. **Dice-result summary VOICE** (separate from card-language content) — see "Speaker-aware dice-result summary" pattern below. Fixed v3.0.6.

Internal identifier names (`cardType`, `card_name`, `cardId`, etc.) stay — those are code. Only player-facing strings are in scope.

### Speaker-aware dice-result summary (v3.0.6)

`DiceService.generateEffectSummary(effects, diceValue, storyText?, spaceName?)`. When `spaceName` is supplied:

- **PM-voiced spaces** (5 specific names — `PM-DECISION-CHECK`, `CHEAT-BYPASS`, `ARCH-INITIATION`, `ENG-INITIATION`, `REG-DOB-TYPE-SELECT`) → first person: `"I gained efficiency."`
- **NPC-voiced spaces** (everything else with a known prefix) → attributed: `"The Owner: You took on 2 work packages."` / `"DOB Examiner: You faced delays."`
- **Unknown / missing `spaceName`** → falls back to legacy `"Good news! / Challenging turn. / Mixed results."` tone preamble (preserves pre-existing test API).

Two separate speaker maps coexist by design:

- `CHARACTER_MAP` in `src/constants/characters.ts` — 6 entries (OWNER, ARCH, ENG, REG-DOB, REG-FDNY, CON) — drives badge + portrait rendering, requires image roles.
- `NPC_SPEAKER_NAMES` in `src/services/DiceService.ts` — 10 entries adding BANK, INVESTOR, LEND, REG-DCP, FINISH — voice-only attribution, no images.

When adding a new NPC space prefix: update `NPC_SPEAKER_NAMES` (always) and `CHARACTER_MAP` + portrait images (only if you want a badge too). `extractPrefix()` in `characters.ts` handles the `REG-DOB` / `REG-FDNY` two-segment exception — any new multi-segment prefix needs the same handling.

`DiceRollProcessor.ts` forwards `currentPlayer.currentSpace` through both initial roll and reroll paths. If a future caller introduces a third dice path (e.g. card-triggered dice), it must forward `spaceName` or fall back to the tone preamble.

### Space-story `{fundingAmount}` token (v3.0.7)

`ActionCenterPanel`'s space-story render now passes through `interpolateTemplate` before `TextWithTerms`. The `{fundingAmount}` token resolves to `"$N"` (locale-formatted) from `player.moneySources` based on the space's `funding_source`:

- `funding_source === 'owner'` → `moneySources.ownerFunding`
- `funding_source === 'bank'` → `moneySources.bankLoans`
- `funding_source === 'investor'` → `moneySources.investmentDeals`

At non-funding spaces the token resolves to empty string (disappears). To extend: add new keys to the context object in `renderedSpaceStory` useMemo; CSV authors drop `{key}` wherever the NPC dialogue naturally references the value. v3.0.7 applied at `OWNER-FUND-INITIATION` First-visit; v3.0.39 added BANK-FUND-REVIEW Subsequent + INVESTOR-FUND-REVIEW Subsequent (running cumulative source total). First-visit BANK/INVESTOR copy intentionally skipped — amount is 0 before the player chooses to take the loan/investment. To adopt at Outcome-column copy, `spaceOutcome` would also need to be run through `interpolateTemplate` ([ActionCenterPanel.tsx](src/components/player/ActionCenterPanel.tsx)) — small follow-up.

### `window.error` handler scoping (v3.0.1)

`index.html` registers a `window.addEventListener('error', ...)` handler intended for module load failures. **Two gotchas, both fixed v3.0.1**:

1. The handler must distinguish resource load errors (`e.target` is an `HTMLElement` like a failed `<script>`/`<link>`/`<img>`) from runtime errors (`e.target === window`). Pre-fix, every runtime error — including benign Chromium warnings like `"ResizeObserver loop completed with undelivered notifications"` (fired by React Flow during drag/resize) — would hide `#root` and show the red fallback.
2. Resource load errors **do not bubble** — they fire on the failed element. To catch them on `window`, the listener must be registered in **capture phase**: `addEventListener('error', handler, true)`. The pre-fix bubble-phase listener almost certainly missed real module load failures it was supposed to catch.

### Action counter must include choice-movement (v3.0.4)

`StateService.calculateRequiredActions` counts dice + each manual SPACE_EFFECTS row. Pre-v3.0.4 it ignored choice-type movement, so at spaces like `PM-DECISION-CHECK` the End Turn tooltip said "1 action remaining" while two surfaces (a manual effect button + the destination prompt) were visible. `canEndTurn` already gated correctly on `player.moveIntent` — only the counter was lying.

Movement type checklist (from `MOVEMENT.csv`): `choice` (count +1), `dice` (already counted via the dice block), `fixed` / `logic` / `none` (no player input, don't count). If a future feature adds player input that's NOT a SPACE_EFFECTS manual row (e.g. card-selection prompt tracked via `awaitingChoice`), it'll need the same treatment.

### SPACE_EFFECTS.csv column schema (frequently misread)

```
space_name, visit_type, effect_type, effect_action, effect_value, condition, description, trigger_type, ...
```

Critically: for `effect_type === 'dice'` rows, `effect_value` is the **dice category** ("W Cards" / "I Cards" / "E cards" / "Fees Paid" / "Fee Paid" / "Time outcomes" / "Time" / "Quality" / "Multiplier" / "Next Step"). The `description` column is what leaks gamey text into the UI when a formatter falls through to it.

### React Flow custom-node data injection

Custom node components (`BoardNode` in `BoardCanvas.tsx`) only receive `data` as a prop. Parent state like hover/expand/edit-mode and callback closures **must be injected into each node's `.data` on every render** via a `useEffect` that maps over `nodes`. There is no parent-closure access from inside the custom node. The pattern:

```ts
useEffect(() => {
  setNodes(prev => prev.map(n => ({
    ...n,
    data: {
      ...n.data,
      isExpanded: expandedSpace === n.id,
      hoveredSpace,
      isEditMode: isAdmin,
      onHover: handleNodeHover,
      onClick: handleNodeClick,
    },
  })));
}, [hoveredSpace, expandedSpace, isAdmin, handleNodeHover, handleNodeClick, /* + dynamic data deps */]);
```

### Stale game-id from URL → 404 → redirect to lobby

**Caution: the naive version of this pattern was shipped in v2.63.3 and broke Start Game.** Reverted in v2.63.4. Don't re-implement without the discriminator below.

`?g=Gxxx&token=...` URLs persist across server restarts (bookmarks, leftover tabs). Server's in-memory game registry recycles. The intended pattern in `ServerSyncService.loadFromServer()` was: on 404 **with** a `gameId` in the URL, strip the game-scoped query params and `window.location.replace(…)` to the bare path.

**Why the naive version is broken:** `PlayerSetup.tsx:230` does `window.location.href = ?g=G_new` on Start Game — that's a full page reload. The new game has NOT synced to the server before the reload. Post-reload boot at `App.tsx:116` calls `loadFromServer()` for G_new, gets 404, and the naive redirect strips `?g=` and sends the user back to lobby. Visible: SETUP screen flickers, snaps back. Start Game is unusable.

**Correct discriminator before redirecting on 404:** check whether `localStorage` (or any client-side cache) has state matching the URL gameId. If YES → fresh game the server hasn't synced yet, keep going and let local state hydrate. If NO → genuinely stale URL, safe to redirect. See memory entity `Stale-URL redirect needs local-state discriminator` for the full pattern.

### Deploy verification — bundle hash trick

When the user reports "I don't see X" after I shipped, **always** check whether the build actually deployed:

1. Build locally — note the new `services-<hash>.js` filename in the build output.
2. Ask the user to share the bundle filename from their browser console / network tab (or have them load the site and check).
3. If their hash differs from my latest build, the bundle on the live site is stale — the fix is correct but hasn't shipped yet. Don't debug further until deploy is confirmed.

This caught two false-alarm regressions in past sessions.

### jsdom `window.location` mocking — use the forks pool

jsdom in the `vmThreads` pool makes `window.location` non-configurable. Test code that tries to mock it (`Object.defineProperty(window, 'location', …)`, even property-level `Object.defineProperty(window.location, 'origin', …)`, `vi.spyOn` on the prototype getter, or `delete window.location`) all fail with `Cannot redefine property: location` / `Cannot delete property location`. There is no test-side workaround.

The fix is a vitest config change: add the test file path to the `forksFiles` array in `vitest.config.ts`. The `forks` pool runs each test in a fresh Node child process where `window.location` can be redefined. Existing entries: `networkDetection.test.ts`, `dictionaryBridge.test.ts`, `dictionaryBridge_embedded.test.ts`, `EndGameModal.test.tsx`, `dictionary/terms.test.ts`.

### Ghost player batch — cancellation-aware abort + forward-bias heuristic

Two patterns sit together because both shipped in v2.63.7+v2.63.8 to keep the strict 50-game gate green.

**Cancellation:** A naive `Promise.race([playOneGame, setTimeout])` doesn't actually stop the stuck game — race resolves but `playOneGame` keeps running and starves the next iterations. Real fix is `AbortSignal` threaded through `playOneGame` and its inner helpers (`resolveAnyPendingChoice`, `triggerManualSpaceEffects`); every yield point checks `signal?.aborted` and returns early. The inner `Promise.race` that wraps `triggerManualEffect` also races the signal — with explicit `removeEventListener` in `finally` (otherwise listeners accumulate per-effect per-turn → `MaxListenersExceededWarning` at 11+). `runGhostBatch` creates one `AbortController` per game with a 30s `setTimeout(controller.abort, …)`.

**Forward-bias:** Pure random destination picks loop indefinitely at resume hubs (`PM-DECISION-CHECK`, OWNER phase). `pickDestination` in `tests/ghost/ghostPlayer.ts` filters destinations to those whose `GAME_CONFIG.csv` phase ≥ current phase (using `PHASE_ORDER` map `SETUP=0 < OWNER=1 < FUNDING=2 < DESIGN=3 < REGULATORY=4 < CONSTRUCTION=5 < END=6`), then picks the least-visited candidate from that pool (ties random). Visit counts are tracked in a per-game `Map<string, number>`. Falls back to all destinations if no forward option exists. Restored win rate from ~70% to ~93% over 50 games.

Neither pattern touches production game logic — both are local to the test bot.

### Deploy command

User runs deploy from a **regular Windows terminal**, not WSL — the `unraid` ssh alias is in their Windows ssh config, not the WSL one (and not Git Bash's `~/.ssh/config` either, which is what Claude Code's shell sees). CLAUDE.md's `ssh unraid "..."` snippet works only after the alias is replicated to `~/.ssh/config` in Git Bash. Don't rerun deploy on the user's behalf — produce the command for them to copy. `git push` over HTTPS does work from Claude Code; only the ssh leg is the blocker.

### WebFetch is blocked by Cloudflare on game/dashboard.unravelcodes.com

Both `game.unravelcodes.com` and `dashboard.unravelcodes.com` are fronted by Cloudflare which rejects the WebFetch User-Agent with HTTP 403, even on truly public endpoints. **Use `curl --max-time 10` from Bash instead** — works fine, same payload. Pattern for `/start`-style probes:

```
TOKEN=$(grep '^FEEDBACK_TOKEN=' .env | cut -d= -f2)
curl -sS --max-time 10 -w "[HTTP %{http_code}]" "https://game.unravelcodes.com/api/public/feedback/open?token=$TOKEN"
```

For JSON parsing, pipe through `python -c "import sys,json; ..."` — `jq` is not always installed in Git Bash. Never put tokens directly in echoed URLs; assign to `$TOKEN` first so they don't show up in chat.

### Dashboard is a proxy, not a store

`dashboard.unravelcodes.com` (source at `D:\Unravel\dictionary-scraper`, Next.js + FastAPI Docker stack on Unraid) is a UI wrapper. Its `GET /api/feedback` forwards to `https://game.unravelcodes.com/api/feedback`. **The game server in this repo is the source of truth for feedback data.** To read feedback programmatically, hit the game server directly — use the v2.63.5 `GET /api/public/feedback/open?token=…` endpoint, not the OAuth-gated dashboard.

### Feedback screenshots — fetch via `/api/feedback/:id.json`

The public `/api/public/feedback/open` endpoint strips screenshots deliberately (low token cost). The per-id endpoint `GET /api/feedback/<id>.json` returns the full record including a base64 `screenshot` field, and appears to NOT be token-gated. Pipeline that makes triage massively faster:

```
curl -sS --max-time 30 "https://game.unravelcodes.com/api/feedback/<id>.json" -o .claude/tmp/<id>.json
python3 -c "import json,base64; d=json.load(open('.claude/tmp/<id>.json')); h,b=d['screenshot'].split(',',1); open('.claude/tmp/<id>.jpg','wb').write(base64.b64decode(b))"
```

Then `Read .claude/tmp/<id>.jpg` — the multimodal model renders it inline. Use this whenever a feedback report references a visual state ("modal review", "looking at panel", etc.) — root cause is often visible directly.

### Result modal: visualSummary vs summary (v2.64.7)

`TurnEffectResult` has two summary fields by design:
- `summary: string` — full assembled storyText + canned tone + per-effect recap. Used for TTS via `useModalSpeech` / `getTtsText`.
- `visualSummary?: string` — NPC narrative only (from `SPACE_CONTENT.csv` `story` column). Used for the visible Summary block in `DiceResultModal`.

The full `summary` duplicates the Effects Applied list and Before/After block, so the visible Summary uses the narrower `visualSummary` to stay narrative-focused. If you add a new `TurnEffectResult`-producing path, populate `visualSummary` from `dataService.getSpaceContent(space, visit)?.story` — otherwise the modal falls back to `summary` and the user sees "the same outcome described three times."

### Result modal: before/after snapshots + gotchas (v2.64.3–v2.64.6)

`TurnEffectResult.before / after: ResourceSnapshot?` drives `BeforeAfterBlock` (money, scope, time, card counts per W/B/E/I/L). Three gotchas:
1. `GameRulesService.calculateProjectScope` reads **live** state. Compute `beforeScope` BEFORE applying effects, `afterScope` AFTER. The `buildResourceSnapshot(player, scope)` helper takes scope as a param to decouple this.
2. Funding cards (B = Bank Loans, I = Investments) auto-play at funding spaces → move from `player.hand` to `player.activeCards`. `buildResourceSnapshot` iterates BOTH stores. If you count only hand, those cards never show a delta.
3. Swap actions (`cardAction:'replace'`) have zero net count change. `BeforeAfterBlock` accepts `effects?` and synthesizes a `↔ N swapped` row for replace actions even when before.count===after.count. Without that, the swap modal shows no card row at all.

### Vite manualChunks: plugins live in the host chunk

Plugins that extend a host library MUST be routed to the host's chunk in `vite.config.ts` `manualChunks`. Example from v2.64.0: `@jalez/react-flow-smart-edge` + its `pathfinding` peer must land in `vendor-reactflow` alongside `@xyflow/react`, otherwise pathfinding falls into the catch-all `vendor` chunk and creates a `vendor → vendor-reactflow → vendor` cycle that Rollup warns about. The fix: add the plugin AND its peer dependencies to the same condition that routes the host library.

### smart-edge package is broken under jsdom — use the stub

`@jalez/react-flow-smart-edge@4.0.0` ships a CJS `dist/index.js` inside an ESM package (`"type":"module"`), and its ESM build named-imports CJS-only `pathfinding`. Both crash Node's loader under jsdom (`ReferenceError: module is not defined in ES module scope` or `Named export 'AStarFinder' not found`). Production is fine (Vite resolves to ESM via the `module` field). For tests: `tests/stubs/smartEdgeStub.ts` re-exports React Flow's built-in `BezierEdge` etc. under the smart-edge names, aliased in `vitest.config.dev.ts`, `vitest.config.ci.ts`, AND both inline `defineProject` blocks in `vitest.config.ts`. No tests assert on edge geometry, so a no-op stub is sufficient.

### MOVEMENT data integrity is now a regression test

`tests/ghost/dataIntegrity.test.ts` asserts no MOVEMENT row lists its own space as a destination (the PM-DECISION-CHECK self-loop bug, v2.64.2). When editing `public/data/SOURCE_FILES/Spaces.csv` movement columns, also update the regenerated `public/data/CLEAN_FILES/MOVEMENT.csv` so both ship consistent data. The server runs `processGameData.js` on save/reset but the build does NOT regenerate CLEAN_FILES — keep both files in sync manually for deploy-time consistency.

### Voice-leak audit — fast triage query

To find remaining game-language leaks before claiming "voice sweep done":

```
Grep: pattern="[Rr]oll for|[Dd]raw [WBIEL]|w cards?" path=src/components glob=*.tsx
```

Filter out internal CSS class names (`card-*`), code variables (`drawCards`), JSDoc comments. Focus on JSX text and string literals that hit the UI.

### Per-space hardcoding lift — six-step playbook

Lifting a literal `currentSpace === 'FOO'` (or `[...].includes(space)`) to a data column is a Workstream-6-style mini-pass. 10+ literals have been lifted via this exact recipe; the receipts live in `DataService.ts:92-185` (Workstream 6) and the v2.65.6 funding-source addition.

1. **CSV side (both copies)**: add the column to `public/data/SOURCE_FILES/Spaces.csv` AND `server/data/game-data/SOURCE_FILES/Spaces.csv`. Update CLEAN_FILES `GAME_CONFIG.csv` in all three locations (`public/`, `server/`, `dist/`). A small Python script (`csv.reader` → mutate → `csv.writer`) is faster and less error-prone than 50+ Edit calls.
2. **Pipeline**: update `server/processGameData.js` — parse the new column from the Spaces row (with default for missing), add it to the `configs` object, AND append the column name to the `fieldnames` array. This preserves the column across editor saves.
3. **Type contracts**: add the optional field to `GameConfig` in `src/types/DataTypes.ts`, AND add the new helper method signatures to `IDataService` in `src/types/ServiceContracts.ts`. Skipping the interface update is the single most common mistake — `as IDataService` test mocks silently accept missing methods and only break at runtime.
4. **Parser + helpers**: extend `DataService.parseGameConfigCsv` to read the new column by index (header column count matters). Add the `get*()` + boolean predicate helpers that proxy to `getGameConfigBySpace(spaceName)?.field ?? defaultValue`.
5. **Refactor call sites**. Sometimes the right answer isn't a lift but a delete — if grep shows no production callers (only the function's own tests), it's dead code; remove it instead. Voice-leak callers and notification helpers are common offenders.
6. **Test mocks**: update `tests/mocks/mockServices.ts` (global mock — safe defaults: `false` / `''`) AND every test file with an inline mock object (`grep -l "shouldAutoApplyFunding:" tests/` finds them). For tests that depend on the lifted check firing at specific spaces, override the mock in `beforeEach` to be space-aware (return `true` / correct value for the known spaces, default otherwise). The `CardEffectService.test.ts` inline mock from v2.65.6 and the `ManualFunding.test.ts` follow-up are the canonical examples.

Verification order: `npm run typecheck` → targeted vitest on affected services (fast) → full vitest sweep (catches cross-file ripples from `as IDataService` casts). The full sweep is the only way to find tests using those casts — those silence type errors and only break at runtime. Schedule it as background work and continue with other tasks; the notification fires when it finishes.

### Per-step diagnostic logging for user-facing failures

Any try/catch that surfaces to the user (server handler, save path, sync push) should track a `step` var and surface it in the error response. Pattern: `let step = 'init'` before the try, reassign before each major operation, log `{ step, message, stack, payload sizes }` in catch, return `{ error, step, detail: err.message }` in the 500 response. Client-side toast concatenates them: `${data.error} (${data.step}: ${data.detail})`. Cost ~10 lines per block. Proven twice in one day: v2.65.7 instrumented `/api/admin/save-source-files`, and within minutes the first save returned `(backup: EISDIR: ...)` which immediately pinpointed v2.65.8's fix. Without it, the next failure would have been an opaque "Failed to save" with hours of guesswork.

### CSV round-trip with `_extraColumns` opaque pass-through

When an editor reads/writes a CSV with a fast-evolving schema, the parser must be header-aware and the typed row must carry an opaque `_extraColumns?: Record<string, string>` bag for any column outside the editor's known list. The exporter writes canonical headers + the union of `_extraColumns` keys across rows + per-row known fields + extras. Without this, every save silently strips columns added since the editor was last touched. v2.65.7 fix to `src/components/editor/utils/csvExport.ts` is the canonical example — exportSpacesCSV was 16 columns behind reality (37 vs 53) and had been quietly truncating Spaces.csv on every editor save since Workstream 6 shipped.

### "Don't defer small investigations" applied

10-minute scoped investigations (single file, single hypothesis, no architectural impact) go straight to in-progress, not into TODO. From user memory: `feedback_no_scope_caution_defer.md`. If you find yourself parking a 1-2 file fix in TODO "to keep the commit tidy," just do it.

### Dead-code check before claiming a fix

When a "feature doesn't work" bug seems straightforward, first verify the production code path actually reaches the suspected handlers. Grep for `serviceName.methodName(` (with paren) across `src/` AND `tests/`. If only the method's own definition + unit tests show up, the method is dead — refactor probably moved the production path elsewhere and left the orphan. v2.65.9 contractor mechanic was a perfect example: `applyQualityEffect`/`applyMultiplierEffect` existed and had 13 test references, but zero production callers — the whole mechanic had been silently dead for months. A modal-only fix would have shipped a label that didn't connect to anything.

### TodoWrite discipline

- Mark `in_progress` BEFORE starting the task (not after).
- One task `in_progress` at a time, always.
- Drop stale items entirely — don't let the list become a graveyard.
- A long session with 4+ user-listed tasks always benefits; a single 5-minute fix doesn't.

### Banner async-error surfacing — never `catch { console.error }` alone

When a button click fires `await someService.someMethod()`, the only-`console.error`-on-throw pattern is a real bug — the user sees a click that "did nothing" while the actual error sits in the console out of reach. Always set a state-backed error message and render a small banner above/below the button. Reuse the v2.66.0 / v2.66.2 styling (red `#fef2f2` bg, `#7f1d1d` text, `1px solid #dc3545` border, `role="alert"`) for visual consistency. If the throwing service uses the per-step diagnostic pattern, read `err.step` and append `(step: <name>)` to the message — example: `"Cannot end turn: Required: 3, Completed: 2 (step: check_actions)"`. v2.66.2 was a perfect proof: fb:56d0282c looked like a logic bug ("Accept the verdict does nothing") but was visibility — the same click now surfaces the real validation message with zero game-logic change.

### Visibility bug vs logic bug — check before diagnosing

When a "feature doesn't work" complaint comes in, **check whether the failure modes are surfaced before assuming logic is wrong.** Two grep heuristics catch most of these in one minute:

1. `Grep "catch.*console.error" path=<handler-file>` — if the only outcome on throw is a console log, the user is invisible to whatever's actually failing. Apply the banner pattern above.
2. `Grep "return null" path=<component-file>` — any render-null branch that hides state when the state IS the message. Example: `ApprovalBadges` hid itself when both statuses were `'none'`, but at REG-DOB-FINAL-REVIEW `'none'` IS the bug. Either remove the hide, add a `forceShow` prop, or gate the hide on a context-aware condition.

Visibility-bug fixes don't touch game logic — they surface existing behavior. This is the cheapest fix-to-impact ratio in the codebase. v2.66.2 shipped three of these and the playtester's "does nothing" complaint becomes self-resolving.

### Multiline-aware CSV walker — `split('\n')` is broken for quoted CSV

The naive `csvText.split('\n')` approach to splitting CSV into rows is **broken whenever a quoted field contains a literal newline** — and CSV writers like `escapeCSV` preserve newlines inside quoted values, so any multi-sentence Action/Event/Outcome written through `exportSpacesCSV` will trip the bug on the next parse: one record becomes N "rows," the trailing ones get silently dropped because they have no primary key. The corrupted survivor row then gets written back on save → sticky corruption.

Fix: walk char by char tracking `inQuotes`. `\n` outside quotes ends a record; `\n` inside quotes is preserved. Handle `\r\n` line endings (drop bare `\r` immediately preceding `\n` outside quotes). Handle `""` escape inside a quoted field so `inQuotes` doesn't flip off. See `splitCSVRecords` in `src/components/editor/utils/csvExport.ts` (v2.66.1) for the canonical implementation. Companion pattern to `_extraColumns` opaque pass-through — both belong together in any "safely round-trip a CSV the editor doesn't fully understand" design.

When auditing other CSV parsers in this codebase, grep for `csvText.split('\n')` and `.split('\n')` near any CSV-shaped data. DataService.parseGameConfigCsv and similar haven't been audited yet — flag in TODO if touched.

### Audit before sizing — "NOT STARTED" labels can be 80% built

When a roadmap doc (BETA_PLAN_V3, TODO, etc.) calls a workstream "NOT STARTED," verify by reading the actual code BEFORE committing to the doc's effort estimate. Workstream 5 was budgeted at 4–8 hours; the real fix was three lines because prior work had built the live-fetch path (`loadTerms()` API-first, `TextWithTerms` regex matcher, `DictionaryContext` async re-render, `GLOSSARY.csv` fallback) and only a CORS workaround was preventing it from running.

The triage that turned ~6 hours into ~30 minutes:
1. Grep for the keywords the workstream uses (`Dictionary`, `TextWithTerms`, etc.) — if `src/dictionary/` has 7+ files, "NOT STARTED" is suspicious.
2. Probe the supposed-missing external dependency directly with curl — if `GET /api/glossary/live` already returns 200 from the scraper, "build the endpoint" is dead scope.
3. Read the function the workstream would touch (`loadTerms`) — if it already implements the workstream's deliverable behind a feature flag / guard / workaround, the real work is removing that, not building new.
4. Read the comment on any cross-cutting workaround — `// Skip cross-origin fetch — dashboard API doesn't support CORS` is a literal map to the real fix.

The pattern showed up in v2.65.9 too (contractor mechanic — the entire `applyQualityEffect`/`applyMultiplierEffect` infrastructure existed but was dead because no production caller wired through to it). When a feature "doesn't work," the first hypothesis should be "wired wrong" before "build from scratch." Both are far cheaper to fix.

### React Flow `panOnDrag` swallows clicks on non-draggable nodes (v2.69.5)

`@xyflow/react` v12 default `panOnDrag={true}` at the `ReactFlow` root. With `nodesDraggable={false}` + `elementsSelectable={false}` (typical gameplay setup), mousedown on a custom node triggers React Flow's drag-or-pan decision. It can't drag the node, so it falls back to pane pan — consuming the mousedown. By mouseup the original click never reaches the node's `onClick` handler, and `onMouseEnter` behaves similarly (the canvas pointer-events layer wins). Visible symptom: cursor stays as React Flow's grab/pan style over tiles (custom node's inline `cursor:pointer` loses), clicks do nothing, hover-driven UI never fires.

Fix in `BoardCanvas.tsx`:
- `panOnDrag={isAdmin}` — gameplay players don't get canvas pan-on-drag; tile mousedown flows straight to custom node handlers. Players still have the Controls (bottom-left) zoom + fit buttons to navigate. If you need pan in non-admin, use `panOnDrag={[1, 2]}` (middle/right mouse only) so left-click stays free for nodes — though middle-click pan is undiscoverable for casual users.
- `elementsSelectable={true}` always — selection plumbing is what cleanly routes mousedown/click to custom node handlers. We don't render any selection UI so allowing selection is invisible.

Both knobs together; the cursor issue and the missing click handlers are the same root cause.

### `DataService` cache-on-first-load gotcha (v2.69.4)

`DataService.loadData()` caches all CSVs on first call via a `loaded` flag + `loadingPromise`. Subsequent `loadData()` calls return immediately without re-fetching. Cache-busting on the fetch URLs (`?_=Date.now()`) is wasted because the fetch never runs the second time. Symptom: a UI feature persists data to disk (drag-to-save, editor save), the server regenerates dependent files, but the next call to `dataService.getX()` returns the STALE in-memory values forever — reopening a modal doesn't help.

Fix shape: add a targeted reload method (e.g. `reloadGameConfig()`) that bypasses the once-only guard and re-runs one specific `loadX()` step. Add it to `IDataService` too. The consumer calls `reloadX()` on mount BEFORE rendering anything that depends on fresh data — hold dependent UI off-screen until the await resolves, otherwise an inner `useMemo` snapshots stale state.

Proven by v2.69.4: `BoardLayoutEditor` reopened with cached coords until `DataService.reloadGameConfig()` was wired. Generalize: any data source whose disk version can change without a page reload (admin edits, server regen, multi-tab) needs a targeted reload. Currently only `GAME_CONFIG.csv` has one — `MOVEMENT.csv`, `SPACE_CONTENT.csv`, etc. will hit the same trap if a future editor writes to them. Add reload methods on demand rather than invalidating all of `loadData()`.

### `deploy.sh cp -a` host/container race (v2.69.7)

Symptom: editor-saved CSV data (drag-to-save board positions, etc.) vanishes after some deploys. The script reports success, no error in output, but live `SOURCE_FILES` holds dist defaults. The user's edits are mysteriously back to baseline.

Root cause is a `cp -a` quirk + race. Pre-v2.69.7 deploy.sh did `cp -a $BACKUP/SOURCE_FILES $LIVE/SOURCE_FILES` AFTER `docker run`, with a 2-second sleep. When the destination dir already exists, `cp -a` (no trailing slash) copies source INTO it — creating `$LIVE/SOURCE_FILES/SOURCE_FILES/Spaces.csv`. The server reads `$LIVE/SOURCE_FILES/Spaces.csv` (un-nested) which holds the build defaults `initWritableData` copied in at startup. Whether the bug triggers depends on whether the server's startup beats the 2-second sleep — same script, sometimes works.

Fix: move restore to BEFORE `docker run`. Host-side ops on `$(pwd)/server/data/game-data` work fine without a running container. Server's `needsFullInit` check (`!fs.existsSync(...Spaces.csv)`) then skips init because Spaces.csv exists. No race, no sleep, no nesting.

The footgun was already documented in server.js:94 — "stray subdirectories have been observed in the wild (e.g. from a restore that nested SOURCE_FILES inside itself)." The BACKUP direction was hardened against it but the RESTORE direction stayed vulnerable for months.

General Bash lesson: `cp -a SRC DST` and `cp -a SRC DST/` behave the same — when DST exists as a dir, source becomes a child. To copy contents into an existing dir, use `cp -a SRC/. DST/`. Or `rm -rf DST` first. Or re-architect so DST doesn't exist when cp runs.

### `roll_group` pairs dice effects to one roll (v2.70.0 discovery)

`roll_group` column on DICE_EFFECTS.csv (and source `DiceRoll Info.csv`) groups multiple effect rows under ONE dice roll. Comment in `src/components/editor/types/EditorTypes.ts:68` documents it: *"Group name — effects with same roll_group share one dice roll; blank = all share one roll."*

Engine: `TurnService.processDiceRollEffects:1023` groups effects by `roll_group` key (blank/undefined treated as `''`). Each bucket gets ONE dice value; all effects in the bucket resolve from that value. Different non-empty `roll_group`s = separate rolls. Practical use: CHEAT-BYPASS has Time outcomes + Fees Paid + Next Step rows all with blank `roll_group`. Rolling a 5 → 60 days lost + lose $25,000 + go to PM-DECISION-CHECK, all paired by the engine with zero extra wiring.

**Trap 1 — column consistency:** the engine pairing is solid but row-shape isn't enforced. Two paired rows could have different populated roll columns (e.g. time has roll_1..6, money only has roll_1..5) and rolling a 6 would silently do nothing for money. `DataService.validateDiceEffectGroups` (v2.70.0) warns to console on load when this happens.

**Trap 2 — button proliferation:** SPACE_EFFECTS.csv `dice_outcome` rows (one per outcome category for a paired space) generate ONE action button per row in `ActionCenterPanel` by default. They have identical `effectKey=dice:dice_outcome`, so they ALL trigger the same single roll — but the player sees N buttons that look independent. v2.70.1 added a dedupe in `pendingActions` keyed off `effectKey`. v2.70.3 also suppresses the parallel dice-movement-driven button when an effects-driven dice button is already in the list — both fire the same `handleDiceRoll` so two buttons is purely confusing.

When designing or auditing a paired-effect space, the mental model is: "one row per effect type per visit, all sharing a roll_group, one button per roll_group on the player panel."

### `DiceRoll Info.csv` has `\r,\n` mixed line endings

`public/data/SOURCE_FILES/DiceRoll Info.csv` uses a non-standard line ending: `<row content>\r,\n` instead of `\r\n` or `\n`. The trailing comma (empty `roll_group` field) sits BETWEEN the CR and LF. `file` reports "with CR, LF line terminators" (mixed). Other SOURCE_FILES (Spaces.csv, ModalConfig.csv, PATH_CHOICE_RULES.csv) appear to use standard CRLF — this one is the historical outlier.

Edit tool's normal string matching FAILS on this file because it treats `\n` as the only line separator. Symptom: "String to replace not found" errors when the visible content matches perfectly.

Working approach: drop to Python byte-level edits. Read as bytes (`open(path, 'rb')`), construct old/new bytes including the literal `\r,\n`, replace, write back as bytes. Preserves the UTF-8 BOM and weird endings. Example:

```python
import sys
with open('public/data/SOURCE_FILES/DiceRoll Info.csv', 'rb') as f:
    data = f.read()
old = b'<prev row>\r,\n<next row anchor>,'
new = b'<prev row>\r,\n<new row content>\r,\n<next row anchor>,'
if old not in data or data.count(old) != 1: raise SystemExit(1)
data = data.replace(old, new)
with open('public/data/SOURCE_FILES/DiceRoll Info.csv', 'wb') as f: f.write(data)
```

Don't try to normalize the line endings — DataService.parseCsvLine, server processDiceEffects, and the editor CSV parser all handle the format. Touching it risks breaking those consumers in subtle ways.

After byte-editing the source, run `node scripts/regen-clean-files.mjs` to refresh `public/data/CLEAN_FILES/*` so downstream code sees the new rows. Then if the user already has the live data (server-side `server/data/game-data/SOURCE_FILES/DiceRoll Info.csv`), they need a separate migration step — the deploy preserves their copy and won't overwrite it with the new BASELINE. Either add via the in-game editor (triggers regen) or SSH-edit + container restart.

### Modal queueing — never overwrite, always queue (v3.0.9)

When two modal sources can fire on the same event (synchronous dice roll completion path + AutoActionEvent emitted during space arrival), **do not have both write to the same modal state.** The losing path either stomps or never shows, and the player sees content swap mid-render or perceives a single merged modal.

Pattern that works: dedicated component per modal type, queueing state in the parent. v3.0.9 fix: `GameLayout` carries both `isDiceResultModalOpen + diceResult` AND `isLifeEventModalOpen + pendingLifeEvent`. The `life_event` AutoActionEvent subscriber sets `pendingLifeEvent`; a small `useEffect` flushes the queue when the regular dice modal is closed (or immediately if none open). The dedicated modal's `onClose` clears both queue flags.

The fragile alternative: `setDiceResult({...new content}); setIsDiceResultModalOpen(true);` even though the modal was already open. Don't do this. Add the new modal to the `anyModalOpen` back-button tracker in `GameLayout` so Android back / Esc handling stays consistent.

Don't conflate with the EffectEngine vs explicit-draw "double-draw" suspicion — `EffectFactory.parseSpaceEffect:506-513` explicitly skips dice-conditional card rows so they're processed exactly once by `SpaceArrivalProcessor.processDiceConditionalCardEffects`. The bug was on the *display* side, not the data side.

### React Flow grows from TOP-LEFT — center-anchor with transform (v3.0.12)

React Flow positions custom nodes by their top-left corner. When a tile's CSS width/height grows (e.g. 150×60 → 220×120 for current player), it expands rightward and downward only, encroaching on the two neighbors below and to the right. v3.0.10 shipped the size hierarchy and immediately got bitten by this; v3.0.12 fixed with the center-anchored growth pattern.

Apply `transform: translate(-(w - COMPACT_W)/2, -(h - COMPACT_H)/2)` to the tile so growth is symmetric around the original anchor — encroachment splits across all four sides instead of two. Critically: must be a **transform**, not a `left`/`top` offset, so React Flow's positioning math isn't disrupted. Edit mode forces the compact size so the transform stays at (0,0) and drag math works cleanly.

The size hierarchy itself lives in `src/utils/boardCommon.ts` `computeTileVisualState({isEditMode, isExpanded, isCurrent, isHovered, isValidMove})` returning `{size, width, minHeight, zIndex, storyMax, showsStory, showsAction}`. Priority order edit-mode > expanded > current > hover > valid-move > compact. Click-locked tiles get popover treatment (heavy drop shadow `0 16px 36px rgba(0,0,0,0.28)` + z-index 30) so they read as a card floating above the grid; in-grid sizes layer normally.

Editor footprint buffer: exported constants `BOARD_TILE_COMPACT` and `BOARD_TILE_MAX_INGRID` let `BoardLayoutEditor` render a dashed 220×120 outline around every compact tile (`pointerEvents: none, zIndex: 0`) so admins see in-game footprint. Threaded through `BoardCanvasProps.showBuffer` → `BoardNodeData.showBuffer` → `BoardNode` render.

### Path-only edges by default — full network preserved for admin (v3.0.10)

The ~50-arrow forward-network from MOVEMENT.csv First-visit rows is too noisy in gameplay. Players want to see (a) where they've been and (b) where they can go next — nothing else. `BoardCanvas.visibleEdges` memo default-filters to:
- **Path-taken edges** — consecutive pairs in `currentPlayer.spaceVisitLog` (dim gray dashed `4 4`, opacity 0.7).
- **Next-move edges** — outgoing from `currentPlayer.currentSpace` (solid green `#10b981`, thicker, bigger arrowhead). Driven by `validMoves` (falls back to all-outgoing-from-current if validMoves hasn't loaded).

Admin mode (`isAdmin=true`) skips the filter entirely so `BoardLayoutEditor` still works for click-to-hide and per-edge admin operations. The memo deps include `currentPlayerId`, `players`, `validMoves`, `isAdmin` — don't drop any when refactoring.

### End-game data lives in three independent layers (v3.0.11–v3.0.13)

When building a stats/insights panel from in-game data, separate the three layers so each can be tested + extended independently.

1. **Data layer** — pure helper `buildEndGameStats(player, { projectScope })` in `src/utils/endGameStats.ts` returns structured `EndGameStats`. Caller injects `projectScope` from `gameRulesService.calculateProjectScope` so the helper stays service-free for unit testing.
2. **Presentation layer** — `EndGameStatsPanel` sub-component in `EndGameModal.tsx` takes the structured stats as props and renders them. Pure props in, JSX out.
3. **Wisdom layer** — pure helper `buildEndGameInsights(stats, player, { maxInsights })` in `src/utils/endGameInsights.ts` runs ~20 rules and returns the top N. Each rule is a `(stats, player) => Insight | null`. Three tones (win/observe/lesson). Renders as a `ProjectDebrief` sub-component in `EndGameModal.tsx`.

Why three layers: each layer's tests are sharp and fast. The wisdom layer can grow new rules without touching data or presentation. Nothing imports React except the presentation layer.

**Fee-vs-funding gotcha:** `feesBreakdown.totalFees` in EndGameStats **excludes** `bank` and `investor` categories from `player.costs`. Those are funding repayment, not fees. Including them inflates the displayed "Fees Paid" total artificially and confuses the reader.

**TurnsTaken approximation:** GameState has `globalTurnCount` (shared across players). The best per-player turn count is the `entryTurn` of the final `spaceVisitLog` entry. Document this in the helper since callers might be surprised the number isn't exact.

### Dashboard feedback PATCH sweep (v3.0.9 workflow)

Standing housekeeping pattern at every `/koniec`. Code-side fixes don't auto-flip the dashboard `resolved` flag — that requires an explicit PATCH.

- Endpoint: `PATCH https://game.unravelcodes.com/api/feedback/{id}.json` with body `{ "resolved": true }`. The `.json` suffix on the id is **required** (regex `/^feedback-\d+-[a-f0-9]+\.json$/` at `server/server.js:1166`). Dashboard list shows ids without it — add it for the PATCH.
- **Not** token-protected (admin-write surface; open). Read-side `GET /api/public/feedback/open?token={FEEDBACK_TOKEN}` IS token-gated.
- Sweep script: grep TODO.md for `fb:(feedback-\d+-[a-f0-9]+)` markers on `[x]`-checked lines, intersect with the live unresolved set, PATCH each. Don't blindly flip every TODO marker — only ones still showing unresolved on the dashboard.

Common cause of "shipped but report still unresolved": we always remember to update TODO, rarely the dashboard PATCH. v3.0.9 sweep flipped 29 reports (this sprint + v2.63.9–v2.65.x backlog of `[x]` entries that had never been flipped). Dashboard 51 → 22 unresolved.

### Bugs live in seams — test the handoffs, not just the units (v3.0.14)

Both bugs shipped in v3.0.14 (L049 expeditor draw + REG-DOB-TYPE-SELECT deadlock) had every individual function unit-tested green. They lived in the seams.

**L049 shape — parallel branches that drifted apart.** [CardService.ts:1126](src/services/CardService.ts:1126) tick_modifier block branches on `card.scope === 'global'` to fan time effects across all players. Eight lines below at line 1159, the DRAW_CARDS block didn't have that branch — single-player only. Every unit test for draws used `scope=Single`-shaped fixtures, so the branch never failed because it didn't exist to be reached. **Rule: when adding code paths to one branch (time / money / cards / discard), audit the parallel branches and mirror.** A "global scope only works for time" gap is a silent data lie waiting to surface.

**REG-DOB-TYPE-SELECT shape — function returns "no action needed" but downstream still counts the action.** [MovementService.createMovementChoice:1156](src/services/MovementService.ts:1156) fell through with `'Only 1 valid move(s)'` and no `moveIntent` set when pathChoiceMemory narrowed validMoves to 1. [StateService.calculateRequiredActions:1084](src/services/StateService.ts:1084) kept counting the choice as required because `movement_type === 'choice'`. The screen had no picker (1 option ≠ a choice modal), End Turn greyed out forever, "1 action remaining" tooltip with no actionable affordance. **Rule: when a function decides "no action needed", verify every downstream counter agrees. If anything still calls it a pending action, you've created an uncompletable state — the worst possible UX.**

**Diagnosis order when player reports "stuck":** check `requiredActions` vs `completedActions` BEFORE assuming UX/styling. The disabled button is almost always a symptom of an uncompletable required action, not a styling bug. Spent ~30 min on the wrong diagnosis (button styling, mobile scrolling, narrative copy) before realizing.

**The gate that catches this class going forward:** [tests/integration/cardTextMatchesColumns.test.ts](tests/integration/cardTextMatchesColumns.test.ts). Scans every CARDS_EXPANDED.csv description for trigger phrases ("each/all players draws/discards/decrease/increase") and asserts structured columns implement them. Caught L027 + L042 on first run (both same shape as L049 — silent zero-deltas). New pattern: for any data-driven mechanism (card text → engine effects, space flags → movement behavior), add a "text-matches-engine" gate. Unit tests verify the engine; integrity gates verify the authoring side stays honest.

### Path-choice-lock-point mechanism — already exists, don't rebuild (v3.0.14)

`pathChoiceMemory` is a fully data-driven per-space pick-memory system (Workstream 6 #4). If asked to "make space X remember the player's first pick and auto-route on returns":

- Read side: [MovementService.ts:126-133](src/services/MovementService.ts:126) narrows validMoves via `dataService.isPathChoiceLockPoint(space)` + `dataService.getPathChoiceMemoryKey(space)`.
- Write side: [MovementService.ts:327-335](src/services/MovementService.ts:327) stores the picked destination in `player.pathChoiceMemory[memoryKey]` when leaving the lock-point on First visit.
- Auto-route fallthrough: [MovementService.ts:1156-1170](src/services/MovementService.ts:1156) (added v3.0.14) — when narrowed to 1 valid move on a choice space, sets `moveIntent` automatically.
- Config: [GAME_CONFIG.csv](public/data/CLEAN_FILES/GAME_CONFIG.csv) columns `path_choice_memory_key` (free string, by convention namespace per concept like `dob_path`) + `is_path_choice_lock_point=Yes`. Currently only REG-DOB-TYPE-SELECT uses it; just add another row to extend.

**The 3 pieces work together — don't fix one in isolation.** If a lock-point space deadlocks, suspect the auto-route fallthrough first (the seam). If it asks twice, suspect the read filter. If memory never persists, suspect the write block.

### Legacy `/api/gamestate` fallthrough trap (v2.69.1)

`src/utils/networkDetection.ts:getGameStateAPIPath(gameId?)` returns `/api/games/${gameId}/state` when a gameId is provided, but falls through to `/api/gamestate` (the single-game-era legacy endpoint) when none is. The server still holds a single-game record at `LEGACY_GAME_ID` that can be left in any phase from prior sessions. Any caller doing `loadStateFromServer()` without first ensuring a gameId in the URL can pick up legacy state — typically PLAY phase — and skip setup entirely. Presents as "the app jumps directly to the game" on a fresh URL hit.

Fix shape: auto-create-game (or any pre-state-load setup) lives at `App.tsx` level via a `useState(() => !getCurrentGameId())` gate. While true, App returns `<LoadingScreen />` and runs `POST /api/games` + redirect itself. `ServiceProvider` only mounts after URL has a real `?g=`. Defense in depth: `ServerSyncService.loadFromServer` adds `if (!getCurrentGameId()) return false` so the legacy path can't be hit accidentally.

When refactoring App-level routing, remember: `ServiceProvider` doesn't take a gameId — it instantiates services with empty/default state. State only becomes per-game after `loadStateFromServer` runs. The legacy fallthrough is a leak in that abstraction; the App-level gate is the seal.

### iOS Safari `100vh` lies when the keyboard appears — use `100dvh` (v3.0.15)

Any `position: fixed; height: 100vh; overflow: hidden` container that contains a text input WILL have a keyboard-hides-input bug on iOS Safari. `100vh` is the *layout* viewport — it never shrinks when the on-screen keyboard slides up, so the input that was at the bottom of the visible area ends up behind the keyboard with no way to scroll. `overflow: hidden` then prevents any rescue.

Fix: use `100dvh` (dynamic viewport height) which DOES shrink. Inline-style React makes this awkward because CSS-style fallbacks (`height: 100vh; height: 100dvh;`) require two declarations of the same property — impossible in a JS object. Pattern that works: small `<style>` block inside the JSX defining a class, plus `className` on the container.

```tsx
<div className="us-setup-fullheight" style={styles.container}>
  <style>{`.us-setup-fullheight { height: 100vh; height: 100dvh; }`}</style>
  …
</div>
```

`styles.container` keeps `width: '100vw'` and everything else but **drops the `height` key entirely** — the className wins. Modern browsers (iOS 15.4+, Chrome 108+) parse both declarations and the second wins; old browsers ignore the unknown `100dvh` and fall back to `100vh`. Same trick works for `100svh` if you want "always the smallest" behavior.

Don't pair with `minHeight: '100vh'` as a fallback — that defeats the shrink. The whole point of `100dvh` is the container CAN go below 100vh when the keyboard takes space; minHeight prevents exactly that.

When auditing for this bug class: grep for `'100vh'` and `'100svh'` in `src/**/*.tsx`. Most are fine (full-screen modals don't care because the user isn't typing). The trap is any container whose direct child includes an `<input type="text">` or `<textarea>`.

### Audit ALL text surfaces for cross-references — including the dictionary itself (v3.0.15)

`TextWithTerms` already wrapped game text in cards, modals, story accordion, and space panels — but `DictionaryPanel`'s own term-detail view was rendering `definition`, `definitionSimple`, `whyItMatters`, `instructions` as raw strings. Players opened a definition expecting "Expeditor" and "DOB" inside the prose to underline, found nothing, filed `fb:00d1db0a`.

When auditing for "underline coverage" gaps, the surfaces that get missed are the ones that LOOK like they shouldn't need underlines — the dictionary because "it's already the dictionary," the editor's own preview text because "it's admin," etc. **Quick grep:** `grep -rn '{selectedTerm\.' src/ | grep -v TextWithTerms` finds raw-string renders of glossary fields. Same shape for `{card.description}`, `{content.story}`, `{action.description}` — any prose pulled from data and rendered as `{...}` directly. Wrap with `<TextWithTerms text={…} onTermClick={(t) => existingHandler(t.id)} />`.

Self-references (term "DOB" referenced inside the DOB definition) underline and clicking is a visual no-op — acceptable. Don't add a `currentTermId` exclude prop for purity; the cost is real complexity for an outcome no one notices.

### Flex-column `min-height: 0` for inner `flex: 1` scroll (v3.0.18)

If a flex column container has a `flex: 1` child with `overflow: auto` that's supposed to scroll its content, the parent MUST also have `min-height: 0`. Without it, the `flex: 1` child can't shrink below its natural content height — it grows to fit everything, the overflow:auto never triggers, and content past the viewport silently leaks out the bottom (often hidden behind a pinned-bottom sibling like a Start Game button).

Hit this in v3.0.18 on `PlayerSetup.tsx` `styles.panel`. The panel had been missing `min-height: 0` since v2.69.x but the latent bug only surfaced when v3.0.16's inner-card `flex: '1 1 360px'` basis pushed each player card past the 2-column TV width threshold, internal flex-wrap dropped QR below avatar/name cluster, taller cards × 4 players exceeded panel height. Two-line fix: add `minHeight: 0` to the panel, switch its own `overflow: 'auto'` → `'hidden'` (since the inner wrapper scrolls properly now and the panel itself shouldn't scroll past its boxShadow boundaries). `fb:ffdddd29`.

**Audit pattern:** anywhere you see `display: 'flex', flexDirection: 'column'` with a `flex: 1` overflowing child, the parent needs `minHeight: 0`. Same gotcha exists for rows + `minWidth: 0` — already used correctly in `styles.panel` and `styles.main`; the column-axis equivalent is what was missing. CSS flex spec requires this; it's not a browser bug.

### Dormant CSV columns: type + engine declare it but parser doesn't read it (v3.0.17)

`revokes_approval` was added to CARDS_EXPANDED.csv in v2.61.1 (W7 Phase 7.3). The `Card` type in DataTypes.ts has the field. `CardService.ts:1083` reads `card.revokes_approval` to apply DOB/FDNY revocations. But `DataService.parseCardsCsv` was only reading 30 columns — `revokes_approval` (column 31) never got assigned from the CSV row. Silently `undefined` for ~6 weeks. Discovered v3.0.17 while wiring `affected_phase` (column 32).

**Pattern when a Card field looks broken or under-used:** before blaming the consumer, check `parseCardsCsv` in `src/services/DataService.ts:921-1002`. The parser is the bridge — type declarations and engine consumers can both reference a field that the parser never sets. The `expectedColumns` array at line 928 is the source of truth for what gets loaded; if your field isn't in the final `return { ... }` block (line 959+), it's dead even if it compiles.

**Defensive practice when adding a new CSV column:** update the type, the parser, AND a test that asserts a known row's value round-trips. The card-text integrity gate at `tests/integration/cardTextMatchesColumns.test.ts` exercises this path now for `affected_phase` — extend it when adding more columns.

### LOGIC_QUESTION cross-runtime ChoiceService.pendingChoices — RESOLVED v3.0.33 (case 4 confirmed)

> **RESOLVED v3.0.33.** Case (4) is correct, and code-reading *can* confirm it — the earlier "phone owns the engine because endTurn is clicked there" assumption looked at the wrong player's endTurn. The LOGIC_QUESTION chain fires in `startTurn`, and `startTurn` for the INCOMING player runs synchronously inside the OUTGOING player's `endTurnWithMovement → nextPlayer → startTurn` (`TurnService.ts:458 → 645 → 810`). So the pending promise is created on the *outgoing* player's device; the *incoming* player answers on their own phone — a different runtime with no matching promise. **Fix shipped: the state-mediated relay described below.** `Choice.resolvedWith` (CommonTypes.ts) + `StateService.setChoiceResolution` (stamps + syncs) + a `ChoiceService` constructor subscription (`handleRelayedResolution`) that resolves the local promise when a relayed selection arrives. `resolveChoice` now relays instead of returning false when it has a valid active choice but no local promise. Applies to all choice types; single-device path unchanged. The v3.0.24 reconnect did NOT fix this (wrong-runtime, not dead-socket). Still wants a two-device playtest to confirm end-to-end before flipping the dashboard flag. Original investigation notes kept below for context.

`fb:068a66f2` reported "pressing yes or no did nothing" on a LOGIC_QUESTION modal in TV-with-phones mode. Spent ~2 hours reading code, narrowed to four plausible failure paths in `ChoiceService.resolveChoice`:

1. **No active choice in state** — WebSocket race overwriting local awaitingChoice
2. **ID mismatch** — stale React closure in the button onClick handler
3. **Invalid selection** — option ID typo (unlikely for hardcoded yes/no)
4. **No pending promise** — cross-runtime: the runtime resolving the click never called `createChoice` for that choice ID. The phone is rendering a modal for a choice the HOST runtime owns.

(4) is the most likely if the bug is real — each device has its own `ChoiceService` instance with its own `pendingChoices: Map<choiceId, {resolve, reject}>`. `setAwaitingChoice` syncs over WebSocket so the modal renders everywhere, but the promise lives only on the runtime that called `createChoice`. The fix would be a state-mediated resolution relay: store the resolution selection in `gameState.awaitingChoice.resolvedWith`, both runtimes listen, the one with the pending promise resolves and clears.

Code-reading alone can't confirm (4) without a live repro — under the read-only theory, the phone owns the engine because `endTurn` is clicked there, so the phone should also own the promise. v3.0.19 shipped diagnostic toasts so failures are visible to the player; v3.0.19 + reproduction will tell us which of the four cases is hitting. **If the bug is reproduced and the toast says "No pending promise":** that confirms (4), implement the state-mediated relay. If the toast says one of the other three: different fix path.

`docs/technical/STATE_SYNC.md` (if it exists) or `src/services/ServerSyncService.ts` `syncToServer` line 162 (pre-increment WS version to suppress self-echo) is the closest prior art for the cross-runtime fields.

> **v3.0.24 update:** this MIGHT already be fixed as a side-effect of the WebSocket reconnect-on-wake change (see next pattern). If the phone's socket was dead when it clicked yes/no, the `resolveChoice` round-trip would silently fail regardless of which of the 4 paths above. Re-test `fb:068a66f2` on a phone that's been kept awake before assuming the cross-runtime relay is still needed.

### Mobile browsers freeze backgrounded tabs — WebSocket needs `visibilitychange` reconnect (v3.0.24)

Root cause of a 3-report phone cluster (`fb:f7312d82` "phone crashed, won't reload", `fb:c7312a0a` "won but phone showed nothing"). `WebSocketSyncService` had hooks for page-close (`beforeunload`), a 30s heartbeat, and backoff reconnect on a *visible* drop — but **nothing for the tab returning to the foreground.** Mobile browsers (iOS Safari especially) freeze a backgrounded tab: they pause `setInterval`/`setTimeout` (so the heartbeat stops) and the OS can kill the socket **without firing `onclose`**. A phone that locks or app-switches mid-game (constant in tabletop play) silently loses its connection and the client never knows. The TV, always foregrounded, stays fine — which is why the symptom reads as phone-only.

**The fix pattern (all in `src/services/WebSocketSyncService.ts`):**
1. `document.addEventListener('visibilitychange', ...)` → on return-to-foreground, treat the connection as suspect if the socket isn't `OPEN` *or* no pong arrived within one heartbeat interval (timers were frozen), and force a reconnect.
2. `forceReconnect()` — tear down the zombie socket *with its handlers detached first* (`ws.onclose = null` etc.) so the close doesn't schedule a second competing reconnect; reset backoff; reconnect now.
3. Don't strand a *visible* tab: when reconnect hits the attempt cap, if `document.visibilityState === 'visible'` keep slow-retrying instead of going `disconnected` (no auto-reload + no reconnect button = "phone won't reload").
4. Lifecycle listeners → idempotent `addLifecycleListeners()`/`removeLifecycleListeners()`; armed on `connect()`, cleared on `disconnect()`.

**Why no HTTP catch-up was needed:** the server already re-sends current state on `subscribe` (`server/websocket.js` `sendCurrentState`), so a successful reconnect catches the phone up automatically. The whole fix is "make the reconnect fire." Diagnosis confirmation came from v3.0.21's saved `gameState` field being *absent* in `fb:c7312a0a` — the phone couldn't fetch its own state, proving it was disconnected-and-unaware.

Tests are awkward (jsdom can't truly background a tab) but doable: override `document.visibilityState` + dispatch `new Event('visibilitychange')`, and add a `MockWebSocket.autoOpen` toggle so reconnect attempts can be made to accumulate past the cap. See `tests/services/WebSocketSyncService.test.ts` "Visibility resume" block.

### Smart-TV detection is best-effort UA-only; laptop-into-TV is undetectable (v3.0.25)

`isSmartTV()` in `src/utils/deviceDetection.ts` matches TV/console UA tokens (Tizen, Web0S, Android TV, Fire TV `AFT*`, Chromecast `CrKey`, BRAVIA, tvOS, Roku, VIDAA, HbbTV) to auto-preselect TV mode on the setup screen. **It cannot detect a laptop/PC driving a TV over HDMI** — that reports a normal desktop UA, indistinguishable from a regular PC, and falls through to PC mode. This is why the setup toggle was *also* enlarged (v3.0.25) rather than relying on detection alone. Don't try to "improve" the heuristic to catch the HDMI case — there's no signal for it; the prominent manual toggle is the intended fallback.

### Grep the codebase for an `fb:` id BEFORE implementing a dashboard fix (v3.0.28–32)

The `/start` feed and TODO surface dashboard reports as "open," but several were **already fixed in an earlier version** — the code shipped, but the TODO checkbox was never flipped and the dashboard `resolved` flag never PATCHed. In the v3.0.28–32 block, three "open" items turned out done: `fb:ffdddd29` (player-list scroll, fixed v3.0.18), `fb:58a2112b` (LOGIC_QUESTION `auto_answer_from` — fully implemented), `fb:41e35769` (already `[x]`).

Before writing a fix for any dashboard item, spend 60 seconds confirming it's actually unbuilt:
1. `Grep "fb:<id>"` across `src/` and `docs/` — a code comment citing the id means it's likely done.
2. Grep the feature area (the column name, the helper, the CSV field) — e.g. `auto_answer_from` was already in LOGIC_QUESTIONS.csv *and* read by `tryAutoAnswer`.
3. Read the relevant component/service — the affordance may already render (the `playerListWrapper` already had `overflow:auto` + `minHeight:0`).

Also verify "bugs" against the data before assuming logic is broken: `fb:46dd4a47` ("landed on PM-DECISION-CHECK unexpectedly from CHEAT-BYPASS") is working-as-designed — `DICE_OUTCOMES.csv` maps CHEAT-BYPASS rolls 5–6 to PM-DECISION-CHECK. It's a gamble space, not a movement defect. When the deploy of these fixes is confirmed, run the standard dashboard PATCH sweep to flip the now-resolved ids.

### Board next-move arrows: `validMoves` is the single source of truth, no superset fallback (v3.0.29)

`fb:84da66be` — at a choice space the player panel offered 2 destinations while the board drew 4. Root cause: `BoardCanvas.visibleEdges` fell back to drawing **every outgoing MOVEMENT.csv edge** whenever its `validMoves` snapshot was empty (player already moved / mid-move / not yet loaded). That superset reintroduced destinations the engine had narrowed away via `pathChoiceMemory` / approval. The panel builds its movement choice from `MovementService.getValidMoves` (the narrowed set), so the two disagreed.

Fix: extracted `computeVisibleEdgeIds(currentSpace, validMoves, spaceVisitLog)` in `src/utils/boardCommon.ts` (tested, 5 cases). Next-move edges come ONLY from `validMoves` — empty validMoves → no next-move arrows, never the raw superset. Returns `{ allowedIds, nextMoveIds }`; BoardCanvas greens an edge via `nextMoveIds.has(e.id)` (was: any edge whose source === current space, which could mis-green a path-taken loopback). **Rule for board edge work:** the board must never show more destinations than `getValidMoves` returns — they share that one source or they drift.

### `*_conditional` card-mechanic family — condition a card effect on player state (v3.0.28, extended v3.0.43)

`fb:776e3ba7` (L012) seeded the pattern; v3.0.43 grew it into a family of five conditional mechanics. The 5-file floor below is the minimum diff to add a new mechanic name — skip any one of them and the new value either compile-errors, parses to `undefined`, or breaks test mocks.

**Five-file floor to add a new `*_conditional` mechanic value:**
1. `src/types/DataTypes.ts` — append to the `Card.card_mechanic` union (~line 391).
2. `src/services/DataService.ts` — append to the parse whitelist (~line 1003). Skip this and the CSV column reads as `undefined` silently.
3. `src/services/CardService.ts` — add a `<NAME>_WORK_TYPES` (or whatever) constant + a `playerXxx` helper + a new branch in the `conditionMet` switch (~line 1417). All conditionals share the same emission path; only the predicate differs.
4. `public/data/CLEAN_FILES/CARDS_EXPANDED.csv` — set the card's `card_mechanic` column (#22, 0-indexed) and a non-zero `tick_modifier`/payload.
5. `tests/mocks/mockServices.ts` — only if the new helper is also exposed on `ICardService` for cross-service plumbing (e.g. reveal builders below).

**Mechanic values shipped:**
| Mechanic | Card | Helper | Trigger |
|---|---|---|---|
| `work_type_conditional` | L012 Soil Contamination | `playerInvolvesGroundwork` | `GROUNDWORK_WORK_TYPES` (7 types) in player's hand |
| `utility_conditional` | L029 Utility Delay | `playerInvolvesUtilities` | `UTILITY_WORK_TYPES` (6: Electrical, Plumbing, Mechanical Systems, Boiler Equipment, Fuel Burning, Fuel Storage) |
| `high_profile_conditional` | L044 State Funding | `playerInvolvesHighProfile` | `HIGH_PROFILE_WORK_TYPES` (4: New Building, Full Demolition, Place of Assembly, Marquees) |
| `competing_worktype_conditional` | L041 Competing Projects | `playerHasCompetingWorktype` | Any OTHER player's hand W card shares a `work_type_restriction` with the drawer's |
| `leader_phase_conditional` | L046 Expeditor Awards | `getFurthestPlayer` (target-redirect, not just gate) | First card to redirect the effect to a non-drawing player — see below |

**Target-redirect pattern (L046, novel as of v3.0.43):** the conditional doesn't just gate WHETHER the effect fires — it changes WHICH player gets the effect. The single-target branch in `parseCardIntoEffects` (~line 1488) checks `card.card_mechanic === 'leader_phase_conditional'` and overrides `payload.playerId` to `getFurthestPlayer()` before emitting. Falls back to drawer if no leader exists (solo game). Conditional gate for this mechanic is just `true` — "leader always exists if any player exists."

**Reveal receipts pattern (L041 + L046 in v3.0.43):** when a conditional's outcome depends on cross-player state the drawer can't see, surface it in `LifeEventModal` via a new `kind` on `LifeEventEffectSummary` (`competing_reveal` 🔍 for L041, `leader_reveal` 🏆 for L046). The receipt is built by a public method on `ICardService` (e.g. `buildCompetingWorktypeReveal`, `buildLeaderReveal`) and injected at the top of `effectsSummary` inside `CardEffectHandler.handleCardDraw` (right after `diffLifeEventSnapshot`). Modal icon mapping at `lifeEventEffectIcon` (bottom of LifeEventModal.tsx). When adding a reveal kind, the 5-file floor grows to 7:
6. `src/services/StateService.ts` — append the new `kind` value to `LifeEventEffectSummary` (~line 37).
7. `src/components/modals/LifeEventModal.tsx` — add the icon case to `lifeEventEffectIcon`.
8. (and `ICardService` + `tests/mocks/mockServices.ts` to expose the builder.)

**Resist over-DRYing the conditional helpers.** Each `playerInvolvesX` is 4 lines; extracting a `playerInvolvesWorkTypes(playerId, set)` would save ~12 lines across three helpers but lock in `Set<string>` as the only allowed predicate. Two of the new mechanics (competing, leader) don't fit that shape at all. Leave them as parallel 4-line helpers until there are 5+ Set-based ones.

### Integrity gates can have a scope gap — extend to self AND global (v3.0.34)

`tests/integration/cardTextMatchesColumns.test.ts` validated card text-vs-columns, but every assertion was gated on the **global** pattern `(each player|all players)`. Self-targeted *"Draw 1 Expeditor Card"* cards (no "each/all players" prefix) were never checked, so 12 cards shipped drawing the wrong type for weeks. Lesson: when an integrity gate matches on a phrasing pattern, audit whether the *complement* (self-scope here) is also covered. v3.0.34 added a self-target DRAW gate; the symmetric self-DISCARD and self-flat-TIME gates are still gaps (flat-time is risky — conditional/"Roll a die" cards would false-positive; left for design judgment).

**Card bare-number type default = W.** `parseCardDrawFormat` (`src/utils/parseUtils.ts`) defaults a typeless count to `W`. So `draw_cards=1` on an E card draws a **Work Package**, not an Expeditor — and `discard_cards=1` discards a W. Always author `"N E"` (count + type). When a "Draw/Discard N <type>" card misbehaves, check the column has the type letter, not just the number.

### Expenditure recording: `updateTempState` survives turn-commit, mid-turn `updatePlayer` does not (v3.0.34 diagnosis → v3.0.35 fix)

The lesson stands even though the original symptom is fixed. Saved game G262 (v3.0.34): construction cost was deducted from cash via `resourceService.spendMoney` (exactly $907,500 = `scope × mult×0.1 × qualityCoeff`) but `expenditures.construction`/`costs`/`costHistory` all stayed 0 — invisible in the Pro Ledger and the end-game "Total spent" sum.

Root cause: the `CONTRACTOR_UPDATE` handler recorded `expenditures.construction` via `stateService.updatePlayer` ([EffectEngineService.ts:412](src/services/EffectEngineService.ts#L412)) — a REAL-state write that the turn-commit overwrote from the temp snapshot (which never got the construction entry). Design fees were fine because `trackDesignExpenditure` already used `updateTempState`. Fixed v3.0.35 by switching CONTRACTOR_UPDATE to the same temp/commit path + a `costHistory` entry — verified live via state-cheat to CON-INITIATION.

**General rule (still applies for any new mid-turn mutation):** any in-turn change that must survive turn-commit goes through `updateTempState`, not `updatePlayer`. When a value is "applied but vanishes by end of turn," suspect a real-state write racing the commit. Same shape applied to v3.0.39's approval-rollback work — see "Try-Again rollback for any new player-state field" pattern above.

### Bank loan creates no `loans[]` record (v3.0.34 diagnosis → v3.0.35 fix)

Resolved. Saved G262 had `loans: []` despite a $1.575M bank loan that added cash, so `LOAN_PERCENTAGE` fees (REG-DOB-FEE-REVIEW / REG-FDNY-FEE-REVIEW, "1% of loan") computed against $0 — regulatory fees were effectively free. Fixed v3.0.35 in `ResourceService` by appending a `loans[]` record (principal, interestRate 0, startTurn) when bank-source money is added. Lesson: when a fee formula reads `player.loans[]`, the code that *adds* loan money must also append the loan record. Same trap would bite any future per-loan computation (interest accrual, restructure penalties, etc.) — wire the record at the money-add site, not at the fee site.

### Scope bug — route handlers referencing init-time consts (v3.0.58, recurrence of 95f46f9)

`server/server.js` returned 500 on every `/health` because line 455 referenced `currentVersion`, declared inside `initWritableData()` (line 120) — completely out of scope for the `/health` route handler. Identical bug shape to commit 95f46f9 ("use process.env directly in startup version log, currentVersion is in different scope"), which fixed the same const reference inside the startup log closure. The pattern keeps coming back because `currentVersion` looks like module-scope at a glance, but it's a local const inside an init function — the file has no module-scope version variable at all.

**Fix:** at any consumer site that wants the deployed git commit, read `process.env.VITE_GIT_COMMIT || 'dev'` directly. Don't reach for a perceived shared const.

**Diagnostic:** if a server route 500s with no visible log line and a small per-route change just shipped, grep the file for the const name the route uses. If it's only declared inside another function, that's the bug — even though TypeScript / Node won't warn (server.js is plain JS, ReferenceError at call time only).

**Why this matters for the WebSocket "Offline" indicator class of report:** when investigating "the UI shows offline," `/health` being 500 is a tempting smoking gun, but in this codebase **the WS connection path does not depend on `/health`** — `WebSocketSyncService` connects to `/ws?gameId=...&token=...` independently. Fix the 500 because it breaks `scripts/check-sync.sh` and external monitoring; don't conflate it with WS connectivity. Verify the WS itself by `new WebSocket('wss://.../ws?gameId=...&token=...')` from devtools — if `onopen` fires, the WS path is fine.

### Phantom scrollbars from `overflow: 'auto'` on flex items near container edge (v3.0.60)

Removing `overflowX: 'auto'` from a flex item that's now sized comfortably by its parent eliminates visually-stuck scrollbars that have nothing to scroll. The mechanism: `overflow: auto` reserves scrollbar space in the layout calculation even when content fits, and browsers (Chromium especially) sometimes paint both X and Y bars together once one is reserved. v3.0.59 moved the TV `headerPlayerStrip` from its own full-width second row into `headerTopRow` (sharing space with buttons + auto-dismissing pill); the carried-over `overflowX: 'auto'` made the strip render with thin gray scrollbars on both axes around a chip that was clearly inside its budget. Removing the overflow rule entirely (default `visible`) let flex size naturally and the scrollbars vanished.

**Rule:** when moving a flex child between containers, the overflow rules need to move with it (or get re-evaluated). What made sense on a full-width row (`overflowX: 'auto'` as a safety net) becomes harmful when the same element joins a row that already has constrained space and proper flex shrink/grow rules.

**Audit pattern:** `Grep "overflowX:|overflowY:" path=src/components/layout` after any header/sidebar refactor. Anything still set to `'auto'` after the parent shape changed is suspect.

### DOM bbox check as cheap edge-routing verification (v3.0.56 smart-edge fix verification)

To confirm a smart-edge `nodePadding` bump (or any A* routing change) actually produces non-overlapping edges without playing through to the relevant space, navigate the live deploy via chrome-devtools and measure:

```js
() => {
  const tiles = {};
  document.querySelectorAll('.react-flow__node').forEach(n => {
    const id = n.getAttribute('data-id');
    const r = n.getBoundingClientRect();
    tiles[id] = { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  });
  const target = tiles['CHEAT-BYPASS']; // tile to check non-intersection with
  const cutsThroughTarget = [];
  document.querySelectorAll('.react-flow__edge').forEach(eg => {
    const id = eg.getAttribute('data-id') || eg.id;
    const path = eg.querySelector('.react-flow__edge-path');
    if (!path || !target) return;
    const r = path.getBoundingClientRect();
    const spansV = r.top < target.y && r.bottom > target.bottom;
    const xOverlap = r.right > target.x && r.left < target.right;
    if (spansV && xOverlap) cutsThroughTarget.push(id);
  });
  return { cutsThroughTarget };
}
```

`spansV && xOverlap` catches "path enters above and exits below WHILE touching the tile's horizontal range" — the geometric definition of "cuts through the box." Excludes edges that legitimately terminate at the tile (their bbox extends to the tile but doesn't span beyond it vertically). v3.0.56 verification: `cutsThroughTarget: []` after `nodePadding=30`, with PM-DECISION-CHECK → ARCH-INITIATION's path bbox sitting 11px right of CHEAT-BYPASS's right edge. Faster and more rigorous than a screenshot eye-check, and doesn't require a 10-min playthrough to reach the target space — the board renders all edges (filtered to player's outgoing + path-taken) immediately on game start.

### Case-sensitivity bug class: `effect_action === 'draw_x'` vs CSV `'draw_X'` (v3.0.41–42)

Bit us **three times** in two versions before being audited. CSV stores `effect_action` values with **uppercase** card-type suffixes (`draw_E`, `draw_B`, `draw_I`, `draw_L`, `draw_W`). `DataService.parseSpaceEffectsCsv` loads them **as-is** — no case normalization. JSX/service code that compares with strict equality against a **lowercase** literal (`effect.effect_action === 'draw_e'`) **never matches in production**. The hardcoded fallback (if any) becomes dead code; the surrounding `hasXActions`/`getButtonLabel` logic silently fails closed.

Confirmed dead-code sites (all fixed):
- **FinancesSection.tsx** Owner Funding label (v3.0.41) — `'draw_b' || 'draw_i'` strict check never matched `draw_B`.
- **CardsSection.tsx** EXPEDITORS section badge (v3.0.42) — `'draw_e' || 'replace_e' || 'give_e' || 'return_e'` mixed (`draw_E` uppercase, `replace_e`/`return_e` lowercase in CSV); the upper-suffix entries were dead.
- **EventsSection.tsx** LIFE EVENTS section badge (v3.0.42) — `'draw_l'` strict check never matched `draw_L`.

Note the CSV inconsistency itself: **DRAW** actions are uppercase-suffixed (`draw_E`), while **REPLACE/RETURN** actions are lowercase-suffixed (`replace_e`, `return_e`). The pattern isn't uniform, which is precisely why strict equality is a foot-gun — there's no single rule a developer can memorize.

**Fix pattern (preferred):** lowercase BOTH sides at the comparison.
```ts
const action = effect.effect_action?.toLowerCase() || '';
if (action === 'draw_e' || action === 'replace_e') { ... }
```

**Audit grep when touching SPACE_EFFECTS consumers:**
```
Grep: pattern="effect_action === ['\"]draw_[a-z]['\"]"
```
Any hit is potentially dead code unless the surrounding logic has already been normalized to lowercase.

**Don't try to "fix" the CSV** — too many consumers expect the current casing, and there are similar lower/upper splits elsewhere (e.g. SpaceEffectService's `applyDiceEffect` already lowercases `effect_type` defensively at line 55 pre-purge). Normalize at the read site, not at the source.

**Same trap class to grep periodically:** `=== 'manual'`/`'auto'` against `trigger_type` (currently consistent lowercase, but worth verifying any time you touch SPACE_EFFECTS), `=== 'Self'`/`'All Players'` against card `target` (mixed casing in CSV — these compare case-sensitively in CardService).

---

### E-card activation cost lives in `money_effect`, not `card.cost`

Cards like E030 "Time Crunch" encode their activation spend in the `money_effect` CSV column (e.g. `-8000`), **not** in `card.cost` (which is `0`). The `playCard` affordability check only covered `card.cost`, so pressing Play on an unaffordable E030 silently cascaded 32 RESOURCE_CHANGE failures with no user feedback.

**Pattern:** whenever an E-card seems to "do nothing" when played, check `money_effect` as a potential cost. Any affordability gate must cover BOTH `card.cost` (for cards with a direct cost field) AND `money_effect` (for cards that encode cost as a negative RESOURCE_CHANGE effect).

**Fix location:** `CardService.validateCardPlay` (service layer, pre-effect) + `CardsSection.canPlayCard` (UI layer, pre-button). Both must be kept in sync.

---

### GameLog `turnKey` must include space name

`groupLogEntries` in `GameLog.tsx` originally keyed on `${playerId}-${globalTurnNumber}`. When a player visits two spaces within the same `globalTurnNumber` (e.g. scope space + funding space both logging as global turn 1), all their entries merged into a single `PlayerTurnGroup` — the second space's actions appeared under the first space's header.

**Fix:** key on `${playerId}-${globalTurnNumber}-${spaceName}` where `spaceName` is updated from each `turn_start` entry's `details.spaceName`. Walk entries in timestamp order; on each `turn_start` update the player's current space; all entries until the next `turn_start` inherit that space as part of their key.

**PlayerLogSection is clean** — it uses a different algorithm (boundary on `turn_start` space-change event, not a map key) so this fix doesn't apply there.

---

**Last Updated:** June 4, 2026 (Session **v3.0.65–v3.0.66** — Phase 1 visitType invariant + log-display filter helper, Phase 2.1 movement resolver merge + PlayerActionService dead-code cleanup. Parallel-systems audit now 4 of 7 closed.)
**Charter Version:** 3.30 (added: audit-before-refactor when TODO frames parallel system; grep-for-all-callers surfaces dead code in same commit; `describe.skip` is NOT TypeScript-safe — delete directly. Prior 3.29: parallel-systems audit pattern. Prior 3.28: regen-as-audit, ghost-wire-up-exposes-dead-code.)
