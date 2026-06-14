# Next session starter — written 2026-06-14 by /koniec

## State at handoff
- **Version:** v3.0.78 — **PENDING DEPLOY** (live is still v3.0.77). v3.0.78 = teacher layer Phase 3 + Vite 8 upgrade, all committed + pushed.
- **Branch:** master, clean + pushed (only `.claude/settings.local.json` + `ghost-history.jsonl`, intentional).
- **Last shipped (live):** v3.0.77 — deploy.sh + migration fixes, data-deploy gap proven dead. v3.0.78 built but NOT deployed.
- **Test suite:** 1841/1841 on the broad sweep (new Vite 8/vitest toolchain); full suite (incl. ghost/E2E) was running at wrap — check `/tmp/koniec-fulltest.log` if in doubt, but the broad sweep + a live local end-to-end smoke both passed.
- **Build/typecheck:** clean. **npm audit: 0 vulnerabilities.**

## Top 3 open items
1. **Deploy v3.0.78 + verify live (Phase 3d).** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (from Windows). Then **browser smoke** because Vite 8 swapped Rollup→Rolldown — confirm the game loads/plays, AND walk the teacher flow: Admin Tools → 👥 Manage Classrooms & Teachers → create a test teacher + classroom → log out → log in as that teacher (username + password in the same login box) → see the classroom → start a game.
2. **Phase 4 — card insertion** (teacher-authored spaces / "replace one card with several"). The last + most invasive teacher-layer phase. **Gate: only design it once Phase 3 runs live** (i.e. after item 1).
3. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever, deploy-independent.

## Decisions waiting on the user
- None open. (Phase 3 auth model settled: admin-minted scrypt accounts, combined login, no third-party auth — don't re-litigate.)

## Suggested first move
Deploy v3.0.78 and do the teacher-flow browser smoke (item 1). It's the moment of truth for Phase 3 *and* the Vite 8 bundler swap. Want to deploy and verify together, then move on to Phase 4 design?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL / not from Claude's shell. Only `bash deploy.sh` — never `docker compose up`.
- Vite 8 needs Node ≥20.19; `node:20-alpine` is above that — but if the Docker build errors on engines, that's why.
- Nothing live changes until a teacher account + classroom exist, so the deploy itself is low-risk for existing players.
