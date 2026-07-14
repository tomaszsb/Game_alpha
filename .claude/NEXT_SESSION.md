# Next session starter — written 2026-07-14 by /koniec

## State at handoff
- **Version:** v3.0.137 built and pushed. Last maintainer-confirmed deploy was v3.0.115 (2026-07-12); **v3.0.116–137 pending deploy** (22 versions stacked — confirm against live before assuming anything newer than 115 is out).
- **Branch:** master, clean (only pre-existing session-state files uncommitted — `.claude/fixloop/*`, `.claude/settings.local.json` — not part of this session's work).
- **Last shipped:** classic player panel removed entirely (~7000 net lines) after an A/B experiment settled on a press-and-hold merged commit control, unified across light and dark mode; setup-screen hero header + a real TV-mode legibility/scroll fix; a "Remote" mode placeholder; board camera got space-size-aware zoom + per-device viewport memory. Full detail in CHANGELOG v3.0.128–137.
- **Test suite:** **2343/2344 passing, 1 skipped, 0 failures** (all 5 ghost gates green, 628s).
- **Build/typecheck:** clean.

## Top 3 open items
1. **Deploy v3.0.116–137**, then PATCH-flip fb:f453b1f3 + fb:7dbc2fcc (queued in `.claude/fixloop/flip-queue.txt`).
2. **TV-mode fix needs real hardware confirmation** (fb:3f9f2831/e121c34e) — best-effort code fix shipped (10-foot-UI zoom + real keyboard scroll), verified via math/DOM inspection only, no actual smart TV available. Don't flip those two reports until someone confirms on a real TV.
3. **Architecture parking lot, newly documented, all trigger-gated (not urgent)** — TurnService (2191 lines/16 methods) worth eventually splitting into a staged pipeline, which also serves the maintainer's long-term D&D-reskin reuse goal; PlayerSetup.tsx (2090 lines) is a monolith worth decomposing; a domain-event architecture (building on the already-present `StateService.subscribe()` foundation) is the most interesting long-term direction but needs a dedicated design pass first.

## Decisions waiting on the user
- **Board layout** / **Bank/Investor/Lender naming** — standing, don't nudge.
- **Homeowner starting scenario** — direction decided, needs a design pass on the mechanic itself.

## Flip after deploy
- fb:f453b1f3, fb:7dbc2fcc — fixed in v3.0.128–133; PATCH resolved once v3.0.116–137 is confirmed live.
- fb:3f9f2831, fb:e121c34e — **do NOT auto-flip** even after deploy; needs real-TV confirmation first (see item 2 above).

## Suggested first move
Deploy v3.0.116–137 first — nothing blocking it. After that: your call between the CSV-portability lift, getting TV-hardware eyes on the setup-screen fix, or picking one of the parking-lot architecture items to actually scope out.

## Suggested model for next session
**Sonnet 5** — normal scoped work; nothing in the top-3 is architecturally ambiguous enough to need Opus.

## Reminders
- Deploy command runs from Windows terminal, not WSL: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`.
- A maintainer-forwarded external review of this CHANGELOG (changelog-text-only, no code access) flagged 10 architectural points — most were incorporated into TODO's parking lot as noted above, but two were pushed back on with reasoning already recorded there: the cost-preview code is already cleanly factored (not the tangle the review inferred from the feature narrative), and "six notification systems" overstates what's really a handful of legitimately-different UI patterns (modal/banner/toast serve different urgency levels). If more outside reviews come in, verify specific claims against the actual code before acting — one example in this batch (a feature-flag citation) was already stale within the same day it was raised.
