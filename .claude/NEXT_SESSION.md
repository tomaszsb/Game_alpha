# Next session starter — written 2026-07-09 by /koniec

## State at handoff
- **Version:** v3.0.100 — **pending deploy** (pushed to origin/master, not yet deployed).
- **Branch:** master, clean (wrap-up commit pending — see step 5c of this run).
- **Last shipped:** One bug report ("nothing showed me the plan examiner verdict") unraveled into 6 real fixes via root-cause chasing: a buried-text bug, the real cause underneath it (REGULATORY-phase dice auto-rolls with no button and discarded its result), a `{fundingAmount}` token leak generalized to all three funding spaces, a silent DOB/FDNY approval-revoke path, and the big one — `PlayerPanelV2` (default panel since v3.0.97) never rendered the `playerNotification` prop, so every toast notification app-wide has been invisible for weeks. Also fixed a foreign-game-alert false-positive on every deploy restart, and reserved "approve" language for DOB/FDNY only. 14 dashboard reports closed. Full detail in CHANGELOG v3.0.100.
- **Test suite:** typecheck + build clean. Full suite (backgrounded, ~10.6 min — ghost-bot simulations run 50 games each): **2340/2341 passing, 1 skipped**, matching the pre-session baseline exactly.

## Top 3 open items
1. **6x duplicate `subscribeToAutoActions` firing** — every auto-action event fires 6 times instead of once, confirmed even on a fresh browser session. Currently harmless (handlers are idempotent) but worth root-causing before a non-idempotent one is added. Spawned as background task `task_bb6cec79` this session; see TODO.md for investigation candidates (StrictMode double-invoke, duplicate GameLayout mounts, unsubscribe not detaching).
2. **Host-to-player messaging** — no channel exists to send a message into a live game. Needs its own design pass first: who can send, free text vs. presets, does it interrupt play.
3. **Bank/Investor/Lender have no character entry** — 6 board spaces still show phase-only labels. User is explicitly marinading on whether to invent names/colors — don't nudge, wait for them to bring it back up.

## Test failures to address
(None — pre-flight is fully green.)

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** (see item 3) — parked at the user's request, no urgency.

## Suggested first move
Deploy v3.0.100 (`bash deploy.sh` from a Windows terminal) — it's pushed to origin but not yet live. After that, ask which of items 1–2 to tackle, since neither was prioritized this session.

## Suggested model for next session
**Sonnet 5.** This session was almost entirely root-cause debugging (chasing one report through 5 layers, tracing a race condition via diagnostic logging) — exactly Sonnet's strength, and item 1 (the 6x subscription investigation) is the same shape of work. Nothing in the top-3 needs Opus-level architectural judgment or a long unsupervised run.

## Reminders
- Deploy runs from a **Windows terminal**, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- New CLAUDE.md TACTICAL entries this session worth knowing before doing more live-verification work: state-injection teleport testing can't exercise client-computed-then-persisted UI-gating fields (`requiredActions`, `availableActionTypes`, `movementChoiceUnlocked`) — a real playthrough is required to test anything gated by those. Also: a prop can type-check on a shared Props interface while one panel implementation silently never renders it (how the `playerNotification` gap was found) — worth the same audit if the two panels are ever suspected to have drifted again.
