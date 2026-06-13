# Next session starter — written 2026-06-12 (eve) by /koniec

## State at handoff
- **Version:** v3.0.76 (**PENDING DEPLOY** — v3.0.74/75/76 all queued; **Unraid is down on purpose**: failing drives, user copying to a new drive, Docker stopped. Both public domains show tunnel-404 — expected, not a bug.)
- **Branch:** master, clean + pushed (only `.claude/settings.local.json` + `ghost-history.jsonl`, intentional)
- **Last shipped:** the ENTIRE teacher instance layer in one session — spec (4 reviews + Q&A), Phase 1 foundation (data-deploy gap dead by construction), Phase 2 catalog engine + Classroom Setup screen, Phase 3 design settled
- **Test suite:** koniec sweep 1805/1805 green (+89 new). Ghost batch not re-run (server/data-layer work; last green 2026-06-11).
- **Build/typecheck:** clean. Lint: 386 pre-existing (DEF-4).

## Top 3 open items
1. **Deploy v3.0.74–76 once the new drive is in** — `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Then: (a) boot log must show `🏫 Migrated live board into "classroom-1": N tile position(s) preserved` (the one-time migration — N = user's arranged tiles); (b) eyeball Admin Tools → 🏫 Classroom Setup (component-tested, never human-seen); (c) confirm a repo CSV fix now reaches live (the gap's death certificate).
2. **Onboarding package** (fb:0aa9660c + 8ad42b52 + f22035af) — biggest product lever; pure design session, deploy-independent. Recommended next session.
3. **Phase 3 build** (multi-teacher: admin-mediated accounts, games carry classroom) — design done in spec; **gated on item 1 proving out**. Filler meanwhile: DEF-3 (hook-order), DEF-4 (lint).

## Decisions waiting on the user
- Rotate the Unraid root password (typed into chat 2026-06-12) — still pending, natural to do during the drive rebuild.

## Suggested first move
Is the new drive in and Docker back? If yes → deploy + the 3 verification steps above. If no → onboarding-package design session (needs nothing from the server).

## Reminders
- Deploy runs from the user's Windows terminal, never from Claude's shell.
- First boot post-deploy: stock refresh will REPLACE live stale content (7+ known drifts incl. `{fundingAmount}` + `has_final_review_gate`) — that's the fix working, not data loss; positions are preserved via the migration.
- Live content edits via Space Data Editor no longer survive deploys (spec decision 3 — content's home is the repo).
- Phase 4 stays gated until Phases 1–3 run live (user-affirmed; in TODO).
- CLAUDE.md's old "CSV live-sync" recipe is flagged obsolete-pending-verification — clean up after deploy (TODO item exists).
