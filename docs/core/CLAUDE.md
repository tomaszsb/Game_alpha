
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

**Status**: Beta (v2.65.7) — live in production at `https://game.unravelcodes.com`. Workstream 6 (engine-data separation) closed Apr 29, 2026. Workstream 7 (Plan Approval Mechanic) closed May 17, 2026 in v2.65.4. Workstreams 3 (Living Map, Phase D pending) and 5 (Live Dictionary) remain for v3.0.0 ship.

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
├── tests/                        # 101 test files (run via batch script)
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

---

**Last Updated:** May 19, 2026
**Charter Version:** 3.10 (+ diagnostic-logging / CSV pass-through / dead-code-check patterns)
