# Next session starter — written 2026-06-12 (pm) by /koniec

## State at handoff
- **Version:** v3.0.72 (committed + pushed, **PENDING DEPLOY** — v3.0.71 is what's live)
- **Branch:** master, clean after wrap-up (only `.claude/settings.local.json` + untracked `ghost-history.jsonl`, both intentional)
- **Last shipped:** security hardening — full endpoint auth sweep (DEF-1/2/5/6 closed + 4 unlisted gaps: game delete/reset, public game list, visitor-log IPs, legacy writes); npm audit 0 vulns
- **Test suite:** koniec sweep 1718/1718 green (components/utils/services/server). Ghost batch not re-run — server-side auth only, no game-logic change (last ghost green 2026-06-11).
- **Build/typecheck:** clean. **Lint:** 386 errors (DEF-4, long-standing).

## Top 3 open items
1. **Deploy v3.0.72** — locks aren't live until then. Dashboard side ALREADY deployed (proxy sends FEEDBACK_TOKEN; Unraid .env has it). No game-server config needed (both secrets already set live). Standard deploy command, user runs it.
2. **Onboarding package** (fb:0aa9660c + fb:8ad42b52 + fb:f22035af) — the remaining dashboard cluster; biggest product lever. Design session, not code-first.
3. **Teacher instance layer + space catalog** — design/brainstorm BEFORE code; kills the data-deploy gap properly. After these: DEF-3 (hook-order crash risk) / DEF-4 (lint rehab) from the audit.

## Decisions waiting on the user
- Two security chores in TODO: revoke the old GitHub PAT (was embedded in dictionary-scraper's remote) + rotate the Unraid root password (typed into chat). Both advised 2026-06-12, neither confirmed done.

## Suggested first move
If v3.0.72 isn't deployed yet, hand the user the deploy command first — the security work is inert until it ships. Then it's design-session territory: onboarding or teacher layer?

## Reminders
- **Access model is settled (don't re-litigate):** spectator reads open BY DESIGN; writes/PII keyed. See CLAUDE.md TACTICAL "Server endpoint access model" + DEFICIENCY_AUDIT addendum. Open endpoints are fingerprint-test-pinned in tests/server/serverEndpointAuth.test.ts.
- Maintainer feedback fetches now need the token: `/api/feedback*` requires `?token=$FEEDBACK_TOKEN` (recipes in CLAUDE.md updated). `/api/public/feedback/open` unchanged — /start is unaffected.
- Deploy command runs from the user's Windows terminal, not Claude's shell (ssh auth fails from here — don't retry, it locks out).
- Orphan-history side bug (back button needs extra presses after modal close) still open; naive fix re-introduces a fast-click race.
