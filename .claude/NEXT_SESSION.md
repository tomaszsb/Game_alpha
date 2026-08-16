# Next session starter — written 2026-08-16 by /koniec

## State at handoff
- **Version:** v3.2.9 — deployed and confirmed live. No app version shipped this continuation (infra/ops only, no `src`/`server` changes).
- **Branch:** master, clean, pushed (only untracked scratch file `idea.txt` at repo root — a maintainer draft, not touched).
- **This session:** finished the Docker-side half of the IPv6 false-foreign-alert fix left open at the prior handoff — `game-net` recreated with `--ipv6 --subnet`, confirmed live via `docker logs game_alpha` showing a real auto-detected home IPv6 address. The whole multi-session fix is now closed end to end. Along the way, an attempt to also set IPv6 via `/etc/docker/daemon.json` collided with flags Unraid's own `rc.docker` already passes to dockerd, briefly crashing Docker and taking every container on Tower down — recovered via a pre-made config backup (full trap in CLAUDE.md TACTICAL). Recovery surfaced an unrelated, pre-existing bug: `cloudflare-tunnel` had a literal unfilled `YOUR_TOKEN_HERE` placeholder as its token and had been crash-looping for at least 12 days undetected, silently taking `game`/`dashboard`/`api`/`photos.unravelcodes.com` offline from outside — fixed with a real token, all four confirmed reachable again. `deploy.sh`'s network-create line now always requests `--ipv6`/`--subnet` so a future accidental network removal can't silently regress the fix.
- **Test suite:** no test run this continuation (zero-game-source session — only `TODO.md`/`deploy.sh`/`CLAUDE.md`/`PROJECT_STATUS.md` changed). Last full-suite baseline: 2747/2747 (187/187 files), from earlier the same day, unaffected by anything this continuation touched. Typecheck + build re-verified clean just now.
- **Build/typecheck:** both clean.

## Top 3 open items
1. **G160 restore-picker + hover-highlight (v3.1.95)** — code-complete and deployed, just needs your own real-browser confirmation it feels right. Closes fb:feedback-1778327469678-d27a73d0.
2. **D&D-reskin engagement data — still thin, revisit after another 2-3 weeks of traffic.** Current read: 4 of 9 real games since tracking went live never get a second player. Recommend keeping the reskin on hold, treating join/invite friction as the real blocker. Full detail: TODO.md.
3. **Con-Initiation crash + next-action-button highlight — both still open, no telemetry can settle either.** Both need a direct real-play repro from you. The diagnostic capture mechanism for a future crash already exists (global error capture auto-attaches to any in-game "Report a bug" submission) — nothing left to build there, just needs someone to hit that button right when/after it happens. Full detail: TODO.md.

## Test failures to address
None. Last real run was green throughout.

## Decisions waiting on the user
None new.

## Suggested first move
Nothing urgent — all three top items are "wait for confirmation/signal" states, not active code work. If you get a spare minute in a real browser, item 1 (G160) is the quickest to actually close out. Otherwise, worth a passing thought: today's `cloudflare-tunnel` outage (item flagged in TODO.md's "Reliability / plumbing" parking lot) sat undetected for 12+ days purely by luck — no rush, but a free external uptime check would catch the next one in minutes instead of by accident.

## Suggested model for next session
Sonnet 5 — nothing in the top-3 needs deep architectural judgment; it's confirmation/investigation work, standard territory.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Hand this to the maintainer — don't run it yourself (deploy-handoff rule).
- **Never `taskkill /F /IM node.exe`** — kills all MCP servers too. Kill by PID from `netstat -ano`.
- **This session's safety classifier hard-blocks live host-network/Docker-daemon changes on the remote Unraid host even with explicit in-chat permission.** Don't retry — hand the exact command to the user, verify read-only afterward. Confirmed again this session (same as the earlier `accept_ra=2` finding).
- If a Docker daemon restart on Tower ever fails again, check `/var/log/docker.log` for the real reason — `rc.docker`'s own console output only says "Failed."
- `idea.txt` at repo root is an untracked maintainer scratch file. Left alone.
