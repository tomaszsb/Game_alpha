# Next session starter — written 2026-06-12 (pm) by /koniec, updated post-deploy

## State at handoff
- **Version:** v3.0.73 (DEPLOYED + live-verified 2026-06-12: locks return 401 without keys, 200 with; /health is counts-only; bundle index-Bc3AUC4f at commit 360f0ed)
- **Branch:** master, clean after wrap-up (only `.claude/settings.local.json` + untracked `ghost-history.jsonl`, both intentional)
- **Last shipped:** v3.0.72 security hardening (DEF-1/2/5/6 + 4 unlisted gaps) + v3.0.73 follow-up (/health leaked gameIds — caught in post-deploy verification, fixed same day)
- **Test suite:** koniec sweep 1718/1718 green; server suite 82/82 after the /health fix. Ghost batch not re-run — server-side auth only, no game-logic change (last ghost green 2026-06-11).
- **Build/typecheck:** clean. **Lint:** 386 errors (DEF-4, long-standing). **npm audit: 0 vulns.**

## Top 3 open items
1. **Onboarding package** (fb:0aa9660c + fb:8ad42b52 + fb:f22035af) — the remaining dashboard cluster; biggest product lever. Design session, not code-first.
2. **Teacher instance layer + space catalog** — design/brainstorm BEFORE code; kills the data-deploy gap properly.
3. **Remaining audit items** — DEF-3 (hook-order crash risk: useMemo after early return in ProjectScopeSection/FinancesSection etc.) and DEF-4 (lint rehab: disable no-undef for TS, auto-fix cosmetics, triage residue).

## Decisions waiting on the user
- One security chore left in TODO: rotate the Unraid root password (typed into chat 2026-06-12). GitHub PATs already revoked + re-authed same session (optional: delete the unused "Code2027" token).

## Suggested first move
Security project is fully shipped and live-verified (v3.0.72 + v3.0.73). It's design-session territory now: onboarding package or teacher layer — which one?

## Reminders
- **Access model is settled (don't re-litigate):** spectator reads open BY DESIGN; writes/PII keyed; game code = join secret (so /health and any future endpoint must never list gameIds). See CLAUDE.md TACTICAL "Server endpoint access model"; open endpoints + the /health no-leak rule are pinned in tests/server/serverEndpointAuth.test.ts.
- Maintainer feedback fetches need the token: `/api/feedback*` requires `?token=$FEEDBACK_TOKEN` (recipes in CLAUDE.md updated). `/api/public/feedback/open` unchanged — /start unaffected. Dashboard proxy already sends it (deployed).
- Deploy command runs from the user's Windows terminal, not Claude's shell (ssh auth fails from here — don't retry, it locks out).
- /health reports `version: "dev"` at runtime (VITE_GIT_COMMIT is build-time only, not in container runtime env) — cosmetic, known, don't chase unless bored.
- Orphan-history side bug (back button needs extra presses after modal close) still open; naive fix re-introduces a fast-click race.
