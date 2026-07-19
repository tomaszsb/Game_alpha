# Next session starter — written 2026-07-18 by /koniec

## State at handoff
- **Version:** v3.1.16 — **deployed + confirmed live 2026-07-18** (`v3.1.16 · 9095413`, built from HEAD).
- **Branch:** master, truly clean — the eternal phantom `settings.local.json` "modified" is gone (file untracked in `e2ddc65`).
- **Last shipped:** third block of 2026-07-18 was docs/repo hygiene, no code: every .md/mockup audited against code (4 completed docs archived, open leftovers promoted to TODO, BETA_PLAN criteria closed), 6 stranded agent worktrees + branches removed with the root cause fixed (settings.local.json untracked), GitHub pruned to master-only, `/start`+`/koniec` now carry the worktree sweep.
- **Test suite:** skipped this block per zero-game-source rule — baseline is today's runs: fast suite 2357/2358 (1 pre-existing skip, 98s, 19:35) + ghost gates green (smart-bot 50/50 deterministic, 0 hard failures, 20:22).
- **Build/typecheck:** clean (re-run this block, both green).

## Top 3 open items
1. **Real-TV checks** — v3.1.16 is live: confirm the v3.1.2 camera feel (zoom stays put between moves) and eyeball the new dark-mode slices, one trip to the TV.
2. **TVDisplay dark mode — needs your call, not a code fix.** Shared across-the-room TV screen: does it even want a dark toggle, and who operates it? (Board chrome itself was themed in v3.1.15; TVDisplay is the deliberate holdout.)
3. **Story authoring** — ~90 never-merged narratives in `narratives-draft.md` (docs-sweep find); needs a voice-rule pass + format adaptation before merge (see TODO "Story authoring rollout").

## Decisions waiting on the user
- **Board layout** — keep stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 2.

## Suggested first move
Deploy done (v3.1.16 confirmed live 2026-07-18). The TV camera check (item 1) is the natural next step — 2 minutes at the physical TV closes the last open verification from v3.1.2 and sanity-checks the freshly deployed dark-mode work in one trip.

## Suggested model for next session
Sonnet 5 — deploy handoff, a design question, and a manual TV check; nothing architecturally ambiguous.

## Reminders
- Deploy from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The deploy's `git pull` will delete the server's copy of `.claude/settings.local.json` — expected and harmless (Claude-Code-only config, never in the Docker image).
- `narratives-draft.md` holds ~90 never-merged authored narratives (see TODO "Story authoring rollout") — needs a voice-rule pass before merging, if you feel like content work.
