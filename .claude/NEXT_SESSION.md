# Next session starter — written 2026-06-14 by /koniec

## State at handoff
- **Version:** v3.0.78 — **DEPLOYED + LIVE 2026-06-14** (teacher layer Phase 3 + Vite 8). Server verified live (new bundle served, Phase 3 endpoints respond). **Browser UI not yet eyeballed** — see item 1.
- **Branch:** master, clean + pushed (only `.claude/settings.local.json` + `ghost-history.jsonl`, intentional).
- **Last shipped (live):** v3.0.78 — multi-teacher front door + Vite 8 (0 audit vulns).
- **Test suite:** 1841/1841 on the broad sweep (new Vite 8/vitest toolchain); full suite (incl. ghost/E2E) was running at wrap — check `/tmp/koniec-fulltest.log` if in doubt, but the broad sweep + a live local end-to-end smoke both passed.
- **Build/typecheck:** clean. **npm audit: 0 vulnerabilities.**

## Top 3 open items
1. **Browser smoke of v3.0.78** (server live + verified; UI not yet clicked). Vite 8 swapped Rollup→Rolldown, so confirm the game still loads + plays a turn. Then the teacher flow: Admin Tools → 👥 Manage Classrooms & Teachers → create a test teacher + classroom → log out → log in as that teacher (username + password in the same login box) → see the classroom → start a game.
2. **Phase 4 — card insertion** (teacher-authored spaces / "replace one card with several"). The last + most invasive teacher-layer phase — **now unblocked** (Phase 3 live). Design it next.
3. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever, deploy-independent.

## Decisions waiting on the user
- None open. (Phase 3 auth model settled: admin-minted scrypt accounts, combined login, no third-party auth — don't re-litigate.)

## Suggested first move
v3.0.78 is live + server-verified. Do the teacher-flow browser smoke (item 1) — the one thing not yet eyeballed, and the real check on the Vite 8 bundler swap. If it's clean, move to Phase 4 (card insertion) design. Want to walk the teacher flow together, or jump to Phase 4?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL / not from Claude's shell. Only `bash deploy.sh` — never `docker compose up`.
- Vite 8 needs Node ≥20.19; `node:20-alpine` is above that — but if the Docker build errors on engines, that's why.
- Nothing live changes until a teacher account + classroom exist, so the deploy itself is low-risk for existing players.
