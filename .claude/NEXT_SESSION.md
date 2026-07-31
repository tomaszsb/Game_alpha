# Next session starter — written 2026-07-31 by /koniec

## State at handoff
- **Version:** v3.1.80 — **deployed and verified live** 2026-07-31 (bundle-grepped: live `index-*.js` embeds `"3.1.80"` and commit `5eba257`, current master HEAD — this includes the `/koniec` docs commit, since nothing shipped after it). Covers v3.1.77 (clipboard-copy fix), v3.1.78 (CSP/HSTS/Permissions-Policy headers), v3.1.79 (dead-code cleanup), v3.1.80 (`set-state-in-effect` refactor).
- **Branch:** master, clean, pushed.
- **Last shipped:** `set-state-in-effect` 34→18. Researched the rule properly (React's own docs, the `useSyncExternalStore` migration path, a live upstream false-positive report) before touching code, then read all 34 flagged sites individually rather than assuming the 2026-07-29 audit's 9/3/22 split. 16 got a real fix (7 subscribe-to-store sites → new `useSyncedGameState` hook; 7 derive-from-props sites → render-time computation; `GameLayout`'s notification-clearing transition logic → `useRef`-based detector, covered by 5 new dedicated tests). The remaining 18 are individually documented in `eslint.config.js`, not left by default — `BoardCanvas`'s site is the exact fix for two previously-shipped bugs and stays untouched on purpose.
- **Test suite:** fast suite **2501 passed / 1 skipped / 0 failed** (170 files; the skip is pre-existing) and ghost gates **33/33** (10 files, 573.83s). Both green.
- **Build/typecheck/lint:** all clean. Lint: 0 errors / 37 warnings (19 pre-existing `no-explicit-any` + 18 `set-state-in-effect`, both fully accounted for).

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **Live-verify `SpaceExplorerPanel` and `TVDisplay` on real hardware/a real playtest.** Both got this session's `set-state-in-effect` fix (same pattern already proven live in six other components, clean typecheck) but couldn't be live-browser-verified this session — the former is reachable only through a narrow playtest-tour deep link that didn't reproduce cleanly here, the latter needs a second device past TV mode's "all phones must connect" hard-block.
2. **Player-to-player trading is built and unreachable — card first, button second.** Unchanged. Needs a card written that hands something to another player (none of the 399 do today) before any wiring work; a top-bar button would permit off-turn trading since `NegotiationService` has zero turn awareness.
3. **Homeowner violation mechanic — needs a real spec before engineering.** Shape sketched 2026-07-25 (civil penalties, owner records, Affidavit of Correction process); still needs a fuller turn-by-turn spec before engineering starts.

## Test failures to address
None. Both suites green.

## Decisions waiting on the user
- **Trading:** write the card content that triggers it, or leave shelved?
- **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review). Human review, not a code task.
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key rotation** — maintainer declined; still exposed via git history whenever that changes.
- **Homeowner violation mechanic** — shape sketched 2026-07-25, needs a fuller turn-by-turn spec before engineering.

## Flip after deploy
None — both queued reports (TV-mode glossary, clipboard-copy) already flipped resolved 2026-07-31 after this deploy confirmed live. Dashboard steady at **7 open**, all tracked.

## Suggested first move
Tree is clean, nothing blocked, and v3.1.80 is live. Either the `SpaceExplorerPanel`/`TVDisplay` real-hardware check, or start on trading's card content if you're ready to write that.

## Suggested model for next session
Sonnet 5 — nothing in the top-3 needs deep architectural judgment; deploying and a real-hardware check are execution work, and card-content authoring is taste, not reasoning depth.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line.
- **`useSyncedGameState` (new, `src/hooks/useSyncedGameState.ts`) is now the pattern for any component that needs to read StateService.** Don't hand-roll a new `useState`+`useEffect(subscribe)` site — it reintroduces exactly the lint warning this session spent its effort clearing. See the hook's own doc comment and the new CLAUDE.md TACTICAL entry for why `StateService.getGameState()` can't be passed straight in as `useSyncExternalStore`'s snapshot function.
- **`BoardCanvas.tsx`'s `set-state-in-effect` warning is permanent and intentional** — see the inline comment right above the flagged effect before "fixing" it.
- **Never `taskkill /F /IM node.exe`** — it kills all MCP servers too. Kill by PID from `netstat -ano`, and never send a destructive command's output to `/dev/null`.
- E2E decks are seeded (`E2E_SEED=<n>`, default `20260728`); `bash scripts/sweep-e2e-seeds.sh 1 25` hunts bad seeds.
