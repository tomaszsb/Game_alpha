# Next session starter — written 2026-07-28 by /koniec

## State at handoff
- **Version:** v3.1.74 — **deployed and verified live** 2026-07-28 (served bundle embeds `"3.1.74"`). Nothing pending.
- **Branch:** master, clean, pushed (`git log origin/master..master` empty).
- **Last shipped:** a lint burn-down (257 → 113 warnings, **ten rules promoted to hard `error`**, from two) that turned into root-causing the E2E timeout flake open since 2026-07-13.
- **Test suite:** fast suite **2493/2494** (1 pre-existing skip, zero failures) and ghost gates **33/33** (530.10s). Fully green.
- **Build/typecheck/lint:** all clean — lint exits 0 with 0 errors / 113 warnings.

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **Lint burn-down: the cheap wins are gone.** 113 warnings remain and all four rules need judgment — `no-unused-vars` 41 (dead bindings; `const x = doThing()` can't be deleted blindly if `doThing()` has side effects), `set-state-in-effect` 34 and `exhaustive-deps` 10 (both can hide *and* cause real bugs — do not batch-fix), `no-explicit-any` 28 (Bucket E, documented intentional; may correctly stay `warn` forever).
2. **Homeowner violation mechanic — needs a design conversation before any code.** Unchanged: maintainer sketched civil penalties, owner records, an Affidavit of Correction process, but confirmed it as advanced/multi-session work.
3. **fb:ae480630 (next-action highlight) is open on purpose — don't "re-fix" it blind.** v3.1.63 fixed a real notify gap that is a well-evidenced probable cause, but the symptom was **never reproduced — hypothesis, unverified**. It stays open so a recurrence is informative. Both of the maintainer's original theories (time-based fade, mobile↔PC switch) were already disproved live — don't retry those.

## Test failures to address
None in the fast suite. 2493 passed, 1 pre-existing skip (`E2E-FullGame.test.tsx`, DEF-11).

**One deliberate, documented exception:** `E2E_SEED=20` fails `E2E-AllPaths`'s two CHEAT-BYPASS tests. **This is not a bug** — the dice outcome bankrupts the player ($80,000 → −$20,000) and the engine correctly ends the run; those tests verify *routing*, so they can't run on a seed where the player goes broke. The default seed passes. Open question in TODO: make them bankruptcy-proof, or accept it.

## Decisions waiting on the user
- **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review). Human review, not a code task.
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key rotation** — maintainer declined; still exposed via git history whenever that changes.

## Flip after deploy
None pending — no dashboard feedback work this session, and `fb:75101be7` (the one TODO still called "flip pending deploy") was checked and is already resolved.

**⚠️ One new report arrived unnoticed and is now staged:** `fb:2948cf19`, filed **2026-07-27 22:26 UTC on v3.1.63** — i.e. *after* the previous session's `/koniec` wrote its handoff, so it was never triaged. "When deploying new code a yellow banner shows up with game code - the code number should be added to clipboard." Small and self-contained; staged in TODO under *Newly arrived (2026-07-27)*. Dashboard is at **8 open**, not the 7 carried in the last two handoffs.

## Suggested first move
Nothing is pending — v3.1.74 is live and the tree is clean. The remaining lint work is all judgment-heavy per-site review rather than mechanical sweeps, so a session spent on the Homeowner design conversation may be worth more than another burn-down pass. Or pick up the dashboard (7 open, untouched for a session). Which?

## Suggested model for next session
Sonnet 5 — the remaining lint rules are per-site judgment rather than reasoning-heavy, and the Homeowner item needs the maintainer's own design input more than model horsepower. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line.
- **`/koniec` step 0 now reaps stale `server/server.js` processes.** Four had accumulated across sessions (ports 3001–3004, oldest up three days). Worth ~149s → ~59s of test time. It does **not** fix the E2E flake — that was root-caused separately (v3.1.73).
- **A timing-out test is "hung," not "slow," until proven otherwise.** Run it in isolation and compare real duration to its budget; a 626ms test sitting at 90,018ms is waiting on something nobody will provide. See CLAUDE.md TACTICAL.
- **`tests/vitest.setup.ts` mocks every `console.*` method** unless `VITEST_VERBOSE=1`. Use `process.stdout.write` when tracing a test, or your probe prints nothing and reads as "never got here."
- E2E decks are seeded now (`E2E_SEED=<n>`, default `20260728`); `bash scripts/sweep-e2e-seeds.sh 1 25` hunts bad seeds.
