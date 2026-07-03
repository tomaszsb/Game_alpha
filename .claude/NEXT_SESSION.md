# Next session starter — written 2026-07-03 by /koniec

## State at handoff
- **Version:** v3.0.94 — **DEPLOYED 2026-07-03** (user confirmed header reads v3.0.94 · c0dfb10 ✓)
- **Branch:** master, clean except `.claude/settings.local.json` (local config, fine)
- **Last shipped:** v3.0.93+94 — Chronicle turn-dividers, dark-mode V2 modal bodies, tablet-tappable glossary links + 6s iframe fallback, EffectFactory double time-effect removed
- **Test suite:** full suite 2,293 passed / 1 skipped this session; koniec sweep 1818/1818
- **Build/typecheck:** clean

## Top 3 open items
1. **Tablet-check the glossary tap fix (fb:baa01a70).** The `cursor: help` → `pointer` cause is **hypothesis — unverified on a real iPad** (desktop path proven working). If a tablet playtest still can't tap terms, the next suspect is the tap landing inside the dashboard IFRAME content (dashboard repo, embedded=true view).
2. **Triage the 2026-07-03 playtest feedback.** v3.0.94 deployed right before a playtest night; expect fresh reports. Dashboard was at 62 open after the sweep (see below).
3. **Standalone bug pair, likely related:** Move button disappeared after the bug-report popup (fb:bf8bf19a) and buttons gone after zooming the board (fb:45cb8b0c) — both "panel controls vanished mid-game"; check for a shared cause (focus/overlay state?) before fixing separately.

## Test failures to address
(green)

## Decisions waiting on the user
- None new. (Standing: E/L `effects_on_play` prose authoring is optional/deferred; new-view Action+Outcome rationale question fb:f6e100b7 is addressed *to* the maintainer.)

## Suggested first move
The PATCH sweep already ran post-deploy (2026-07-03): all 10 shipped reports flipped resolved, dashboard 72 → 62 open. Start by pulling any NEW reports from the post-deploy playtest; if quiet, the bf8bf19a/45cb8b0c "buttons vanished" pair is the meatiest open bug.

## Reminders
- Deploy command runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- Preview-browser gotcha (cost time this session): a hidden preview tab freezes rAF → framer-motion modals look stuck open. Check `document.hidden` before chasing "modal won't close."
- Two parallel card-play effect parsers exist (CardService.parseCardIntoEffects vs EffectFactory.createEffectsFromCard) — see CLAUDE.md TACTICAL (charter 3.52) before touching card effects.
