# Next session starter — written 2026-07-03 by /koniec

## State at handoff
- **Version:** v3.0.94 (**pending deploy** — user was handed the deploy command; live is v3.0.92)
- **Branch:** master, clean except `.claude/settings.local.json` (local config, fine)
- **Last shipped:** v3.0.93+94 — Chronicle turn-dividers, dark-mode V2 modal bodies, tablet-tappable glossary links + 6s iframe fallback, EffectFactory double time-effect removed
- **Test suite:** full suite 2,293 passed / 1 skipped this session; koniec sweep 1818/1818
- **Build/typecheck:** clean

## Top 3 open items
1. **Verify the deploy + tablet-check the glossary tap fix.** The `cursor: help` → `pointer` cause for fb:baa01a70 is **hypothesis — unverified on a real iPad** (desktop path proven working). If a tablet playtest still can't tap terms, the next suspect is the tap landing inside the dashboard IFRAME content (dashboard repo, embedded=true view).
2. **Dashboard PATCH sweep (after deploy confirms).** Flip `resolved:true` for: 1eff7156, baa01a70, c51f9f16 (this session) + the earlier pending batch 9c110d52, 8d68ab14, 222cd521, 1990c71e, 40caa223, 06f7da3b, b53864af. All are CODE fixes — no data-deploy-gap check needed.
3. **Standalone bug pair, likely related:** Move button disappeared after the bug-report popup (fb:bf8bf19a) and buttons gone after zooming the board (fb:45cb8b0c) — both "panel controls vanished mid-game"; check for a shared cause (focus/overlay state?) before fixing separately.

## Test failures to address
(green)

## Decisions waiting on the user
- None new. (Standing: E/L `effects_on_play` prose authoring is optional/deferred; new-view Action+Outcome rationale question fb:f6e100b7 is addressed *to* the maintainer.)

## Suggested first move
Confirm v3.0.94 deployed (header should read v3.0.94 · 9685bfa ✓ — or the koniec commit's hash if that shipped after), then run the dashboard PATCH sweep — ~10 reports are shipped-but-unflipped, which pollutes the next feedback pull. After that, the bf8bf19a/45cb8b0c "buttons vanished" pair is the meatiest open bug.

## Reminders
- Deploy command runs from a Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- Preview-browser gotcha (cost time this session): a hidden preview tab freezes rAF → framer-motion modals look stuck open. Check `document.hidden` before chasing "modal won't close."
- Two parallel card-play effect parsers exist (CardService.parseCardIntoEffects vs EffectFactory.createEffectsFromCard) — see CLAUDE.md TACTICAL (charter 3.52) before touching card effects.
