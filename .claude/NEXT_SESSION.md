# Next session starter — written 2026-08-02 by /koniec

## State at handoff
- **Version:** v3.1.89 in the repo, pushed. **Not yet deployed** — live site is still v3.1.88. Nothing player-visible from this session is unverified except G160's drag interaction (see below).
- **Branch:** master, clean, pushed.
- **Last shipped:** closed the last open naming decision (Bank/Investor/Lender board characters), then built both top-3 items from the v3.1.88 handoff: G160 (per-edge board-connector redirect — drag a handle to bend an auto-routed line through one point) and in-game engagement tracking (space-reached/game-finished/panel-opened, reusing the existing acquisition-funnel pipeline; `game_abandoned` is inferred at aggregation time rather than tracked live, since an unload beacon is unreliable).
- **Test suite:** fast suite 2563/2563 passing (173 files). Ghost gates 33/33 clean (all 10 files, ~14 min).
- **Build/typecheck:** both clean.

## Top 3 open items
1. **G160 real-browser confirmation** — code is done (typecheck/lint/build/tests all clean) but never visually verified: this session's Browser pane wasn't compositing frames at all (confirmed via a clean git-revert A/B test — even unmodified baseline code showed zero board edges in that same pane, so it's a tool limitation, not a regression). Needs one real playthrough in board-edit mode: grab the small handle at an edge's midpoint, drag it, confirm the line bends through that point; double-click the handle to confirm it resets. See TODO.md.
2. **Demo video** — script + storyboard drafted; needs footage, then wire the "Watch demo" button.
3. **Deploy v3.1.89** — whenever convenient. Nothing urgent is riding on it; the version bump plus this session's two features are the only thing not yet live.

## Test failures to address
None. Fast suite green; ghost gate was still running at session close (see above).

## Decisions waiting on the user
None open.

## Suggested first move
If you have 5 minutes with a real browser, confirm G160's drag handle actually works — that's the one loose end from this session. Otherwise, demo video footage is the only other top-3 item, and that's on you, not code. If neither appeals, TODO.md's Parking lot has real, trigger-gated work whenever one of those triggers fires.

## Suggested model for next session
Sonnet 5 — nothing in the top-3 is architecturally ambiguous; it's either a 5-minute manual check or work that isn't code at all.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. PowerShell has no `&&` — one command per line.
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- If testing admin-gated UI (board editor, G160) locally, `.env`'s `ADMIN_PASSWORD_HASH` isn't read by `npm run server` — either set it inline (`ADMIN_PASSWORD_HASH=<hash> node server/server.js`) or use `sessionStorage.setItem('admin_authenticated','true')` in the browser console. See CLAUDE.md TACTICAL.
