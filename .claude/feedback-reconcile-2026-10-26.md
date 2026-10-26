# Feedback reconcile 2026-10-26 - undo list

Open reports before any change (59 found at 2026-10-26; the Manager counted 74 earlier, 15 were resolved in between). To undo a change: `PATCH /api/feedback/<id>` with `{"resolved": false}` (old state was `resolved` missing or false, shown below).

| id | date | old resolved |
|---|---|---|
| feedback-1778327469678-d27a73d0.json | 2026-05-09 | False |
| feedback-1778583921001-0aa9660c.json | 2026-05-12 | None |
| feedback-1778584030168-f22035af.json | 2026-05-12 | None |
| feedback-1778584099671-8ad42b52.json | 2026-05-12 | None |
| feedback-1783919654407-1df093dd.json | 2026-07-13 | None |
| feedback-1784464219688-ae480630.json | 2026-07-19 | None |
| feedback-1789724407248-11662ac3.json | 2026-09-18 | None |
| feedback-1789873168482-3ec9388f.json | 2026-09-20 | None |
| feedback-1789912693092-95624c8e.json | 2026-09-20 | None |
| feedback-1789918146112-102e0953.json | 2026-09-20 | None |
| feedback-1789918649971-4824bc44.json | 2026-09-20 | None |
| feedback-1790020802031-0a827891.json | 2026-09-21 | None |
| feedback-1790512043564-612fbdc4.json | 2026-09-27 | None |
| feedback-1790512401424-cd598be9.json | 2026-09-27 | None |
| feedback-1790512455634-db1d1104.json | 2026-09-27 | None |
| feedback-1790513693908-a31aff46.json | 2026-09-27 | None |
| feedback-1790513772014-ed1b0275.json | 2026-09-27 | None |
| feedback-1790513903295-167f2d0f.json | 2026-09-27 | None |
| feedback-1790939049674-a0cecb6a.json | 2026-10-02 | None |
| feedback-1790939218940-7fbea636.json | 2026-10-02 | None |
| feedback-1790939744698-8cb652c4.json | 2026-10-02 | None |
| feedback-1790939931163-adb1cc76.json | 2026-10-02 | None |
| feedback-1791152358714-c0d3bfb8.json | 2026-10-04 | None |
| feedback-1791152587557-1c6980b4.json | 2026-10-04 | None |
| feedback-1791152835560-adbcf2e5.json | 2026-10-04 | None |
| feedback-1791153354416-6321757b.json | 2026-10-04 | None |
| feedback-1791153740536-bbeb13e2.json | 2026-10-04 | None |
| feedback-1791345259783-8cf62098.json | 2026-10-07 | None |
| feedback-1791345390312-adb72ed9.json | 2026-10-07 | None |
| feedback-1791345516168-929a5e99.json | 2026-10-07 | None |
| feedback-1791900859467-4e8a8550.json | 2026-10-13 | None |
| feedback-1791901448969-5617effb.json | 2026-10-13 | None |
| feedback-1791901573827-5b8a060c.json | 2026-10-13 | None |
| feedback-1791902857820-aec545c4.json | 2026-10-13 | None |
| feedback-1791906776787-bf9dd267.json | 2026-10-13 | None |
| feedback-1791908062758-f9e897b0.json | 2026-10-13 | None |
| feedback-1791908314918-a49b598f.json | 2026-10-13 | None |
| feedback-1791952023966-a6474bad.json | 2026-10-14 | None |
| feedback-1791952302851-5c8e37c4.json | 2026-10-14 | None |
| feedback-1791952662211-08dbbe87.json | 2026-10-14 | None |
| feedback-1791952848492-3fec0e88.json | 2026-10-14 | None |
| feedback-1791952962959-4db1b1d9.json | 2026-10-14 | None |
| feedback-1791953331375-c1dc207d.json | 2026-10-14 | None |
| feedback-1791953606163-bf6176e5.json | 2026-10-14 | None |
| feedback-1791953847945-53a47779.json | 2026-10-14 | None |
| feedback-1792026361720-3c938084.json | 2026-10-15 | None |
| feedback-1792026428662-b6b93adf.json | 2026-10-15 | None |
| feedback-1792386618284-cd4d445e.json | 2026-10-19 | None |
| feedback-1792386963843-1b7607e9.json | 2026-10-19 | None |
| feedback-1792387120732-c61ec1f2.json | 2026-10-19 | None |
| feedback-1792387176559-83fcc4c4.json | 2026-10-19 | None |
| feedback-1792531765787-1007f455.json | 2026-10-20 | None |
| feedback-1792542634551-92e01028.json | 2026-10-21 | None |
| feedback-1792542798017-b5689dfa.json | 2026-10-21 | None |
| feedback-1792552635734-8cf8665e.json | 2026-10-21 | None |
| feedback-1792813434042-5d7e02d9.json | 2026-10-24 | None |
| feedback-1792813705217-52afd411.json | 2026-10-24 | None |
| feedback-1792814251707-75dd41ec.json | 2026-10-24 | None |
| feedback-1792895750502-5618257f.json | 2026-10-25 | None |

