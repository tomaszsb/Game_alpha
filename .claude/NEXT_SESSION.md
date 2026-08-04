# Next session starter — written 2026-08-04 by /koniec

## State at handoff
- **Version:** v3.1.89 in the repo, pushed. **Still not yet deployed** — unchanged from last session, nothing shipped today to change that.
- **Branch:** master, clean, pushed (this session was docs/TODO only — no source changed).
- **Last shipped:** nothing — pure investigation session. Audited whether a D&D-themed CSV-only reskin is actually feasible (found real bugs, see below), checked the new engagement-tracking data before building anything, and formalized a "research first, push back on scope creep" working style directly into `docs/core/CLAUDE.md` + `docs/technical/ARCHITECTURE.md`.
- **Test suite:** not run — zero-game-source session (only `TODO.md`/`CLAUDE.md`/`ARCHITECTURE.md` touched), per the skill's explicit skip rule. Last known green baseline: 2563/2563 + ghost 33/33 (2026-08-02, v3.1.89 session).
- **Build/typecheck:** both clean, run fresh this session.

## Top 3 open items
1. **Possible live bug, not just a D&D-reskin blocker: [ApprovalService.ts:213](src/services/ApprovalService.ts:213) docks every winner -30 days/-$50k unless `dobApprovalStatus === 'approved'`, with no way to disable it.** Found while auditing reskin-feasibility, but worth checking on its own: is there any win path in the *current* game where a player never touches a DOB space and gets penalized incorrectly? Full context and 4 more related findings: TODO.md → "Workstream 6 CSV-only-reskin audit."
2. **G160 real-browser confirmation — still outstanding, now carried over two sessions.** Code's been clean (typecheck/build/tests) since 2026-08-02; nobody has actually dragged the edge-redirect handle in a live browser yet. Five-minute check: board edit mode → hover an edge → drag the handle at its midpoint → confirm it bends through that point → double-click to confirm it resets.
3. **Demo video** — script + storyboard already drafted; just needs footage, then wire the "Watch demo" button. Not code work.

*(Not top-3, but don't lose it: the D&D-skin engagement question is genuinely on hold, not stuck — real post-launch traffic is still too thin to judge drop-off. Re-check `/api/admin/engagement-stats` in a week or two; TODO.md's top item has the full reasoning.)*

## Test failures to address
None — suite wasn't run this session (see above), no known new failures.

## Decisions waiting on the user
None blocking. One soft default in play: TODO.md's `dnd.unravelcodes.com` item assumes D&D CSVs would live in this same repo (a second `public/data-dnd/` folder, build-arg-selected) rather than a separate branch, unless told otherwise — not urgent since that work is on hold anyway.

## Suggested first move
Worth 10 minutes on item 1 above before anything else — if the DOB penalty really can misfire in the current game (not just a hypothetical D&D one), that's a live-game bug outranking everything else in this file. If it checks out clean, G160's real-browser confirmation is the next quickest win.

## Suggested model for next session
Sonnet 5 — item 1 is a scoped code-read-then-verify task, item 2 is a manual browser check, item 3 isn't code. Nothing here needs Opus-level architectural judgment.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. PowerShell has no `&&` — one command per line.
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- Need admin-gated stats/logs? `ssh -o BatchMode=yes unraid "grep ... /mnt/user/appdata/Game_alpha/server/data/visitors.log"` reads the same data as the password-gated `/api/admin/*` endpoints, no password needed, finer-grained than any dashboard view. See CLAUDE.md TACTICAL.
- If handing the user a `curl` command to run in their own PowerShell: PowerShell's `curl` is `Invoke-WebRequest` in disguise and chokes on `-s`/`-H`. Use `curl.exe` explicitly or write real PowerShell (`Invoke-RestMethod -Headers @{...}`).
