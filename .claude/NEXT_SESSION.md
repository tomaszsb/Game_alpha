# Next session starter — written 2026-08-04 by /koniec

*(Merged with an intervening session's own 2026-08-04 handoff so nothing from either is lost — see "carried over" items below.)*

## State at handoff
- **Version:** v3.1.95, **confirmed live** via `/health` (commit `8af3a93`).
- **Branch:** master, clean, pushed.
- **Last shipped:** the full G160 board-connector arc, v3.1.90 → v3.1.95 — permanent server-backed redirect handles, multi-bend waypoints scaled by connector length, manual bundling/unbundling, box-side anchor snapping (4 fixed points per tile), an anchor-collision fix (offset-rosette spread reused from bundling), a per-connector restore picker (`RestorablePillDropdown`, shared across both admin surfaces), and a fix for a pre-existing gap (Board Layout Editor had no way to hide a connector). One hotfix along the way (v3.1.92, self-healing schema migration for a live crash). Full detail: CHANGELOG v3.1.90–v3.1.95.
- **Test suite:** fast suite **2646/2646 passing** (175 files). Ghost-gate background run from this session was still finishing at handoff time — check its final result before trusting it as a clean baseline (see below).
- **Build/typecheck:** both clean, run fresh this session.

## Top 3 open items
1. **v3.1.95's hover-highlight + distinct cursor still needs the maintainer's own live test.** Everything else in the G160 arc was confirmed by the maintainer actually dragging/testing in a real browser round after round — this last piece (crosshair cursor on anchor handles + hover-highlighting the owning line) shipped and deployed but hasn't been tried live yet. Asked directly whether to flip the tied feedback report (`fb:feedback-1778327469678-d27a73d0`) resolved; answer was **"i need to test it"** — leave it open until they confirm.
2. **Possible live bug, not just a D&D-reskin blocker: [ApprovalService.ts:213](src/services/ApprovalService.ts:213) docks every winner -30 days/-$50k unless `dobApprovalStatus === 'approved'`, with no way to disable it.** *(Carried over from the 2026-08-03 reskin-feasibility audit — still not independently re-checked against the current, non-reskinned game.)* Is there any win path in the *current* game where a player never touches a DOB space and still gets penalized incorrectly? Full context + 4 more related findings: TODO.md → "Workstream 6 CSV-only-reskin audit."
3. **Demo video** — script + storyboard already drafted; just needs footage, then wire the "Watch demo" button. Not code work.

*(Not top-3, but don't lose it — carried over from the prior handoff: the D&D-skin engagement question is on hold, not stuck. TODO.md's engagement-data item was updated again this window (2026-08-04): the maintainer self-tested a real browser session and confirmed tracking works correctly end to end — the earlier near-zero numbers were test-traffic + too small a real-player sample, not a broken instrument or a real early-quit crisis. Verdict unchanged: not enough real post-launch data yet to judge drop-off either way — revisit `/api/admin/engagement-stats` in a week or two once real traffic accumulates.)*

## Test failures to address
None currently known. If the ghost-gate run (`npm run test:ghost`) that was still in progress at handoff time came back anything other than clean, that's new information this file doesn't yet have — check it first thing.

## Decisions waiting on the user
- **fb:feedback-1778327469678-d27a73d0** — hold until the maintainer confirms the v3.1.95 hover-highlight/cursor work reads clearly in real play (see item 1 above).
- One soft default in play, carried over: TODO.md's `dnd.unravelcodes.com` item assumes D&D CSVs would live in this same repo (a second `public/data-dnd/` folder, build-arg-selected) rather than a separate branch, unless told otherwise — not urgent, that work is still on hold.

## Suggested first move
Ask the maintainer to do the 2-minute v3.1.95 live check (hover an anchor handle near another connector, confirm the crosshair cursor + line highlight, confirm the restore-picker lists connectors by name) — it's the one loose end left on an otherwise-closed feature arc, and closing it lets fb:feedback-1778327469678-d27a73d0 finally flip resolved. Item 2 (DOB penalty) is the next-most-valuable use of time if that's blocked.

## Suggested model for next session
Sonnet 5 — nothing queued needs Opus-level architectural judgment; item 2 is a scoped code-read-then-verify task, item 3 isn't code.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. PowerShell has no `&&` — one command per line.
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- Need admin-gated stats/logs? `ssh -o BatchMode=yes unraid "grep ... /mnt/user/appdata/Game_alpha/server/data/visitors.log"` reads the same data as the password-gated `/api/admin/*` endpoints, no password needed, finer-grained than any dashboard view. See CLAUDE.md TACTICAL.
- If handing the user a `curl` command to run in their own PowerShell: PowerShell's `curl` is `Invoke-WebRequest` in disguise and chokes on `-s`/`-H`. Use `curl.exe` explicitly or write real PowerShell (`Invoke-RestMethod -Headers @{...}`).
- If a drag/click handler on a board-editing feature "looks wired but does nothing," check which admin surface is actually being tested first (in-game toggle vs. standalone Board Layout Editor) before chasing a CSS/JS theory — see the new CLAUDE.md TACTICAL entry from this session.
