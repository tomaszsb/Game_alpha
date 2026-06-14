# Next session starter — written 2026-06-14 by /koniec

## State at handoff
- **Version:** v3.0.78 — **DEPLOYED + LIVE + PLAYTESTED 2026-06-14** (teacher layer Phase 3 + Vite 8). Server verified at origin AND the maintainer playtested the live game — **no new deficiencies from this session's work**. Phase 3 is done and shipped.
- **Branch:** master, clean + pushed (only `.claude/settings.local.json` + `ghost-history.jsonl`, intentional).
- **Last shipped (live):** v3.0.78 — multi-teacher front door + Vite 8 (0 audit vulns).
- **Test suite:** **full suite 2095 passed / 1 skipped (2096) on the new Vite 8/vitest toolchain** (~52 min). Ghost smart-bot 47/50, 0 hard failures, deterministic — identical to baseline, so Vite 8 changed nothing in runtime behavior.
- **Build/typecheck:** clean. **npm audit: 0 vulnerabilities.**

## Top 3 open items
1. **Phase 4 — card insertion** (teacher-authored spaces / "replace one card with several"). The last + most invasive teacher-layer phase — **now unblocked** (Phase 3 live + playtested). Per the spec it shifts the model from *spaces are selected* to *spaces are authored*; the spec ([TEACHER_LAYER_DESIGN.md](docs/core/TEACHER_LAYER_DESIGN.md) build-order item 4) flags it as the project's biggest future risk (hardens path validation, movement gen, layout, snapshotting all at once). **Start with a design pass before coding.**
2. **Onboarding package** (`fb:0aa9660c` + `fb:8ad42b52` + `fb:f22035af`) — biggest product lever, deploy-independent. (User mentioned "other remaining work before Phase 4" — this is the main candidate.)
3. **Ghost-run progress heartbeat** (small, requested 2026-06-14) — the full suite takes ~52 min with no mid-run visibility; add a tail-able per-game heartbeat to `runGhostBatch`. Full sketch in TODO "Ghost win-rate tracking".

## Decisions waiting on the user
- None open. (Phase 3 auth model settled: admin-minted scrypt accounts, combined login, no third-party auth — don't re-litigate.)

## Suggested first move
Phase 3 is live, playtested, and clean — so the deck is clear for **Phase 4 (card insertion)**. The user wants to tackle Phase 4 + any remaining pre-Phase-4 work. Recommend opening with a **Phase 4 design pass** (read [TEACHER_LAYER_DESIGN.md](docs/core/TEACHER_LAYER_DESIGN.md) build-order item 4 first — it's deliberately the riskiest phase). Ask the user: design Phase 4 now, or knock out the onboarding package / ghost heartbeat first?

## Reminders
- Deploy runs from the **Windows terminal**, not WSL / not from Claude's shell. Only `bash deploy.sh` — never `docker compose up`.
- Vite 8 needs Node ≥20.19; `node:20-alpine` is above that — but if the Docker build errors on engines, that's why.
- Nothing live changes until a teacher account + classroom exist, so the deploy itself is low-risk for existing players.
