# Next session starter — written 2026-06-09 by /koniec

## State at handoff
- **Version:** v3.0.70 — **deployed**, live in production.
- **Branch:** master, clean after the /koniec commit (only `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl` local).
- **Last shipped:** No new version. Deployed v3.0.70 + **synced 5 stale CSV data files to the live server** (the data-deploy gap fix). No source-code change.
- **Test suite:** 1628/1628 (unchanged — zero source changes this session). Typecheck + build clean.

## Top 3 open items
1. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af` + L66) — game-level tutorial; biggest remaining product lever.
2. **Teacher instance layer + space catalog** (design initiative) — master-library vs per-instance-config split: makes data-sync a dashboard button AND lets teachers add/remove spaces. Needs a focused brainstorm/spec FIRST (see TODO "Teacher instance layer"). The hard part is reroute rules when a space is toggled off.
3. **Game-length watch** — smart-bot avgTurns=149. Act only when a *real* playtest runs past ~40 min.

## Decisions waiting on the user
- **`.claude/ghost-history.jsonl`** — still untracked. gitignore (per-machine) or commit (cross-machine baseline)?
- **Teacher instance layer** — brainstorm/spec it now, or leave as the tracked design item?

## Suggested first move
The big new thing is the teacher-instance-layer idea — it's the proper fix for the data-deploy gap and unlocks the space catalog. Want to brainstorm/spec that, pick up the onboarding package, or something else?

## Reminders
- Deploy runs from a **Windows** terminal. **`scp` can't resolve the `unraid` ssh alias** (even though `ssh unraid` works) — use explicit `root@192.168.86.57` (password auth).
- **CSV data fixes do NOT auto-deploy** — the live server preserves its writable CLEAN copy. Sync manually; never blind-copy GAME_CONFIG (wipes board layout). Full recipe in CLAUDE.md TACTICAL.
- Server cleanup (optional): `/tmp/migration` + `server/data/game-data/_migration_bak/` can be deleted once the data-sync is confirmed good.
