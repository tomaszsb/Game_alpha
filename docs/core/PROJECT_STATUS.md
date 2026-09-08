# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 8, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.55 — LIVE and content-verified.** `/health` read `5718946` at 2026-09-08 18:49Z (= HEAD, contains v3.2.55's feature commit `867e322`), and the served `index-DQy_iRYu.js` carries all nine new hook strings — `move-expander`, `move-option`, `commit-end-turn`, `commit-side`, `action-button`, `data-space-id`, `data-actionable`, `data-effect-key`, `data-ready` — fetched and grepped, not inferred from the version number. **Trust `/health` over this line** — it has been wrong within hours twice this week, in both directions. 3.2.46 stays permanently skipped; its commit landed renumbered as v3.2.49.

## Current sprint
**Onboarding Phase C — teaching a beginner the game instead of testing whether they already know it.** v3.2.50 named the 27 tiles, v3.2.51 authored 81 button labels, v3.2.52 fixed where those labels never reached, v3.2.53 fixed a commit spine demanding an action that could not unblock it, and v3.2.54 started the teaching layer proper — a **"What's this?"** disclosure beside every action row (never inside the button: `TextWithTerms` renders a term as `<span role="button">` with `stopPropagation()`, so a term in a real `<button>` swallows the press). **Still open, and the bulk of it: the tutorial, the micro-lessons, and a voice pass on the 44 `ACTION_TOOLTIPS.csv` rows** — they predate the 2026-09-03 beginners fork and still read like it ("Expeditors are your secret weapon"). The tooltip is the one place a trade word *should* appear; buttons stay plain.

**v3.2.55 is not part of that arc — it protects it.** The nightly playtest robot finds the game's controls by regex over their **visible text**, and rewriting visible text is exactly what Phase C is. Three consecutive releases each blinded a different handle, all three of them good changes: v3.2.52's toggle rename killed the destination opener, so **the robot could not move at all**; v3.2.53's gate rewording made it offer a `disabled` button as live, burning its three-strike budget; v3.2.54's row wrapper broke a direct-child selector. v3.2.55 adds five `data-testid` hooks so the handles are no longer copy — 110 insertions, 0 deletions, comments and attributes only, nothing a player can see. **It is half a fix**: the harness must be changed to use them (different repo, different machine, owned by a Jarvis session), and neither half is observable alone.

**The step-count collapse is now attributed, by mechanism.** Two sessions recorded it as unseparable between the v3.2.52 deploy and a Jarvis runtime update in the same window. Destination clicks in the robot's own report were **7 on 09-05** (best game 80 steps, hit the cap) and **0 on 09-06, 09-07 and 09-08** (best games 17/22/15) — three seeds, across the exact release boundary, with 0 model errors over 62 clean moves on 09-08. Explained without invoking the runtime update. That is a claim about this failure only, not a verdict on the runtime.

**A correction to the record:** the 12-of-12 and 18-of-18 abandonments at `PM-DECISION-CHECK` read as a game dead end and v3.2.53 was shipped against that reading. v3.2.53 fixed a genuine defect, established from the code and a seeded failure — but the screen was fine for a human throughout, and the abandonment was the harness. Before treating a robot's stuck-ness as a game defect, establish that it can still *see* the control it is failing to press.

## Health
- **Tests (v3.2.55):** `npx vitest run` — the **whole** suite including ghost — **3132/3132 across 213 files**, 0 failures, green on the **first** attempt, no re-runs needed. Typecheck ✅, production build ✅. All nine new hook strings verified present in the production bundle after terser.
- **Flake note, still current:** a lone `tests/server/**` failure in a full run is probably Windows temp-dir load (`EPERM: rename`, `ENOTEMPTY: rmdir`), not a regression — re-run before investigating. Did not recur this session.
- **Ghost baseline:** all ghost suites pass, win-rate floor included. **Do not chase the old 47/3/0/86.9** — it belongs to the pre-v3.2.48 era when log volume moved the dice, and cannot return by construction.
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ✅ **v3.2.55 live, content-verified 2026-09-08 18:49Z** (see Current Version above). `bash deploy.sh` is Tom's, from a Windows terminal. **Verify content by finding the chunk locally first** (`grep -rl "<string>" dist/assets/*.js`) — the build is code-split, so grepping `index-*.js` for a string that lives elsewhere gives a false failure.
- **Dashboard feedback:** fb:93449bf2 remains deliberately unflipped — it needs the maintainer's eyes on the real television, which a deploy alone cannot settle.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Confirm the robot half landed — the game half is live.** The hooks are deployed and verified in the live bundle, but inert until the harness on the Mac mini uses them. The number that settles it is `clicked:  ➡️` in the next 03:26 report — 7 on 09-05, then 0, 0, 0. A good number alone is not proof: the harness half ships a prose fallback, so check whether the "which path fired" log line landed.
2. **The teaching layer — tutorial, micro-lessons, and the tooltip voice pass.** The remaining and largest part of Phase C. Constraint already proven: never put a glossary term inside an action button.
3. **Does ARCH-FEE-REVIEW's 50-day Try Again cost need to be visible before you commit?** The 50 days are intended; this is about disclosure. Maintainer's call.
