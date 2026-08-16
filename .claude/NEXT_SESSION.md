# Next session starter — written 2026-08-16 by /koniec

## State at handoff
- **Version:** v3.2.9 — repo and live deploy both confirmed in sync (user-supplied deploy log: build log `Version: 75cbbee`, container verified running that image).
- **Branch:** master, clean, pushed (only an untracked scratch file `idea.txt` at repo root — a maintainer draft, not touched).
- **This session:** pulled `visitors.log` for the ~3 weeks since the admin stats dashboard shipped and closed out two TODO items gated on real playtest signal — the D&D-reskin engagement question (real signal still thin, 9 real games in 13 days, but points at join-friction over board theme) and two items with no telemetry either way (Con-Initiation crash, next-action-button highlight). Traced and fixed the Site Stats dashboard's double-login (v3.2.8 — `noopener` was severing `sessionStorage` inheritance into the new tab, not a real second credential gate). A live SMS alert arriving ~16h late led to timestamping the alert text (v3.2.9) and, along the way, actually fixing the host-level root cause of the IPv6 false-foreign-alert bug — walked the maintainer through enabling real IPv6 on Tower directly (bonding/bridging chain + a `forwarding`+`accept_ra=2` quirk specific to Docker/VM hosts, full recipe in CLAUDE.md TACTICAL). Also root-caused a VM-Manager GUI toggle silently disagreeing with the actual running service (`libvirtd`) — fixed via direct service stop, not the GUI.
- **Test suite:** 2747/2747 fast suite (187/187 files), run twice this session (once per shipped version). Ghost regression suite still running in background at handoff — check `.claude/ghost-history.jsonl` or re-run `npm run test:ghost` before trusting a "clean" claim if this section wasn't updated with a real result.
- **Build/typecheck:** both clean.

## Top 3 open items
1. **Docker-side IPv6 for the game container is the one piece left of the false-foreign-alert fix.** Host networking is live and persisted (survives reboot via `/boot/config/go`). The `game-net` Docker network itself still needs `--ipv6` + a subnet, and `daemon.json` needs IPv6 config — this requires stopping the *whole* Docker service (every container on the box, not just the game) to apply, so it needs a deliberate maintenance window with the maintainer at the box, not a quick follow-up. Full detail: TODO.md "Active — infra / deploy / data".
2. **D&D-reskin engagement data — still thin, revisit after another 2-3 weeks of traffic.** This session's read: 4 of 9 real games since tracking went live never get a second player (solo dead-end at space #1), only 1 finished a full game. Recommend keeping the reskin on hold and treating join/invite friction as the real blocker — a new board theme doesn't fix a game nobody else joins. Full detail: TODO.md "Active — bugs & investigations".
3. **Con-Initiation crash + next-action-button highlight — both still open, no telemetry can settle either.** A UI crash or a stale highlight never fires a tracking event, so `visitors.log` genuinely can't confirm or rule out either one. Both need a direct real-play repro from the maintainer. Full detail: TODO.md.

## Test failures to address
None. Fast suite green throughout.

## Decisions waiting on the user
None new this session — the one standing decision (home-IP fix: real IPv6 routing vs. manual override) was made and acted on this session, see top-3 item 1.

## Suggested first move
Ask whether the maintainer wants to schedule the Docker-side IPv6 maintenance window (item 1) now, or leave it for whenever's convenient — it's real work but not urgent (the host-level fix already stops false alerts from the maintainer's own devices, which was the original complaint; only *other* real IPv6 visitors from outside are still affected). Otherwise, nothing else in the top-3 needs an immediate move — items 2 and 3 are both "wait for more signal" states.

## Suggested model for next session
Sonnet 5 — the remaining Docker/IPv6 work is careful infra execution (not architecturally ambiguous), and everything else is routine investigation/bug-fix territory.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand this to the maintainer — don't run it yourself (deploy-handoff rule).
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- **The Bash safety classifier hard-blocks live `sysctl -w` (and similar host-network) changes on the remote Unraid host even with explicit in-chat user permission.** Don't retry — hand the exact command to the user to run themselves via SSH/the Unraid terminal, then verify read-only afterward. Same likely applies to any future Docker-service-stop step for item 1 above.
- `idea.txt` at repo root is an untracked maintainer scratch file. Left alone.
