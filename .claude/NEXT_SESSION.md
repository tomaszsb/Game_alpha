# Next session starter — written 2026-07-01 by /koniec

## State at handoff
- **Version:** v3.0.91 — committed + pushed (`be7d135`), **PENDING DEPLOY**. Deploy not yet run.
- **Branch:** master, clean apart from the usual `.claude/settings.local.json`.
- **Last shipped:** money model — unpayable **mandatory bills now bankrupt** (real `endGame`) instead of silently dropping (the "money doesn't reconcile" fix) + first **before→after outcome modal** (new-view) + green→orange→red **money runway cue** + emoji/day-colour/copy fixes.
- **Test suite:** typecheck + build clean; targeted sweep (components/utils/services) **1757/1757**. Strict ghost 50-game gate **passed** (≥36 wins, 0 hard failures).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.91 + playtest the new economy.** It touches the **live default game's money model** — confirm an underfunded project hitting a design/regulatory fee now goes red → bankruptcy/game-over (cash cue warns orange→red first), not a swallowed fee. `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"` (from Windows terminal).
2. **Money cluster follow-ups:** `FEE_DEDUCTION` loan path still blocks-with-message rather than bankrupting (consistency call); surface the contractor agreed-price (fb:40caa223); show $ + time on end-turn/fee buttons (fb:06f7da3b / b53864af).
3. **Medium tier (untouched):** action-count "2 actions but 1" (fb:65160c0c / 8edd02b4 — it's `gameState.requiredActions`, an engine-counting question, not a label); Chronicle "Turn ended/started" ordering + dividers (fb:1eff7156 — the Chronicle groups by space, needs turn-awareness); dark-mode/contrast for the V2 modals.

## Decisions waiting on the user
- **Should the loan (`FEE_DEDUCTION`) path also bankrupt?** The v3.0.91 change made `RESOURCE_CHANGE` bills bankrupt; loans still fail-with-message. Consistency vs. blast-radius call.

## Suggested first move
Deploy v3.0.91 and playtest the bankruptcy economy first — it's a live-default-game change that genuinely wants real-play confirmation before building more on top. Or, if you'd rather keep coding, the medium tier's sharpest item is the action-count bug (fb:65160c0c). Which?

## Reminders
- Deploy from the **Windows terminal**, not WSL. Commit + push BEFORE deploy (`deploy.sh` pulls master).
- **Dashboard PATCH sweep pending:** flip `resolved:true` for fb:9c110d52, fb:8d68ab14 (already fixed in code), plus 222cd521, 1990c71e.
- The before→after modal (OutcomeChangesV2) is **not yet live-verified** — check it reads well on a real card-gain/loss with the new panel toggled on.
- New money-model gotcha now in CLAUDE.md TACTICAL: TWO negative-money guards; mandatory bills use `allowNegative`, discretionary buys keep the block.
