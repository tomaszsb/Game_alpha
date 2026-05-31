# Next session starter — written 2026-05-31 by /koniec

## State at handoff
- **Version:** v3.0.51 — deployed live. 8-version sprint this session (v3.0.44 → v3.0.51).
- **Branch:** master, clean. Untracked-only: `.playwright-mcp/`, `Mockups/`, `editor-snapshot.yml`, `.claude/fb-fc65c217.png` (screenshot pulled for debugging).
- **Last shipped:** v3.0.51 hotfix wrapping `sessionStorage` in try/catch after Comet white-screened on the haptic-prime gate's useState initializer. Phone load now safe even in restricted storage contexts.
- **Test suite:** 1574/1574 across 85 files (targeted sweep — full `npm test` hangs on Windows). +21 vs prior handoff.
- **Build/typecheck:** both clean.

## Top 3 open items
1. **Comet vibration still doesn't fire after the gesture-prime gate (fb:6e1e8ac4 partial).** v3.0.49 added the tap-to-enter gate; v3.0.51 made it crash-safe. Both confirmed working live. But vibration STILL doesn't fire on turn-start in Comet. Some browsers block Vibration API regardless of user gesture. Next steps: capture user agent in bug reporter, test on stock Chrome Android to isolate Comet-vs-policy, evaluate audio cue fallback (AudioContext unlock window is wider). Tracked in TODO.
2. **Dashboard PATCH-flips pending verification:** `fb:58277eca` (E-card affordability), `fb:fc65c217` (TV setup scrollbar), `fb:6e1e8ac4` (haptic gate — but vibration partial — could mark partial or wontfix-by-design). Verify on next playtest, then flip.
3. **Pick the next feature.** Three TODO clusters wait: (a) Workstream 3 Phase B+ board editor enhancements (`fb:d27a73d0`), (b) plain-English action log Phase 2 enhancements if any surfaced, (c) Comet vibration audio-cue fallback.

## Test failures to address
(None — 1574/1574 green.)

## Decisions waiting on the user
- **Top-3 #1** — should v3.0.52 attempt the audio cue fallback for turn-start, or punt for now? Audio context unlock works in more browsers but needs another UX call (chime vs spoken name vs custom sound).
- **Top-3 #2** — whether to flip `fb:6e1e8ac4` as partial-fix (gate landed, vibration platform-limited) or leave open until audio cue ships.

## Suggested first move
Three flips first if you agree: PATCH-flip `fb:58277eca` + `fb:fc65c217` (cleanly fixed + verified). Then decide whether `fb:6e1e8ac4` is partial-flip or stays-open. Then pick from the open feature backlog.

## Reminders
- Deploy command runs from **Windows terminal**, not WSL.
- **Always `git push` before handing the user a deploy command** — Unraid's deploy script does `git pull` and v3.0.44+45 wasted ~30 min when commits stayed local. CLAUDE.md TACTICAL has the new entry. `git log origin/master..master --oneline` should return empty before you say "ready to deploy".
- Full `npm test` hangs on Windows; use the targeted sweep `tests/components/ tests/utils/ tests/services/`.
- Phone bug reports come back with `consoleSummary.lastError` populated automatically — instead of asking the user to install DevTools on weird browsers, ask them to file a 🐛 report from the broken page.
- Three new CLAUDE.md TACTICAL entries from this session: push-before-deploy, sessionStorage-in-useState-initializer, live UX capture via chrome-devtools MCP.
