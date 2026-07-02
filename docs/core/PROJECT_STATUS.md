# Project Status

> **Snapshot of where the project is *right now* — not a log.** Per-version history
> lives in [CHANGELOG.md](../../CHANGELOG.md); player-facing notes in
> [docs/user/RELEASE_NOTES.md](../user/RELEASE_NOTES.md). `/koniec` **replaces** this
> snapshot each session, it does not append.

**Last Updated:** July 1, 2026
**Current Phase:** Beta — live in production
**Current Version:** **3.0.91** — **committed + pushed (`be7d135`), PENDING DEPLOY.** Bankruptcy is real now: unpayable mandatory bills charge in full into the red and end the game (fixing the "money doesn't reconcile" reports), instead of being silently dropped. Plus the first before→after outcome modal, a money runway colour cue, and a batch of new-panel playtest fixes. **Touches the live default game's money model — wants a real playtest after deploy.** Prior live: v3.0.90 (`aa1edba`), confirmed 2026-06-30.

## Current sprint
**2026-07-01 — money cluster + before→after modal (from the v3.0.90 playtest, 63 reports → 48 triaged).** Root-cause of the "my money doesn't add up" reports: `ResourceService.spendMoney` (and `validateResourceChange`) silently refused any charge the player couldn't afford, so a mandatory fee was dropped while the ledger had already recorded it, and the pre-existing `checkBankruptcy → endGame` could never fire (money never went negative). Fixed with an `allowNegative` flag threaded through the deduction path; the `RESOURCE_CHANGE` fee/life-event path uses it → real bankruptcy. Discretionary card buys keep their up-front block. Also shipped (opt-in new panel): [OutcomeChangesV2.tsx](../../src/components/player/OutcomeChangesV2.tsx) (before→after that reads like "My numbers" + names the exact card gained/lost), a green→orange→red money runway cue, source-card-typed active-effect emoji, day-delta colour. Data: "Approve"→"Accept" on ARCH-INITIATION + ENG-SCOPE-CHECK.

## Health
- **Tests:** typecheck + build clean; targeted sweep (components/utils/services) **1757/1757 green** (+18 new; fixed 2 EffectEngineService assertions that pinned the old `spendMoney` arg list). Full `npm test` hangs on Windows (known) → targeted sweep is the gate. **Strict ghost 50-game gate PASSED** (≥36 wins, 0 hard failures) — the harder economy didn't sink the blind bot.
- **Build / typecheck:** clean. **Lint:** ~386 pre-existing errors (DEF-4, long-standing).
- **Deploy:** **v3.0.91 committed + pushed (`be7d135`), NOT yet deployed.** Always **commit + push BEFORE** the deploy command (`deploy.sh` pulls master + stamps the badge from HEAD). Deploy from a **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. **Local-dev browser verify needs BOTH servers** — Express (3001) + Vite (3000).

## Top open items (full list in TODO.md + .claude/NEXT_SESSION.md)
1. **Deploy v3.0.91 + playtest the new economy** — confirm an underfunded project going into a design/regulatory fee now goes red → bankruptcy/game-over (with the cash cue warning first), not a silently-swallowed fee.
2. **Money cluster follow-ups still open:** the `FEE_DEDUCTION` loan path still blocks-with-message rather than bankrupting (consistency call); "hired a contractor but never saw the agreed price" (fb:40caa223) still wants the price surfaced; the end-turn/fee buttons showing $ + time impact (fb:06f7da3b / b53864af).
3. **Medium tier untouched:** action-count "2 actions but 1" (fb:65160c0c / 8edd02b4 — engine `requiredActions`), Chronicle turn-ordering + dividers (fb:1eff7156 — needs turn-awareness), plus dark-mode/contrast for the V2 modals. Two already-fixed reports (fb:9c110d52, 8d68ab14) await a dashboard `resolved` flip.
