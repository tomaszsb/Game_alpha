# Next session starter — written 2026-07-18 by /koniec

## State at handoff
- **Version:** v3.1.16 — **pending deploy** (last confirmed-live is v3.1.10; v3.1.11–16 queued).
- **Branch:** master, truly clean — the eternal phantom `settings.local.json` "modified" is gone (file untracked in `e2ddc65`).
- **Last shipped:** third block of 2026-07-18 was docs/repo hygiene, no code: every .md/mockup audited against code (4 completed docs archived, open leftovers promoted to TODO, BETA_PLAN criteria closed), 6 stranded agent worktrees + branches removed with the root cause fixed (settings.local.json untracked), GitHub pruned to master-only, `/start`+`/koniec` now carry the worktree sweep.
- **Test suite:** skipped this block per zero-game-source rule — baseline is today's runs: fast suite 2357/2358 (1 pre-existing skip, 98s, 19:35) + ghost gates green (smart-bot 50/50 deterministic, 0 hard failures, 20:22).
- **Build/typecheck:** clean (re-run this block, both green).

## Top 3 open items
1. **Deploy v3.1.10 → v3.1.16** — six versions queued. Command in Reminders.
2. **TVDisplay dark mode — needs your call, not a code fix.** Shared across-the-room TV screen: does it even want a dark toggle, and who operates it? (Board chrome itself was themed in v3.1.15; TVDisplay is the deliberate holdout.)
3. **Real-TV confirmation of the v3.1.2 camera fix** — 2-minute glance at the physical TV; can double as the deploy sanity check once v3.1.16 is live.

## Decisions waiting on the user
- **Board layout** — keep stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 2.

## Suggested first move
Deploy is still the highest-value step — six versions including a production bug fix (card-draw log formatter) have sat committed all day. After it's confirmed live, the TV camera check (item 3) closes two loops in one trip to the living room.

## Suggested model for next session
Sonnet 5 — deploy handoff, a design question, and a manual TV check; nothing architecturally ambiguous.

## Reminders
- Deploy from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The deploy's `git pull` will delete the server's copy of `.claude/settings.local.json` — expected and harmless (Claude-Code-only config, never in the Docker image).
- `narratives-draft.md` holds ~90 never-merged authored narratives (see TODO "Story authoring rollout") — needs a voice-rule pass before merging, if you feel like content work.