## Decisions (2026-10-26)

The PATCH to mark FIXED / DECIDED reports resolved was NOT run: the live-server write was blocked by the permission check. Nothing on the server changed; every report is still in the old state above.

### FIXED (22), ready to mark resolved
- 11662ac3: 3.2.93 glow on every active button all game
- 95624c8e: 3.2.93 same glow fix
- ae480630: 3.2.93 same glow fix
- 102e0953: 3.7.41 expeditor "Free" label
- a31aff46: 3.7.42 avatar on phone
- 3c938084: 3.8.1 empty picture spot
- a0cecb6a: 3.2.93 screen-size button moved to header
- adb1cc76: 3.2.91 quote no longer ends a game
- bbeb13e2: 3.7.1 lost approval no longer vanishes
- 4e8a8550: 3.7.29/3.7.31 clipboard tabs, colour tint, icons
- 5617effb: 3.7.26 funding circle shows percent
- 5b8a060c: 3.7.25 one bubble not two
- aec545c4: 3.7.27 trailer on site, ribbon cutting hidden
- bf9dd267: 3.7.37 home/away icon and players in Active Games
- a49b598f: 3.7.43 DOB shown once
- 08dbbe87: 3.7.36 size panel no longer slides
- bf6176e5: 3.7.36 same
- 3fec0e88: 3.7.36 money page shows where money came from
- 4db1b1d9: 3.7.40 tax card now has an effect
- c1dc207d: 3.8.26 violation explained
- 83fcc4c4: 3.8.34 pop-up snapped flat
- b5689dfa: 3.8.34 pop-up snapped flat

### IDEA / DECIDED OTHERWISE (7), ready to mark resolved
- 3ec9388f: 3.7.42 checked: summary is authored story copy (voice rule)
- 4824bc44: 3.7.41 checked, not a bug
- 6321757b: 3.7.1 measured 1 in 6 per turn, by design
- 53a47779: press-and-hold End Turn decided 10-14
- 8cf62098: town board with buildings built
- adb72ed9: clipboard panel built
- 929a5e99: rooms in buildings built (TOWN.csv)

### CAN'T TELL (12), left open
- 1007f455
- 8cf8665e
- a6474bad
- 92e01028
- c61ec1f2
- d27a73d0
- 0aa9660c
- 8ad42b52
- 1c6980b4
- adbcf2e5
- c0d3bfb8
- cd4d445e

### STILL OPEN (18), left open, listed in TODO.md Bugs
- 5618257f
- 75dd41ec
- 5d7e02d9
- 52afd411
- 1b7607e9
- 0a827891
- 612fbdc4
- cd598be9
- db1d1104
- f22035af
- ed1b0275
- 167f2d0f
- 8cb652c4
- 7fbea636
- f9e897b0
- 5c8e37c4
- b6b93adf
- 1df093dd

## Update 2026-10-26 (later)

The PATCH was run by the Manager with Tom's OK: the 22 FIXED and 7 DECIDED reports above were marked resolved, 29 of 29, each read back. The note near the top saying the PATCH was not run is out of date. To undo, PATCH `{"resolved": false}` for those 29 ids.
