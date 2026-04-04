# Unravel Codes — Beta (v3.0) Plan

**Status:** Draft — awaiting execution
**Started from:** v2.39.5
**Repo:** Same repo (`tomaszsb/Game_alpha` → rename to `Game_beta` as part of Workstream 0)
**Philosophy:** Targeted surgical refactor, not a rewrite. Keep working code; replace the 5 specific subsystems that cause the most pain.

---

## Why not a rewrite

The Alpha is 95% working. Thousands of fixes, edge cases, and school-floor lessons are baked into the current codebase. A from-scratch rewrite would spend months reaching feature parity before adding a single new capability, and would re-discover bugs that have already been fixed. Instead, Beta is a focused v3.0 effort on the same repo that replaces five specific subsystems, each independently valuable and shippable on its own version bump.

---

## The Five Workstreams

### Workstream 1 — Ghost Player (Regression Safety Net) **[DO FIRST]**

**Problem:** The user cannot manually test every space/card/path combination. Silent regressions are inevitable without automation.

**Deliverable:** A headless simulator that plays the game by choosing random valid actions, runs 1,000+ games per CI run, and reports any of:
- Stuck state (no valid actions available mid-game)
- Impossible resource values (`NaN`, negative money past allowed, undefined spaces)
- Unreachable spaces / dead-end loops
- Uncaught exceptions from any service
- Turn count exceeding a sane maximum

**Implementation sketch:**
- New folder `tests/ghost/` with `ghostPlayer.ts` (the bot) and `ghostPlayer.test.ts` (the runner)
- Bootstraps the full game via existing services (no UI, no React) — just `DataService` + `StateService` + `TurnService` + friends
- Picks random valid choices from what `TurnService` exposes as legal moves each turn
- Captures the full action log on failure so the exact sequence is reproducible
- Runs in CI alongside existing vitest suite

**Why first:** Every subsequent workstream benefits from this safety net. Without it, we're guessing whether changes to Try Again, the board, or TurnService broke anything.

**Version bump on ship:** v2.40.0

---

### Workstream 2 — Snapshot-based "Try Again"

**Problem:** The current REAL/TEMP dual-state model in TurnService is complex, hard to reason about, and the user reports it's "not 100% there." Because we can't test every space, silent bugs are likely.

**Deliverable:** Replace the REAL/TEMP logic with a snapshot-based checkpoint system.

**Implementation sketch:**
- On space arrival, `StateService.takeSnapshot(playerId, spaceId)` deep-clones player resources + space state into a named checkpoint
- `Try Again` → `StateService.restoreSnapshot(playerId, spaceId)` restores the clone and truncates any action log entries after that point
- Only one active snapshot per player (current space only) — scope per user's instruction
- Remove REAL/TEMP branches from TurnService, CardService, ResourceService
- All existing Try Again tests must pass against the new mechanism

**Risks:**
- Snapshot must capture *everything* that space effects touch (money, time, cards, scope, loans, modifiers) — an incomplete snapshot is a silent bug
- Must handle mid-space state (e.g., card drawn but not resolved) correctly
- Ghost Player (Workstream 1) will catch missed state

**Version bump on ship:** v2.41.0

---

### Workstream 3 — Living Map (Free-form Coordinate Board)

**Problem:** The current board uses computed grid paths. Arrows don't always match real player movement. The user wants to freely reposition spaces and add new ones without code changes.

**Deliverable:** Coordinate-driven board with dynamic SVG arrows.

**Implementation sketch:**
- Add `pos_x` and `pos_y` columns to `public/data/SOURCE_FILES/Spaces.csv` (default values computed from current layout)
- Update `processGameData.js` to propagate coordinates through to CLEAN_FILES
- New `BoardCanvas.tsx` (or rewrite of BoardV3.tsx) that:
  - Places spaces as absolutely-positioned tiles at `(pos_x, pos_y)`
  - Reads each space's `Destination` connections
  - Draws SVG `<path>` arrows between source and target coordinates
  - Uses curved quadratic paths with basic collision avoidance
  - Shows phase groupings via subtle background regions
- Optional admin mode: drag a space → coordinates save back to CSV via the existing Data Editor flow
- Keep `BoardV3.tsx` working until the new canvas is verified, then delete

**Risks:**
- Arrow routing across long distances / backward jumps will need thought
- Phase boundaries and visual hierarchy need to survive the transition
- Ghost Player must still be able to "see" the board graph through the data layer, not through the rendered DOM

**Version bump on ship:** v2.42.0 (or v3.0.0 if this is the last visible change)

---

### Workstream 4 — TurnService Decomposition

**Problem:** `TurnService.ts` is 2,015 lines. `EffectEngineService.ts` is 1,477 lines. `StateService.ts` is 1,822 lines. These "God Objects" are the biggest source of bug risk and the hardest files to navigate.

