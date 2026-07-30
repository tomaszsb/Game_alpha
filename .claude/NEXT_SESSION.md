# Next session starter — written 2026-07-29 by /koniec

## State at handoff
- **Version:** v3.1.75 — **app code deployed and verified live** 2026-07-29 (served bundle embeds commit `a2fa541`). The version string could NOT confirm it this time (the bump landed after the deploy) — the bundle was grepped for the commit hash instead. **`deploy.sh`'s race fix is NOT live**: it's deploy tooling, absent from the app bundle, and takes effect on the next deploy.
- **Branch:** master, clean, pushed.
- **Last shipped:** lint 113 → 62 warnings, with `no-unused-vars` (41) and `exhaustive-deps` (10) both taken to zero and promoted to hard `error` (12 rules now). The review found four real defects that were on nobody's list.
- **Test suite:** fast suite **2493/2494** (1 pre-existing skip) and ghost gates **33/33** (593.80s). Both green.
- **Build/typecheck/lint:** all clean — lint exits 0 with 0 errors / 62 warnings.

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **Player-to-player trading is fully BUILT and unreachable — card first, button second.** `NegotiationModal` (751 lines) + `NegotiationService` (426 lines), wired into the service container, tested on both halves, and nothing can open it. **Two blockers in order:** no card or life event triggers it (all 399 checked — none transfer a card between hands), and the service has **zero** turn awareness (0 occurrences of `currentPlayerId`), so a top-bar button would permit off-turn trading. Maintainer's call: action-list placement, so the triggering card's timing *is* the turn rule. Full writeup in TODO.md's Parking lot.
2. **Lint: only two deliberate decisions remain, no mechanical work.** `no-explicit-any` (28, Bucket E — "stays `warn` forever" is a legitimate answer) and `set-state-in-effect` (34 — all audited; clearing them properly is a `useSyncExternalStore` data-flow refactor with real regression risk, not a sweep). Both now carry their reasoning inline in `eslint.config.js`.
3. **fb:ae480630 (next-action highlight) is open on purpose — don't "re-fix" it blind.** v3.1.63 fixed a real notify gap that is a well-evidenced probable cause, but the symptom was **never reproduced — hypothesis, unverified**. Both of the maintainer's original theories were already disproved live.

## Test failures to address
None reproducible. **One unidentified flake, recorded not dismissed:** a backgrounded `npm test` (running concurrently with the ghost gates) reported **1 failed / 2492 passed**; an immediate clean re-run was 2493/2494 green. The failing test's identity was lost because the captured output had been truncated to its tail. Not diagnosed — if it recurs, **read the full output before re-running**, since a green re-run destroys the evidence. (`/koniec` step 1 has been amended to stop this recurring.)

## Decisions waiting on the user
- **Trading:** write the card content that triggers it, or leave shelved? (Item 1 above.)
- **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review). Human review, not a code task.
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key rotation** — maintainer declined; still exposed via git history whenever that changes.

## Flip after deploy
None pending — no dashboard feedback work this session. Dashboard still at **8 open**, untouched.

## Suggested first move
Nothing is blocked and the tree is clean. The dashboard has been untouched for two sessions (8 open) and is the most concrete work available; trading needs card *content* written before any code, which is a maintainer-input session rather than an engineering one. Dashboard, trading content, or the Homeowner design conversation?

## Suggested model for next session
Sonnet 5 — dashboard triage and card authoring are judgment-and-taste work rather than reasoning-heavy. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line.
- **A deploy that errors at the last step may still have shipped — or silently NOT shipped.** `deploy.sh` now verifies the running container's image ID against the image just built and exits 1 on mismatch. If it ever fires, `docker inspect` before re-running.
- **When the version wasn't bumped before a deploy, grep the served bundle for the git commit** — `/health`'s version field is an unreliable "dev" placeholder.
- `exhaustive-deps` reports on the **dependency-array line**, not the `useEffect(`/`useMemo(` line — a `disable-next-line` above the opening call silently does nothing.
- E2E decks are seeded (`E2E_SEED=<n>`, default `20260728`); `bash scripts/sweep-e2e-seeds.sh 1 25` hunts bad seeds.
