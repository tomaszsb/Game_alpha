# Next session starter — written 2026-07-30 by /koniec

## State at handoff
- **Version:** v3.1.76 — app code **deployed and verified live** as commit `81c259f` (bundle-grepped; `deploy.sh`'s image-ID check fired and passed, its **second** clean run since v3.1.75 closed the container-recreate race).
- **⚠️ The version LABEL lags by design.** The bump landed after the deploy, so production self-reports **`3.1.75 (81c259f)`** — post-3.1.75 code wearing the old number. It corrects itself on the next deploy. **The commit hash is the reliable identifier; `/health`'s version field is not.** Same ordering as last session; nothing is wrong.
- **Branch:** master, clean, pushed.
- **Last shipped:** lint had only ever covered `src/` — the entire Express server was unlinted. Coverage **202 → 227 files**, 53 warnings / 0 errors / exit 0.
- **Test suite:** fast suite **2497 passed / 1 skipped / 0 failed** (169 files; the skip is pre-existing) and ghost gates **33/33** (10 files, 567.71s). Both green.
- **Build/typecheck/lint:** all clean.

## Top 3 open items
*(Curated shortlist, not the backlog — read TODO.md before claiming anything else is or isn't open. All 8 live dashboard reports are already tracked there; nothing untracked.)*
1. **Copy the game code to the clipboard when the restart banner shows it** (`fb:2948cf19`, filed 2026-07-27) — the only recent dashboard report that is real unstarted work. Small and self-contained. One caution: `navigator.clipboard` needs a secure context and can reject without a user gesture, so a **tap-to-copy button is the safer shape than an automatic write**.
2. **Player-to-player trading is built and unreachable — card first, button second.** Unchanged from last session. Nothing triggers it (all 399 cards checked), and `NegotiationService` has **zero** turn awareness, so a top-bar button would permit off-turn trading. Needs card *content* written before any code. Full writeup in TODO.md's Parking lot.
3. **`ActiveEffect.effectData: any` — real work, but not lint work.** Surfaced this session: nothing type-checks that field's producer against its consumer, so a renamed payload key fails silently — the same shape as the CSV column drift v3.1.75 closed. Typing it means a discriminated union across the whole effect engine. **Don't attempt it as a sweep.**

## Test failures to address
None. Last session's unidentified single-test flake did **not** recur.

## Decisions waiting on the user
- **`set-state-in-effect` (34):** scope the `useSyncExternalStore` refactor as its own project, or accept it permanently? All 34 audited; real regression risk (BoardCanvas's is the documented fix for two playtest bugs). *(Its sibling question, `no-explicit-any`, is now settled — stays `warn` on purpose, reasoning inline in `eslint.config.js`.)*
- **Trading:** write the card content that triggers it, or leave shelved?
- **6 glossary terms sit unapproved in Purgatory** (Standpipe, Heat Recovery Ventilation, Stormwater Management, Tax Credit, Crowdfunding, Environmental Review). Human review, not a code task.
- **Bank/Investor/Lender character naming** — still marinating. **Don't nudge.**
- **PixelLab.ai key rotation** — maintainer declined; still exposed via git history whenever that changes.

## Flip after deploy
None — no dashboard feedback was closed this session. Dashboard steady at **8 open**, all tracked.

## Suggested first move
Tree is clean and nothing is blocked. The clipboard fix (item 1) is the most concrete thing available and is genuinely small; trading still needs card *content* before any code. Clipboard fix, trading content, or the Homeowner design conversation?

## Suggested model for next session
Sonnet 5 — a small self-contained UI fix plus card authoring is taste-and-judgment work, not reasoning-heavy. Raise effort to `xhigh` before reaching for a bigger model.

## Reminders
- Deploy runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. **PowerShell has no `&&`** — one command per line.
- **`npm run lint` now covers `server` and `scripts`, not just `src`.** A lint error in the Express server will now fail the run — that is intentional.
- **Express identifies error-handling middleware by ARITY (4 args).** `server.js`'s `_next` is unused but must never be deleted — removing it silently stops every 500 from returning JSON.
- **Never `taskkill /F /IM node.exe`** — it kills all ~29 MCP servers too. Kill by PID from `netstat -ano`, and never send a destructive command's output to `/dev/null`.
- E2E decks are seeded (`E2E_SEED=<n>`, default `20260728`); `bash scripts/sweep-e2e-seeds.sh 1 25` hunts bad seeds.
