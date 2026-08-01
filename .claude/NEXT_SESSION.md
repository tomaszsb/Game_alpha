# Next session starter — written 2026-08-01 by /koniec

## State at handoff
- **Version:** v3.1.86 in the repo. **v3.1.85 confirmed live** (bundle-verified mid-session: `game.unravelcodes.com`'s served `index-*.js` embeds commit `562f9d1`, which is this session's own work — the version *label* just hadn't caught up yet at deploy time). v3.1.86 is pushed, not yet redeployed, but it changes zero runtime code (test script + docs only) — no urgency.
- **Branch:** master, clean, pushed.
- **Last shipped:** an audit-then-fix session, not a feature sprint. A prior session left 5 AI-generated analysis reports uncommitted; verified each claim against real evidence rather than trusting them (about half held up). Real fix: `tests/scripts/run-tests-batch-fixed.sh` had 16 dead paths, silently hard-failing 5 of 23 batches every run — repaired, verified 22/22 green. Four docs refreshed for real content drift (3 months stale on three of them), not just date bumps — biggest find was `USER_MANUAL.md` still describing the deleted classic player panel. 2 dead source files archived, a `.gitignore` gap fixed, ~11.5MB of confirmed-safe local disk clutter cleaned.
- **Test suite:** fast suite **2549 passed / 1 skipped / 0 failed** (172 files) and ghost gates **33/33** (10 files, 632s). Both green, both match the exact prior baseline — zero regressions from the archive move or script fix.
- **Build/typecheck/lint:** all clean. Lint: 0 errors / 35 warnings (unchanged baseline).

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **`API_REFERENCE.md`'s REST API table only documents ~13 of ~55 real routes** — accounts/login, Teacher Layer instances, admin, and playtest tracking are entirely undocumented. Real work (each route needs its handler read individually), found and scoped this session.
2. **`.swcrc` + `@swc/core` look like dead Jest-era leftovers** — unconfirmed, touches a real `package.json` dependency so wasn't removed blindly. ~10-15 min investigation when picked up.
3. **Recruit 3–5 external players for a structured UAT pass** — the `/challenge` funnel + QR codes have been ready since April; this is outreach, not code.

## Test failures to address
None. Both suites green.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key history purge** — declined 2026-07-26, key was rotated instead; the old (now-dead) key stays in git history unless the maintainer decides the cleanliness is worth a `git filter-repo` disruption.

## Flip after deploy
None — no dashboard reports were closed this session (this session touched docs/tests/hygiene, not gameplay).

## Suggested first move
Tree is clean, nothing blocked, nothing urgent. Either pick up one of the top-3 items (the API_REFERENCE.md REST gap is the meatiest — probably wants its own dedicated pass, similar in shape to this session's doc-refresh agents), or start on UAT outreach, or pick something fresh from TODO.md's Parking lot with the user.

## Suggested model for next session
Sonnet 5 — nothing in the top-3 needs deep architectural judgment; the REST API doc gap is mechanical-but-tedious (read ~40 route handlers), UAT outreach is logistics.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line, or use `Remove-Item -Force item1, item2` style multi-arg calls instead of chaining.
- **Local `server/data/` is NOT the production copy** — `deploy.sh` mounts a separate volume from the Unraid host's own checkout. Confirmed safe to clean up local dev-server logs without any production impact; see CLAUDE.md TACTICAL (2026-08-01 entry).
- **Before trusting any AI-generated audit/cleanup report** (this session's starting point), spot-check its specific claims against real grep/read evidence — several were right, several were confidently wrong (e.g. `vitest.config.ts` called "redundant" when it's the real default config).
- **`useSyncedGameState`** (`src/hooks/useSyncedGameState.ts`) is the pattern for any component reading StateService. Don't hand-roll `useState`+`useEffect(subscribe)`.
- **Never `taskkill /F /IM node.exe`** — it kills all MCP servers too. Kill by PID from `netstat -ano`.
