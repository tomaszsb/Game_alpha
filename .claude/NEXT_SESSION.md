# Next session starter — written 2026-07-27 by /koniec

## State at handoff
- **Version:** v3.1.66 — **deployed and confirmed live** by the maintainer.
- **Branch:** master, clean (after this wrap-up commit).
- **Last shipped:** a `/loop /fixloop` run cleared all four staged dashboard reports (v3.1.62–v3.1.64), then the code-health bundle turned up a real crash and fixed the tooling that should have caught it (v3.1.65–v3.1.66).
- **Test suite:** fast suite **2493/2494 passing, 1 pre-existing skip, zero failures** — notably no flakes this run, unlike recent sessions. Ghost gates: see the wrap line / CHANGELOG (started at wrap-up).
- **Build/typecheck:** clean. **Lint now runs and exits 0** (0 errors, 257 warnings) — it was effectively unrunnable all session before v3.1.66.

## Top 3 open items
*(This is a curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open.)*
1. **Two feedback reports need the maintainer, not a fix.** fb:b39ea2bd (yellow banner) was *measured* as already resolved by v3.1.22 — flip recommended, awaiting the OK. fb:ae480630 (next-action highlight) has a probable fix in v3.1.63 but the symptom was **never reproduced — hypothesis, unverified**; deliberately left open so a recurrence tells us it was something else.
2. **Lint burn-down + CI.** 257 warnings are a deliberate visible backlog with per-rule counts in TODO.md; promote each rule back to `error` at zero. Separately: **this repo has no `.github/workflows/` at all**, so "put lint in CI" is a real decision (deploys go via `deploy.sh` on Unraid), not a config tweak.
3. **Homeowner violation mechanic — needs a design conversation before any code.** Unchanged: maintainer sketched civil penalties, owner records, an Affidavit of Correction process, but confirmed it as advanced/multi-session work.

## Test failures to address
None. 2493 passed, 1 pre-existing skip (`E2E-FullGame.test.tsx`, DEF-11).

## Decisions waiting on the user
- **Flip fb:b39ea2bd resolved?** Recommended — but measured in a headless browser with `screen.width` overridden, not on the real TCL, so worth a glance next time you're on that TV.
- **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review). Human review, not a code task.
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key rotation** — maintainer declined; still exposed via git history whenever that changes.

## Flip after deploy
None pending — `.claude/fixloop/flip-queue.txt` is empty. fb:101702ed and fb:89d83c39 were both flipped this session as their deploys landed. Dashboard now at **8 open** (from 13).

## Suggested first move
Nothing is blocked. The lint burn-down is the natural continuation — the small mechanical rules (3 whitespace, 2 refs, 1 unused-expression) clear fast and each one promoted back to `error` permanently locks in a guarantee. Or take the Homeowner design conversation if you'd rather spend the session on judgment than cleanup. Which?

## Suggested model for next session
Sonnet 5 — the top-3 are mechanical cleanup, a couple of maintainer decisions, or a design conversation needing the maintainer's own judgment. None needs more horsepower; raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — chained bash one-liners fail with a parser error; give one command per line.
- **`PlayerMobileView` is NOT the in-game phone view** — it's setup-phase only. The real one is `GameLayout`'s `effectiveViewPlayerId && gamePhase === 'PLAY'` branch → `PlayerPanelWrapper`. Cost real time this session; see CLAUDE.md TACTICAL.
- Local verification needs BOTH servers: Express (`npm run server`, 3001) and Vite (3000, via the preview tool). **Never edit `vite.config.ts` to dodge a port collision** — an agent did that this session and it had to be reverted.
- Glossary auto-sync is **working** (since 2026-07-26), despite what older notes implied. Check health with `docker logs -t` — untimestamped logs are what made this ambiguous for a full day.
