# Robot play-test, 2026-10-25 (v3.8.84, local, 30 seeded games)

Run: `ROBOT_PLAY=30 npx vitest run --config vitest.config.ghost.ts tests/ghost/robotPlaytest.test.ts` (seed = 920001 + game #). `ROBOT_ONLY=9,15` replays chosen games; `ROBOT_DUMP=<n>` writes that game's money lines to `.tmp/robot-dump.json`.

Result: 27 finished, 3 lost (all solo, bankruptcy right after the robot hired a builder it could not afford), 0 crashes, 0 loops, 0 turn caps, 0 check failures.

| # | seed | seats | reps | auto-run | ended | turns |
|---|---|---|---|---|---|---|
| 0 | 920001 | 1 | no rep | on | FINISHED | 60 |
| 1 | 920002 | 2 | no rep | off | FINISHED | 197 |
| 2 | 920003 | 4 | no rep | on | FINISHED | 214 |
| 3 | 920004 | 1 | good Permits | off | FINISHED | 29 |
| 4 | 920005 | 2 | good Permits | on | FINISHED | 196 |
| 5 | 920006 | 4 | good Permits | off | FINISHED | 280 |
| 6 | 920007 | 1 | bad Code | on | FINISHED | 155 |
| 7 | 920008 | 2 | bad Code | off | FINISHED | 186 |
| 8 | 920009 | 4 | bad Code | on | FINISHED | 303 |
| 9 | 920010 | 1 | bad Permits | off | LOST bankruptcy (hired a builder it could not pay for) | 25 |
| 10 | 920011 | 2 | bad Permits | on | FINISHED | 44 |
| 11 | 920012 | 4 | bad Permits | off | FINISHED | 251 |
| 12 | 920013 | 1 | bad Inspections | on | FINISHED | 75 |
| 13 | 920014 | 2 | bad Inspections | off | FINISHED | 197 |
| 14 | 920015 | 4 | bad Inspections | on | FINISHED | 461 |
| 15 | 920016 | 1 | good Code + bad Inspections | off | LOST bankruptcy (same cause) | 15 |
| 16 | 920017 | 2 | good Code + bad Inspections | on | FINISHED | 70 |
| 17 | 920018 | 4 | good Code + bad Inspections | off | FINISHED | 334 |
| 18 | 920019 | 1 | no rep | on | FINISHED | 57 |
| 19 | 920020 | 2 | no rep | off | FINISHED | 169 |
| 20 | 920021 | 4 | no rep | on | FINISHED | 253 |
| 21 | 920022 | 1 | good Permits | off | LOST bankruptcy (same cause) | 43 |
| 22 | 920023 | 2 | good Permits | on | FINISHED | 107 |
| 23 | 920024 | 4 | good Permits | off | FINISHED | 326 |
| 24 | 920025 | 1 | bad Code | on | FINISHED | 110 |
| 25 | 920026 | 2 | bad Code | off | FINISHED | 220 |
| 26 | 920027 | 4 | bad Code | on | FINISHED | 269 |
| 27 | 920028 | 1 | bad Permits | off | FINISHED | 46 |
| 28 | 920029 | 2 | bad Permits | on | FINISHED | 99 |
| 29 | 920030 | 4 | bad Permits | off | FINISHED | 245 |
