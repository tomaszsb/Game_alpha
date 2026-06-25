# Next session starter — written 2026-06-24 by /koniec

## State at handoff
- **Version:** v3.0.84 — **deployed live 2026-06-24 (commit `b48f1cd`), badge confirmed by the user.** Two fixes improve the live default game; five are behind the opt-in new panel.
- **Branch:** master, clean apart from the usual `.claude/settings.local.json` + untracked `.claude/ghost-history.jsonl`. Wrap-up committed + pushed.
- **Last shipped:** 7 of 18 playtest-feedback reports from one new-panel playthrough — Life-event receipt now NAMES what was lost/gained; "Expeditor" not "E card" in the choice prompt; new-panel glossary terms tappable; "what's affecting you" items tappable (+ pick-list for multi-card chips); spent Life Events grayed; no dead-end Replace Expeditor.
- **Test suite:** full vitest **green** (exit 0; +~10 new). Typecheck clean; build proven by the live deploy.
- **Build/typecheck:** clean.

## Top 3 open items
1. **Remaining new-panel feedback — Pile 2 (needs a maintainer design ruling first).** From the same 18-report sweep, tracked in TODO under "🆕 Dashboard reports — Newly arrived (2026-06-23)": buttons look too alike (per-type color/icon?); first-visit green dot expected on the action buttons not just the commit button; "every button vanishes on press, want a confirmation/undo" (fb:45cb8b0c, d2070ed1, c2e489dc); E-card "Funding phase" label vs. being activatable in Setup — **GameRulesService.canPlayCard:91-99 deliberately allows phase-restricted cards when not on a phased space**, so this is label-vs-rule, a design call (tighten the rule or fix the label) (fb:66bb0bda).
2. **Pile 3 — the change-legibility project.** "Let me recall scope/cost/work packages" (fb:f028e262, cea108fb) + bring back the between-turns move popup (fb:15499d9b) → the Project Chronicle / ledger initiative already a TODO section.
3. **Decision pending — make the new panel the default?** Still opt-in. Plus low-pri: deferred outcome-modal (before→after) restyle; optional E/L `effects_on_play` prose; glossary duplicate-key bug.

## Decisions waiting on the user
- **Pile 2 look-and-feel rulings** (button differentiation, green-dot placement, confirmation/undo, E-card phase label) — surface these as a batch before building; they're the maintainer's taste calls.
- **Make the new panel the default yet?**

## Suggested first move
Ask the maintainer which thread to pull: settle the Pile 2 design rulings (then build them), start Pile 3 (the Chronicle / "remember my numbers" project), or flip the new panel toward default? The 7 clear bugs are done and live, so what's left is genuinely either design decisions or the bigger Chronicle build.

## Reminders
- **Commit + push BEFORE handing over the deploy command.** `deploy.sh` does `git pull origin master` then stamps the badge from HEAD — uncommitted fixes ship as the OLD version (bit us this session; badge stayed 915adaf). Deploy runs from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Confirm the badge shows the new commit.
- **Feedback screenshots are token-gated:** `GET /api/feedback/<id>.json?token=$FEEDBACK_TOKEN` (the `.json` suffix is required); content like the dictionary loads in a cross-origin iframe, so read it from a screenshot, not DOM text. (auto-memory `feedback_screenshot_autoview` updated.)
- **Local browser verify needs BOTH servers:** Express (`npm run server`, 3001) + the preview MCP's Vite (3000). The new panel can be reached at `localhost:3000` after creating a PC game — it persists the "Try new design" toggle. preview_screenshot WORKED with the new-panel ModalBase modals + dictionary open this session (the v3.0.83 "screenshots time out on overlays" note is not universal).
