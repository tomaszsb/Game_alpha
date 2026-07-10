---
description: One budget-gated iteration of the autonomous fix loop — meter check, pick a bug, route the right model, verify, land. Run via `/loop /fixloop`.
---

One iteration of the autonomous fix loop. Designed to be fired repeatedly by `/loop /fixloop` (dynamic pacing). Each iteration: check the budget meter → pick ONE issue → spawn the right-sized model agent → verify → commit → log → tell the loop when to fire next.

## Arguments — midweek recalibration (no iteration)

If `$ARGUMENTS` contains `calibrate <number>` (e.g. `/fixloop calibrate 34`), the user just read their official `/usage` screen: run `node scripts/fixloop-usage.mjs --calibrate <number>`, report the new weekly budget + headroom, and do NOTHING else this invocation. Same if the user says "usage is X%" in plain words mid-loop — treat it as a calibrate.

This matters because the local meter only sees THIS machine: the user also works from a phone and a work machine (invisible here), and their plan has occasionally reset mid-week. Recalibrating re-anchors local receipts to the official number in one step, in either direction. **Once a day** (first iteration after a day-boundary), append one line to the report: *"Reminder: if you've used Claude on your phone/work machine, reply `usage is X%` (from /usage) and I'll re-anchor."*

**The orchestrator's own tokens count against the budget too.** Keep this session lean: no re-reading large files already in context, no narration, targeted reads only. The loop session should ideally run on Sonnet 5.

## 0. Budget gate — always first

```bash
node scripts/fixloop-usage.mjs
```

- `reason: "not calibrated"` or `"reset day not set"` → **stop the loop** (ScheduleWakeup `stop: true`) and tell the user which setup command to run. Never guess a budget.
- `ok: false, reason: "daily cap reached"` → do NO work. Report one line (`Cap: used X% ≥ day-N cap Y%`), schedule next wakeup at **3600s**, end turn. Tomorrow's cap unlocks more headroom automatically.
- `ok: true` → proceed. Note `headroomPct` — it gates model routing (step 2).

## 1. Pick ONE issue

Sources in priority order (read TODO.md once per iteration; it's slim now):
1. **🔎 Active — bugs & investigations** (top section)
2. **🆕 Newly arrived** staged dashboard reports
3. Remaining **Active** sections top-to-bottom

**Skip — never pick:** anything under "Decisions waiting on the user"; anything needing a real phone/tablet/human playtest to verify; anything marked don't-nudge; deploys (NEVER deploy — the user runs `deploy.sh` themselves); TODO/doc restructuring; Parking-lot items.

If a `.claude/fixloop/state.json` exists with an `inFlight` item, resume/verify that instead of picking new.

If nothing eligible remains → **stop the loop** with a summary of what's left and why each was skipped.

## 2. Route the model ("power level")

| Route | When | Guard |
|---|---|---|
| **Sonnet 5** (default) | Scoped bugs, copy/CSV fixes, single-component UI work, anything verifiable by tests + preview | always allowed |
| **Opus 4.8** | Architecturally ambiguous, cross-service, or a task Sonnet already failed once this loop | needs `headroomPct ≥ 5` |
| **Fable 5** | Hardest reasoning only (e.g. the 6x-subscription mystery if Opus fails) — rare | needs `headroomPct ≥ 12` |

If the right model isn't affordable right now, pick a smaller eligible issue instead; if none, treat as cap-reached (sleep 3600s). Escalation path is one step at a time (Sonnet → Opus → Fable), and a Fable dispatch should be flagged in the iteration report.

## 3. Spawn the agent

`Agent` tool, `subagent_type: general-purpose`, `model:` per step 2, `run_in_background: false`. The prompt must be self-contained:
- The issue (verbatim report text + fb:id if any), repro/verify steps, likely files.
- Ground rules: player-facing copy follows CLAUDE.md voice rules (NPC speaker, no game language); reuse existing services/handlers — no logic forks; typecheck + build + targeted tests must pass; live-verify UI changes via the preview flow (Express 3001 + Vite 3000 — see CLAUDE.md); do NOT deploy, do NOT touch TODO.md/CHANGELOG.md (orchestrator owns those); report exactly what changed and how it was verified.
- Write `.claude/fixloop/state.json` `{inFlight: <item>}` before spawning; clear it after landing.

## 4. Land it (orchestrator, not the agent)

1. Sanity-check the agent's diff (`git diff --stat` + skim the changes — does it match the claim?).
2. `npm run typecheck && npm run build` + the targeted tests the agent named. Red → one retry with the failure fed back; still red → `git checkout -- .`, log the failure, move on.
3. Bump patch version, append the CHANGELOG entry (why, not just what), delete the TODO item, commit (`fix(scope): ...` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`), push.
4. If the fix closes a dashboard report: append the full fb id to `.claude/fixloop/flip-queue.txt` (flipped only after the user deploys — never before).

## 5. Log + schedule the next iteration

Append one line to `.claude/fixloop/log.jsonl`:
`{ts, item, fbId, model, outcome: fixed|failed|skipped, usedPctAfter, commit}`

- 3 consecutive `failed` → **stop the loop**, summarize.
- Otherwise report 2–3 lines (what landed, budget now vs cap) and schedule: **120–270s** if continuing (stay in cache), **3600s** if the meter says the next iteration wouldn't fit.

**Session hygiene:** if this session's context has grown very long (many iterations), prefer finishing the loop's day at the cap rather than degrading — the next `/loop /fixloop` session starts fresh.
