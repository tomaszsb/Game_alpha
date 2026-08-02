# Next session starter — written 2026-08-02 by /koniec

## State at handoff
- **Version:** v3.1.88 in the repo, pushed. All the session's actual code fixes were bundle-verified live mid-session at commit `8afb6de`; the version bump + final housekeeping commits (5 decisions resolved, CHEAT-BYPASS test fix) landed *after* that deploy, so a fresh deploy is needed to make `/health`/the setup screen report `3.1.88` — but nothing player-visible is currently un-verified.
- **Branch:** master, clean, pushed.
- **Last shipped:** a dependency-ordered audit of TODO.md's "Architecture / code health" bucket. Most items marked "do NOT do casually" turned out already done by past sessions that never removed the TODO line (ActiveEffect typing, notification-bus unification, TEMP/REAL TurnTransaction boundary). The verification passes themselves surfaced 3 real bugs: `discardCards` dropping its audit-trail text, a `getGameState()` performance trap, and `expenditures.fees` never being tracked (the player's own "Regulatory & filings" ledger line was stuck at $0). Also resolved 5 decision-gated TODO items with the maintainer and scoped a new engagement-tracking feature.
- **Test suite:** fast suite 2548/2548 passing. Ghost gates: started in background at session close — check `.claude/tmp` or re-run `npm run test:ghost` if the result wasn't captured before context ended; last confirmed-green run this session was 33/33 (all 4 variants) after the `getGameState()`/`DataService` changes.
- **Build/typecheck:** both clean.

## Top 3 open items
1. **G160: per-edge waypoint redirect** — maintainer approved 2026-08-02, not yet scoped. Redirects a specific auto-routed board connection; see BETA_PLAN_V3.md for original context.
2. **In-game engagement tracking** — freshly scoped 2026-08-02 as a ready-to-build spec (see TODO.md "External testing & release"): track space-reached/finish/abandon + opens of the existing help panels, keyed to pseudonymous ids. Reuses the existing `PLAYTEST_EVENTS`/`logVisitor` pattern.
3. **Demo video** — script + storyboard drafted; needs footage, then wire the "Watch demo" button.

## Test failures to address
None. Fast suite green; ghost gate was still running at session close (see above).

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**

## Suggested first move
Both G160 and the engagement tracking are freshly approved/scoped and ready to build — neither needs more design discussion first. Pick whichever interests you more, or ask which is more urgent. If you haven't redeployed since the version bump, a fresh `bash deploy.sh` run would make the live version string match the repo (purely cosmetic — the actual fixes are already live).

## Suggested model for next session
Sonnet 5 — both top-3 items are straightforward feature-building from an already-scoped spec, not architecturally ambiguous work.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. PowerShell has no `&&` — one command per line.
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- If `/start` shows the repo version as `3.1.88` but `/health` on the live site still says an older commit, that's expected until the next deploy — see "State at handoff" above.