**Deliverable:** Split each into focused modules, preserving the DI container and public API so nothing else has to change.

**Implementation sketch for TurnService:**
- `TurnService.ts` (thin orchestrator, ~300 lines — just coordinates)
- `turn/MovementHandler.ts` — dice → destination, path validation, arrival trigger
- `turn/WinConditionHandler.ts` — checks all win/loss states after each turn
- `turn/TurnLifecycleHandler.ts` — start/end turn, player rotation, skip logic
- `turn/CardTriggerHandler.ts` — evaluates which cards fire on current turn events
- Ditto for EffectEngineService (split by effect category) and StateService (split by resource family)
- **Critical rule:** no setter injection, no circular dependencies — use the existing DI container and pass dependencies through constructors. If two modules need each other, extract the shared piece into a third module or an event bus.

**Version bump on ship:** v2.43.0 (pure internal, no user-visible change)

---

### Workstream 5 — Dictionary Integration Polish

**Problem:** Dictionary terms exist but are statically defined. As the external `dictionary-scraper` grows, the game doesn't automatically benefit.

**Deliverable:** Live-fetched dictionary with smart text highlighting.

**Implementation sketch:**
- On game startup, fetch the full term list from the `dictionary-scraper` (already running separately)
- Build a `TextWithTerms` React component that wraps any game text (space descriptions, card text, tooltips) and auto-underlines matching terms
- Proper matching: case-insensitive, word-boundary aware, handles basic plurals (`permit` matches `permits`), skips terms inside other HTML/JSX
- Click an underlined term → modal with the live definition pulled from the scraper
- Cache the term list to avoid per-render rebuild of the regex
- Fall back gracefully to the current static terms list if the scraper is unreachable

**Version bump on ship:** v3.0.0 — the final Beta milestone

---

## Workstream 0 — Prep & Cleanup (this commit)

Before any of the above starts:

1. **Alpha → Beta in-code rename** — UI labels, comments, internal strings. Safe, mechanical.
2. **Archive dead weight** — see "Archive candidates" section below.
3. **Write this plan** (BETA_PLAN_V3.md).
4. **Prune stale git worktree** (`nervous-keller` is marked prunable).

Infra renames (Docker container, `deploy.sh` name, GitHub repo, Unraid folder) are **deferred** until the user explicitly approves — each one has live-deployment implications.

---

## Execution order

1. **Workstream 0** — Cleanup + renames (this session)
2. **Workstream 1** — Ghost Player (next session)
3. **Workstream 2** — Snapshot Try Again
4. **Workstream 3** — Living Map
5. **Workstream 4** — TurnService decomposition
6. **Workstream 5** — Dictionary polish → ship v3.0.0

Each ships on its own version bump. If any workstream reveals that an earlier assumption was wrong, we pause and update this plan before continuing.

---

## Out of scope for Beta

- Teacher dashboard / student review UI (nice-to-have, not blocking)
- Real-time WebSocket replacement (current sync works fine for school scale)
- New tech stack (React + Vite + TypeScript stays)
- State library swap to Zustand (StateService refactor in Workstream 4 is sufficient)
- Multiplayer scale beyond current capability (schools = dozens-hundreds, not thousands)
- Mobile-first redesign
- 3D board

---

## Infra rename (deferred — needs user approval)

The following renames are NOT done in Workstream 0 because they touch live deployment:

| Item | Current | Proposed | Risk |
|---|---|---|---|
| Docker container name | `game_alpha` | `game_beta` | nginx routing on Unraid, feedback volume path |
| `deploy.sh` container refs | `game_alpha` | `game_beta` | Must be coordinated with container rename |
| `docker-compose.yml` service name | `game-alpha` | `game-beta` | — |
| Unraid folder | `/mnt/user/appdata/Game_alpha/` | `/mnt/user/appdata/Game_beta/` | Deploy command changes |
| GitHub repo | `tomaszsb/Game_alpha` | `tomaszsb/Game_beta` | Hardcoded URL in `GameLobby.tsx:51,64` — update check |
| Working directory | `current_game/game_alpha/` | `current_game/game_beta/` | Breaks memory paths, worktrees |

**Recommendation:** do all infra renames together in one coordinated session, with a rollback plan ready. Best timing is right after Workstream 1 ships (so Ghost Player can validate the post-rename build).

---

## Success criteria for v3.0.0 ship

- [ ] Ghost Player runs 1,000 games in CI, zero failures, in under 30s
- [ ] Snapshot Try Again replaces REAL/TEMP entirely; Ghost Player exercises it
- [ ] Board reads positions from CSV; moving a space in CSV updates the rendered board without code changes
- [ ] No service file exceeds 600 lines
- [ ] No setter injection anywhere in `src/services/`
- [ ] Dictionary terms auto-populate from `dictionary-scraper` at startup
- [ ] All existing vitest suites still green
- [ ] Version tag `v3.0.0` pushed
