# Next session starter — written 2026-07-25 by /koniec

## State at handoff
- **Version:** v3.1.40 — **deployed + confirmed live** 2026-07-25 (verified via live bundle content (`"3.1.40"`) + `package.json` inside the running container; `/health`'s own version field reads "dev" and is NOT a reliable check — see TODO Parking lot for why).
- **Branch:** master, clean.
- **Last shipped:** 12 `/loop /fixloop` iterations closed out the entire 2026-07-21 playtest-findings batch and the security-audit MEDIUM tier. Real fixes: Glossary/Dictionary naming (v3.1.32), Rules/Game Rules naming (v3.1.33), two location badges resolved from raw internal space IDs to friendly names (v3.1.34, a real bug), admin-endpoint rate limiting (v3.1.35), teacher-login rate limiting (v3.1.36), a foreign-game SMS alert volume cap (v3.1.37), `npm audit fix` for dev-only advisories (v3.1.38), `X-Powered-By` header removed (v3.1.39), admin routes consolidated onto the shared `requireAdmin` helper — required updating 3 client fetch call sites too since it reads the password from a header not the body (v3.1.40). Investigated-and-closed-without-code-change: "press-and-hold duplicate implementation" (only one exists) and "PM-DECISION-CHECK missing flavor text" (the em-dash is a documented "no second option" marker). The "Bulk Discount" (E040) card TODO item was reclassified from a copy nit to a decision item — same shape as the earlier High-Profile Client finding, its description promises an effect with zero implementation behind it. Then, user-directed: attempted a real ESLint 9→10 upgrade to close the last 6 HIGH advisories, confirmed via the npm registry that `eslint-plugin-react` has no ESLint-10-compatible release at all (crashes lint outright), reverted and documented as a hard blocker in TODO + a new CLAUDE.md TACTICAL entry. User then ran the deploy themselves mid-`/koniec`.
- **Test suite:** fast suite 2453/2454 (1 pre-existing skip, no flakes) + ghost gates 33/33 (10 files, 0 hard failures, 572.9s).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Real-TV checks + TVDisplay dark-mode decision** — still outstanding across multiple sessions now: confirm the v3.1.2 camera feel and dark-mode slices on a real TV, and decide whether the shared TV screen wants a dark toggle at all.
2. **Two "build the mechanic or rewrite the copy honestly" decision calls** — High-Profile Client (L021) and Bulk Discount (E040) both have description text promising an effect that was never mechanically implemented.
3. **Remaining backlog is now almost entirely maintainer-decision items** — funding-gap number reconciliation + "Funding raised" definition (needs a semantics call), the `REGULATORY_REVIEW` rename and CSP/HSTS headers (both flagged as needing careful full verification, not a quick pass), and the CSV-editor/lint dead-code cluster (real rules-of-hooks bug in `DataEditor.tsx`, missing `engines` pin, 164 raw `console.*` calls) which fixloop hasn't touched yet and could still grind on blind.

## Decisions waiting on the user
- **Board layout** — keep stock grid, or re-arrange in the editor (drag-save persists).
- **Bank/Investor/Lender character naming** — marinading. **Don't nudge.**
- **Homeowner violation mechanic** — needs its own design pass before engineering.
- **TVDisplay dark mode** — see top item 2.
- **High-Profile Client (L021)** — build the missing "+1 day to other players" mechanic, or permanently rewrite the card to only describe what it actually does.
- **Bulk Discount (E040)** — same shape: build a real "3+ permits filed this turn" discount mechanic, or rewrite the card honestly (see CHANGELOG 2026-07-25 [Ops] entry).
- **Two funding-number items** — reconcile the top-bar/sidebar funding-gap denominators, and pick one definition of "Funding raised" (currently inconsistent across surfaces).

## Suggested first move
Nothing is blocked on a deploy this time — v3.1.40 is already live. Either let fixloop continue into the deficiency-audit cluster (the `DataEditor.tsx` hooks bug is a real, well-scoped fix), or spend time on the real-TV check that's been waiting the longest across sessions.

## Suggested model for next session
Sonnet 5 — remaining fixloop-eligible work is scoped bug fixes; everything else needs your decision, not deeper architectural judgment. Budget headroom is 26.8% (day-6 cap 85.6%) as of this write-up — recalibrate against `/usage` again if it's been a few days or you've used Claude elsewhere.

## Reminders
- Deploy from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- The deploy's `git pull` will delete the server's copy of `.claude/settings.local.json` — expected and harmless.
- `/health`'s `version` field is NOT a reliable deploy check (always reads "dev" in production — see TODO Parking lot, found 2026-07-25). To verify what's actually live: `curl .../assets/index-*.js | grep '"X.Y.Z"'` against the bundled package version, per CLAUDE.md's "Deploy verification — bundle hash trick."
- Before any future `npm audit fix --force` on an eslint-nested advisory: `npm view eslint-plugin-react peerDependencies` first — it caps below ESLint 10 today, so the eslint major-version bump stays blocked until that plugin catches up (see CLAUDE.md TACTICAL, 2026-07-25).
- Fixloop budget meter can drift from reality across a multi-device week — recalibrate with `node scripts/fixloop-usage.mjs --calibrate <official %>` (this session needed one correction: local said 54.8%, official was 39%).
