# Next session starter — written 2026-06-12 by /koniec

## State at handoff
- **Version:** v3.0.71 (deployed 2026-06-12, bundle verified live; CSV label fix live-synced + verified at origin)
- **Branch:** master, clean after wrap-up commit (only `.claude/settings.local.json` + untracked `ghost-history.jsonl` remain, both intentional)
- **Last shipped:** both 2026-06-11 playtest bugs — bank-loan label (data + source-aware fallback) and result-modal flash (backdrop grace window + result queue)
- **Test suite:** 1911/1911 non-ghost green (full run, twice). `npm test` full-suite hung at koniec (known Windows issue, killed). Ghost batch not re-run — no game-logic changes this session (UI/label only); last ghost green 2026-06-11.
- **Build/typecheck:** clean. **Lint:** 386 errors (long-standing config issue — DEF-4).

## Top 3 open items
1. **Security gaps from the audit** (DEF-2, DEF-6) — WebSocket `subscribe` skips token auth (state readable without token); feedback-read endpoints unauthenticated + expose reporter PII. DEF-2 is the sharpest. See `docs/technical/DEFICIENCY_AUDIT.md`.
2. **Onboarding package** (fb:0aa9660c + fb:8ad42b52 + fb:f22035af) — the remaining dashboard cluster (5 open reports, all design/onboarding); recurring "overwhelming for newcomers" theme; biggest product lever.
3. **Teacher instance layer + space catalog** (design initiative) — needs a focused design/brainstorm session BEFORE code; foundation for killing the data-deploy gap properly.

## Test failures to address
(None — suite is green.)

## Decisions waiting on the user
- Which of the top-3 to take next (security hardening vs onboarding design vs teacher-layer design). No pending technical decision.

## Suggested first move
v3.0.71 closed out the quick wins — the board is now strategic items only. DEF-2 (WebSocket auth) is the most self-contained: server-side, testable, no design input needed. Want to start there, or kick off one of the two design sessions (onboarding / teacher layer)?

## Reminders
- `ssh unraid` now resolves from PowerShell AND Claude Code's shell (`C:\Users\tomas\.ssh\config`, created 2026-06-12) — but still don't run deploys from Claude Code; hand the command to the user.
- fb:ac29b623 post-mortem: the queued diagnosis was wrong (see CLAUDE.md TACTICAL "Repro the bug BEFORE building the prescribed fix"). Repro first when a TODO arrives with an untested root cause.
- Orphan-history side bug (back button needs extra presses after modal closes) is still open in TODO — the naive fix re-introduces a fast-click race; needs care.
- Local dev: ports 3001–3004 may be hijacked by stale WSL portproxy rules — see CLAUDE.md TACTICAL before browser-verifying anything locally.
