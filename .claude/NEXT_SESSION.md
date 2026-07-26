# Next session starter — written 2026-07-26 by /koniec

## State at handoff
- **Version:** v3.1.51 — **confirmed deployed and live** 2026-07-26 (bundle-verified `"3.1.51"`, container logs clean, 9 games loaded).
- **Branch:** master, clean.
- **Last shipped:** standings-view redesign + the funding-gap duplication bug fixed at its root (v3.1.51) — both the top-bar pill and each player's comparison chip now call the same `computeProjectFinances()` the sidebar ledger uses, confirmed live with real numbers (all three surfaces agreed on `$275K`, not just at $0).
- **Test suite:** fast suite 2477/2478 (1 pre-existing skip, no failures, clean run) + ghost gates 33/33 (10 files, 0 hard failures, 573.6s) — no regressions from this session's game-logic changes.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Homeowner violation mechanic — needs a real design conversation before any engineering.** Maintainer sketched the shape (civil penalties, owner records, an Affidavit of Correction process mirroring NYC DOB's real violation-resolution path) but confirmed it as advanced/multi-session work, not urgent. Needs: what triggers it, what the player does turn-by-turn, what unlocks after filing.
2. **Four sibling card-effect gaps found this session while building L021/E040, none yet decided:** "Approved Template" (E034 — optional per-player choice, a different shape than L021's mandatory fan-out, needs its own `ChoiceService`-based mechanic); "Expeditor Training"/"Expeditor Mentor" (E020/E037 — promise linear per-count scaling, currently a flat `-1`, different shape than E040's threshold gate); "Press Release" (E036 — likely just needs the existing `high_profile_conditional` gate wired, not new design, since L044 already implements the identical idea); "Appeal Process" (E044 — same cut-off-mid-sentence, zero-effect shape E040 was).
3. **CSP/HSTS/Permissions-Policy headers still deferred.** Real regression risk this app's jsdom-based test suite structurally can't catch (inline `style={{...}}` everywhere + a live cross-origin iframe). Needs a full inline-style/iframe survey + live-browser verification, not a quick pass.

## Decisions waiting on the user
- **Bank/Investor/Lender character naming** — marinating. **Don't nudge.**
- **Homeowner violation mechanic** — see top item 1.

## Suggested first move
Nothing is blocked on a deploy — v3.1.51 is already live. The natural next step is the Homeowner-mechanic design conversation (the only item left that isn't a quick build), or picking one of the 4 newly-found card-effect gaps to get a maintainer decision on — each is the same "build it or rewrite the copy" shape as L021/E040 were.

## Suggested model for next session
Sonnet 5 — the top-3 items are either a design conversation (needs the maintainer's judgment, not model horsepower) or scoped card-effect decisions/builds matching this session's established pattern.

## Reminders
- Deploy command runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- v3.1.51 confirmed deployed and live as of this write-up.
- The `E2E-AllPaths.test.ts` flake surfaced repeatedly this session under sustained multi-hour load (a different test name failing almost every run) — this is the already-documented resource-contention pattern (TODO Parking lot, tracked since 2026-07-13), not a new issue. Don't re-investigate from scratch if seen again; just re-run the file alone to confirm it's not a regression.
- This session did a live SSH investigation of the Unraid server (checked container status, logs, and cleaned up historical nested-directory debris — see CLAUDE.md TACTICAL) — passwordless `ssh unraid` access is confirmed working.
