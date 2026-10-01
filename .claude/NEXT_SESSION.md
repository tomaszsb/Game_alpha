# Next session starter — written 2026-09-30 by /koniec; amended 2026-10-01 (v3.2.90 shipped + deployed)

## State at handoff
- **Version:** v3.2.90 — **deployed** (`/health` = `d8a07f9`, 2026-10-01 07:21 EDT). v3.2.89 had been live since before 2026-10-01. v3.2.90 fixes the phone-becomes-TV bug: the QR link carried `&mode=tv` since v3.2.81 (fb:84b491f2, ec243622, a1260bfc, dc04ea53; likely 1ef35f42 — ef974f1c and b38110f3 are NOT the same cause). **Tom must re-scan a QR on a real phone with the TV in TV mode, then flip those four resolved.**
- **Branch:** master, pushed, clean (only `idea.txt` untracked — read it, never modify or commit it).
- **Last shipped (2026-09-30, five releases):** v3.2.85 push-back returns a deal's quoted money (the nightly robot's Bank Review bankruptcy; new `try_again_fee_share` column); v3.2.86 five TV fixes (saved size everywhere, resize before game, popup under its button, wake lock, camera keeps your own tile on screen); v3.2.87 DOB/FDNY ✓/✗ tags + legible phone header buttons; v3.2.88 destination list no longer vanishes after 5 min at a space; v3.2.89 nodemailer 10 (security) + vitest 5 + dependency refresh.
- **Tests:** `npm test` 453 files / 7065 tests green; ghost 11 files / 43 tests green; typecheck ✅, build ✅, lint 0 errors, `npm audit` 0 vulnerabilities.
- **GitHub:** no open PRs. **Dashboard:** 23 open (ten fixed reports were flipped resolved this session at Tom's word).
- **Memory-graph MCP tool is still broken** (schema-validation error on every call). Skip it; the file-based memory in `memory/` is what works.

## Top 3 open items (full backlog in TODO.md)
1. **Deploy v3.2.89, then Tom looks on a real TV + phone.** The TV wake lock (fb:e766b9c2) and the auto-center fix (fb:5de29661) can't be proven without the TV; both were flipped resolved anyway at Tom's word — reopen if they disagree. If the TV still sleeps, next step is a hidden looping-video fallback (`utils/wakeLock.ts` header).
2. **Decisions waiting on Tom (TODO "Decisions waiting"):** (a) how much of the architect's/engineer's quoted fee stays paid on push-back — `try_again_fee_share` is 1 (today's behaviour) on the four ARCH/ENG-FEE-REVIEW rows; changing it is four CSV cells + `node scripts/regen-clean-files.mjs`, but first check how the 20% design-fee cap counts a refunded fee; (b) scope wording (fb:612fbdc4); (c) should action buttons glow on later visits, not only the first (fb:ae480630 part 1, fb:11662ac3, fb:95624c8e); (d) "go" on the "?" placement work.
3. **fb:ab383e78 (contractor bankruptcy)** — fixed v3.2.83, deployed; still waiting for Tom to re-try the contractor flow on a real device before it is flipped (may also cover fb:ef974f1c / fb:1ef35f42 / fb:b38110f3 — unconfirmed link).

## Decisions waiting on the user
- The four above (fee share, scope wording, later-visit glow, "?" placement).

## Flip after deploy
- **fb:ab383e78** (+ maybe fb:ef974f1c / fb:1ef35f42 / fb:b38110f3) — only after Tom confirms the contractor flow on a real device.
- **fb:93449bf2** (TV screen-size Job 3) — after Tom's real-TV look; also check the header row at the biggest size.

## Suggested first move
Ask Tom whether v3.2.89 is deployed (`/health`), then whether he has looked at the TV (sleep, auto-center, popup position) and the phone (DOB/FDNY tags, header buttons) — reopen any report that disagrees. If not, pick up decision (a) or (c) with him.

## Suggested model for next session
Sonnet 5 — follow-ups from real-device feedback and design-direction questions, nothing long-horizon.

## Reminders
- **Anything you hand Tom to run goes into Windows PowerShell:** no `grep`; use `curl.exe` explicitly, or run read-only checks yourself.
- **Deploy is Tom's:** `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`; confirm with `/health`. You may run read-only `ssh unraid` checks (e.g. `git log -1`, `docker ps`) to diagnose a stuck deploy.
- **Pull feedback screenshots from the per-id endpoint BEFORE writing up any report as unclear** — the public `open` endpoint never carries one (this paid off three times this session).
- **Scripted file edits:** use the Write tool, not bash heredocs with apostrophes or `\n` in Python strings; `App.tsx` and `ChoiceService.test.ts` are CRLF — count `\r\n` vs bare `\n` after any scripted edit (CLAUDE.md TACTICAL, v3.2.85–89 entry).
- **Dev servers:** if verifying UI needs both, start Express via Bash, preview MCP owns 3000, and kill Express by PID at the end.
