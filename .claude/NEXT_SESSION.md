# Next session starter — written 2026-07-31 by /koniec

## State at handoff
- **Version:** v3.1.85 in the repo. **v3.1.84 confirmed live** (setup screen's badge read `v3.1.84 · 4eb984c` when checked this session). **v3.1.85 pushed, not yet deployed** — screenshot-carousel assets only, no gameplay code, low urgency.
- **Branch:** master, clean, pushed.
- **Last shipped:** the Homeowner Violation mechanic (v3.1.84 — new L050/L051 life-event cards, corrective Work Package + civil penalty scaled to on-time/late Affidavit filing), then two gaps closed same day found in self-review (EndGameModal violation section, TurnTransitionHandler's first-ever dedicated test file), then the playtester screenshot carousel finished (v3.1.85).
- **Test suite:** fast suite **2549 passed / 1 skipped / 0 failed** (172 files) and ghost gates **33/33** (10 files, 641s). Both green.
- **Build/typecheck/lint:** all clean. Lint: 0 errors / 35 warnings (unchanged baseline).

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **Deploy v3.1.85 to the live game** whenever convenient — just refreshes the `/challenge` screenshot carousel, no gameplay risk.
2. **Recruit 3–5 external players for a structured UAT pass** — the `/challenge` funnel + QR codes have been ready since April; this is outreach, not code.
3. **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review) — human review, not a code task. Approve at the dashboard's candidates page.

## Test failures to address
None. Both suites green.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key history purge** — declined 2026-07-26, key was rotated instead; the old (now-dead) key stays in git history unless the maintainer decides the cleanliness is worth a `git filter-repo` disruption.

## Flip after deploy
None — no dashboard reports were closed this session.

## Suggested first move
Tree is clean, nothing blocked. Either deploy v3.1.85, or start on a new TODO.md item — the active list (screenshot carousel and dictionary-scraper labeling) is now empty of anything with a clear next action; next would be picking something from the Parking lot with the user, or starting UAT outreach.

## Suggested model for next session
Sonnet 5 — nothing in the top-3 needs deep architectural judgment; deploying and outreach are execution/logistics work.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line.
- **A separate repo, `D:/Unravel/dictionary-scraper` (the dashboard.unravelcodes.com admin tool), got real work this session too** — an AI-generated-label fix, plus a significant git/deploy reconciliation (Unraid's git checkout was 7+ commits behind and had real drift; now clean except the long-known intentional `docker-compose.yml` hardening). **Before touching ANY file on that server again, `ssh unraid "cd /mnt/user/appdata/dictionary-scraper && git diff <file>"` first** — see memory `project_dictionary_scraper_deploy` for the full story (a blind overwrite nearly deleted a real, working nightly job this session).
- The exposed GitHub token in that server's git remote is gone (switched to the already-provisioned SSH deploy key) — but the old token itself is still technically valid until revoked at github.com/settings/tokens, if that's wanted.
- **`useSyncedGameState` (`src/hooks/useSyncedGameState.ts`) is the pattern for any component reading StateService.** Don't hand-roll `useState`+`useEffect(subscribe)`.
- **New pattern this session, documented in CLAUDE.md TACTICAL:** reach into the live app's real `gameServices` from the browser console via a React fiber walk (any DOM node → `__reactFiber$<key>` → walk `.return` for `memoizedProps.gameServices`) to call real service methods directly — faster than the HTTP state-push recipe, no gameId/token needed, and it's what unblocked both the violation-mechanic live verification and the screenshot carousel's won/lost/mid-game shots.
- **Never `taskkill /F /IM node.exe`** — it kills all MCP servers too. Kill by PID from `netstat -ano`.
