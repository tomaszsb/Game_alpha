# Next session starter — written 2026-06-15 by /koniec

## State at handoff
- **Version:** v3.0.80 — committed + pushed, **PENDING RE-DEPLOY**. ⚠️ **Live still runs v3.0.78** — none of v3.0.79/80 is deployed.
- **Branch:** master, clean + pushed (only `.claude/settings.local.json` + `ghost-history.jsonl`, intentional).
- **Last shipped:** v3.0.79 (Phase 3 teacher-layer polish: teachers self-create classrooms + delete + classroom badge + locked-space reason + button-fit; FDNY logic-question auto-answer Q2/Q3/Q4; "🧭 where you're headed next" modal) + **v3.0.80** (Prof Cert grants DOB approval — hotfix for an inescapable loop).
- **Test suite:** koniec targeted sweep **1658/1658** (services+components+utils). Ghost gate validated mid-session: strict green (0 hard failures, wins ≥36), smart-bot + negotiate green. Typecheck + build clean.

## Top 3 open items
1. **RE-DEPLOY v3.0.80 + finish the playtest** — the maintainer's last playtest got stuck in the Prof Cert loop (now fixed) and never finished. The teacher create/delete flow, classroom badge, and FDNY routing modal are still *unverified live* (I built them without seeing them render). Deploy, then walk a game: teacher flow → FDNY fee review routing modal → take **Prof Cert**, pass a roll → should bank DOB approval + NOT loop (confirm roll-1→Audit still does NOT grant).
2. **Phase 4 — card insertion** (teacher-authored spaces). Spec's biggest-risk phase — design pass first, **fresh session**, after v3.0.80 deploys clean.
3. **Onboarding package** (`fb:0aa9660c`+`8ad42b52`+`f22035af`) — biggest product lever, deploy-independent. Or the small **ghost `LOOP` detection** (TODO) so soft-locks like the Prof Cert one can't slip a green gate again.

## Decisions waiting on the user
- **Lift ApprovalService regulatory-space constants to CSV?** (DOB_EXAM/FDNY_EXAM/DOB_AUDIT/FINAL_REVIEW — accepted "defensible domain constants" today.) Offered after the Prof Cert hardcode reminder; user hasn't decided. Tracked as a possible sweep.
- **Routing-modal copy** is first-draft (5 authored reasons in LOGIC_QUESTIONS.csv `yes_reason`/`no_reason`) — maintainer may want to reword in the FDNY-examiner voice.

## Suggested first move
Re-deploy v3.0.80 and finish the playtest — that's the gate on everything (the Prof Cert fix isn't live, and three v3.0.79 UI pieces have never been eyeballed). Want to deploy + playtest first, or start the Phase 4 design pass in parallel?

## Reminders
- Deploy from the **Windows terminal**: `ssh unraid "cd /mnt/user/appdata/Game_alpha && bash deploy.sh"`. Never `docker compose up`. Header should read **v3.0.80** after.
- The maintainer's **stuck Prof-Cert game won't recover** (path-locked, no banked approval) — start a fresh game to test.
- META (CLAUDE.md TACTICAL): auto-answering a previously-manual question can expose latent state gaps — audit that every path writes the state you read. And the ghost gate catches crashes, not soft-locks.
