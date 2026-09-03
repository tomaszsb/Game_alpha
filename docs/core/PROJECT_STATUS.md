# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** September 3, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.2.45** — **deployed and verified live** (`/health` returns `2fdf9e5`). v3.2.44 shipped in the same deploy.

## Current sprint
**2026-09-02/03 — a 9-billion-parameter local model played the game, recorded *why* it pressed each button, and found the one thing nobody looking at the screen could see.** The commit spine replaced its caption with the gate reason whenever a turn wasn't endable, so the space's own forward label ("Lock the scope") did not exist on screen until the player had already done the right thing — leaving **"Push back"**, which costs a day and returns you to the same space, as the only *named* control. The bot spent **11 of its 17 moves** in that trap, inventing a fresh rationalisation each time. Independently corroborated: `scripts/playtest-transcript.mjs` showed all six of that night's games dying in the same corner, 11 Try Agains across 38 turns. v3.2.45 keeps the label and moves the reason to a sub-line; it also fixes a caption that could read "0 actions left" when the turn was gated on an unpicked destination rather than on actions.

**Three further findings from that report were withdrawn after the maintainer challenged them, and he was right on all three** (verified in code): Push back *does* state its cost (`startHold` reveals the bubble on pointer-down, before the 650ms hold commits); finished actions *are* already greyed; and putting glossary links on action buttons would be actively harmful, since `TextWithTerms` renders `<span role="button">` with `stopPropagation()` and would swallow the click so the action never fires. The standing lesson: this model detects **missing words** sharply and **visual state** poorly — read it as a map of where players get lost, not a bug list, and check the code before writing a finding up.

**v3.2.46 is written, correct, and deliberately held** on `hold/v3.2.46-session-log` (`12d9ee1`) — see Health below.

## Health
- **Tests:** `npm test` — see NEXT_SESSION.md for this session's count. Typecheck ✅, production build ✅. `npm run test:ghost`: `ghostPlayerSmartBot` measured **47 wins / 3 failures / 0 hard / 86.9 turns** on the deployed code (2026-09-03 00:46Z) — the same signature it has held across 23 runs since 2026-08-26.
- **⚠️ Known infrastructure defect — writing to the log changes what the dice do.** One seeded `Math.random` feeds the ghost bot, `DiceService`, deck shuffles **and** `generateActionId()`, which burns one draw *per log entry*. So log volume decides dice values. Proven across four runs: removing one `warn()` per Try Again re-dealt all 50 ghost games (47/3/0/86.9 → 48/2/**1 hard**/94.9, twice; restored exactly on revert). **Not test-only** — seeded games are unreproducible across any logging change, and playtest reports carry a seed. This blocks v3.2.46 and is the next thing to fix. Full write-up in TODO.md + CLAUDE.md TACTICAL.
- **Security:** `npm audit` 0 vulnerabilities as of v3.2.44.
- **Deploy:** ✅ **v3.2.45 live and independently verified** (`curl https://game.unravelcodes.com/health` → `2fdf9e5`). Master carries two later docs-only commits that need no deploy.
- **Dashboard feedback:** 7 open. fb:93449bf2 remains deliberately unflipped — it needs the maintainer's eyes on the real television, which a deploy alone cannot settle.
- **Multi-agent note:** a second Claude session (Jarvis/Hermes, out of `E:\Documents\People\AI\Hermes - Jarvis Biel`) shares this repo and committed here on 2026-09-03. **This session now owns Game_Alpha's git** by the maintainer's decision.

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Decouple log-entry ids from the game RNG**, then land the held v3.2.46. Give `generateActionId()` and `generatePlayerId()` a monotonic counter; re-run `npm run test:ghost` and expect 47/3/0 to return *with* the guard in place.
2. **Look at the TV.** v3.2.44's screen-size calibration and board zoom floor are now live but were never verified on real hardware — both only execute on a real panel. fb:93449bf2 flips only after that.
3. **Decide who the game is for.** From fb:8ad42b52's `extra`: insiders (keep the jargon, lean into edge-case events) or broader players (tutorial, tooltips, plain-language micro-lessons). This is the maintainer's call and it gates the onboarding work.
