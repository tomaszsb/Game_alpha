# Next session starter — written 2026-07-28 by /koniec

## State at handoff
- **Version:** v3.1.74 — ⚠️ **NOT deployed. Live is still v3.1.66.** Eight versions (v3.1.67–v3.1.74) are committed and pushed, awaiting one `deploy.sh`.
- **Branch:** master, clean, pushed (`git log origin/master..master` empty).
- **Last shipped:** a lint burn-down (257 → 113 warnings, **ten rules promoted to hard `error`**, from two) that turned into root-causing the E2E timeout flake open since 2026-07-13.
- **Test suite:** fast suite **2493/2494** (1 pre-existing skip, zero failures) and ghost gates **33/33** (530.10s). Fully green.
- **Build/typecheck/lint:** all clean — lint exits 0 with 0 errors / 113 warnings.

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **Deploy v3.1.74.** Eight versions stacked. `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` — nothing is blocked on it, but the gap grows each session.
2. **Lint burn-down: the cheap wins are gone.** 113 warnings remain and all four rules need judgment — `no-unused-vars` 41 (dead bindings; `const x = doThing()` can't be deleted blindly if `doThing()` has side effects), `set-state-in-effect` 34 and `exhaustive-deps` 10 (both can hide *and* cause real bugs — do not batch-fix), `no-explicit-any` 28 (Bucket E, documented intentional; may correctly stay `warn` forever).
3. **Homeowner violation mechanic — needs a design conversation before any code.** Unchanged: maintainer sketched civil penalties, owner records, an Affidavit of Correction process, but confirmed it as advanced/multi-session work.

## Test failures to address
None in the fast suite. 2493 passed, 1 pre-existing skip (`E2E-FullGame.test.tsx`, DEF-11).

**One deliberate, documented exception:** `E2E_SEED=20` fails `E2E-AllPaths`'s two CHEAT-BYPASS tests. **This is not a bug** — the dice outcome bankrupts the player ($80,000 → −$20,000) and the engine correctly ends the run; those tests verify *routing*, so they can't run on a seed where the player goes broke. The default seed passes. Open question in TODO: make them bankruptcy-proof, or accept it.

## Decisions waiting on the user
- **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review). Human review, not a code task.
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key rotation** — maintainer declined; still exposed via git history whenever that changes.

## Flip after deploy
None — no dashboard feedback work this session. Dashboard remains at 7 open.

## Suggested first move
Deploy is the obvious one-command win, and eight versions is the largest gap in a while. After that: the remaining lint work is genuinely judgment-heavy, so it may be a better use of a session to take the Homeowner design conversation instead. Which do you want?

## Suggested model for next session
Sonnet 5 — deploy is one command, and the remaining lint rules are per-site judgment rather than reasoning-heavy. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line.
- **`/koniec` step 0 now reaps stale `server/server.js` processes.** Four had accumulated across sessions (ports 3001–3004, oldest up three days). Worth ~149s → ~59s of test time. It does **not** fix the E2E flake — that was root-caused separately (v3.1.73).
- **A timing-out test is "hung," not "slow," until proven otherwise.** Run it in isolation and compare real duration to its budget; a 626ms test sitting at 90,018ms is waiting on something nobody will provide. See CLAUDE.md TACTICAL.
- **`tests/vitest.setup.ts` mocks every `console.*` method** unless `VITEST_VERBOSE=1`. Use `process.stdout.write` when tracing a test, or your probe prints nothing and reads as "never got here."
- E2E decks are seeded now (`E2E_SEED=<n>`, default `20260728`); `bash scripts/sweep-e2e-seeds.sh 1 25` hunts bad seeds.
