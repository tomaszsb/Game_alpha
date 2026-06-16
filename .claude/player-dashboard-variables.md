# Player dashboard — all available variables

Reference for the player-dashboard redesign (requested 2026-06-16). Every value
the game already tracks **per player**, grouped by what a player cares about.
Source of truth: `Player` in [src/types/DataTypes.ts](../src/types/DataTypes.ts)
(line 299) + sub-types. "Derived" = not stored but computable for display.

Two existing aggregations are worth mining before designing from scratch — they
already decide what's worth surfacing: `buildEndGameStats`
([src/utils/endGameStats.ts](../src/utils/endGameStats.ts)) and the
before/after `ResourceSnapshot` used in the dice-result modal (StateTypes.ts).

---

## 1. Headline resources (the big numbers)
| Field | Meaning | Type / values |
|---|---|---|
| `money` | Current cash on hand | number ($) |
| `timeSpent` | Days elapsed on the project so far | number (days) |
| `projectScope` | Total size/scope of the project | number |
| `score` | Calculated final score | number |

## 2. Who & where
| Field | Meaning | Type / values |
|---|---|---|
| `name`, `color`, `avatar` | Player identity / styling | string |
| `role` | Assigned role label (e.g. "Strategist") | string |
| `currentSpace` | Where the player's piece is now | space name |
| `visitType` | First time here, or returning | `First` \| `Subsequent` |
| `lastDiceRoll` | Most recent roll | `{ roll1, roll2, total }` |

## 3. Cards
| Field | Meaning | Type |
|---|---|---|
| `hand` | All cards held (IDs) | string[] |
| `activeCards` | Cards currently in play | `{ cardId, expirationTurn }[]` |
| `activeEffects` | Duration effects still ticking | `{ description, remainingDuration, effectType }[]` |
| *(derived)* card counts by type | W / B / E / I / L tallies from `hand` | numbers |

Card types: **W** Work Package · **B** Bank Loan · **E** Expeditor · **I** Investment · **L** Life Event.

## 4. Money IN — where funding came from
| Field | Meaning |
|---|---|
| `moneySources.ownerFunding` | From the owner/founder |
| `moneySources.bankLoans` | From bank loans |
| `moneySources.investmentDeals` | From investors |
| `moneySources.other` | Cards, space effects, etc. |
| `loans` | Outstanding loans: `{ principal, interestRate, startTurn }[]` |
| `fundingHistory` | Itemized funding log: `{ sourceType, cardName, amount, description, turn }[]` |

## 5. Money OUT — where it went
| Field | Meaning |
|---|---|
| `expenditures.design` | Architect/Engineer fees |
| `expenditures.fees` | All regulatory/consultant/expeditor costs |
| `expenditures.construction` | Cost of work from W cards |
| `costs` (CostBreakdown) | Summary buckets: `bank, investor, expeditor, architectural, engineering, regulatory, investmentFee, miscellaneous, total` |
| `costHistory` | Itemized cost log: `{ category, amount, description, turn, spaceName }[]` |

## 6. Regulatory approvals (DOB / FDNY)
| Field | Meaning | Values |
|---|---|---|
| `dobApprovalStatus` | DOB plan-approval state | `none` \| `minor-objection` \| `approved` \| `denied` |
| `fdnyApprovalStatus` | FDNY approval state | same |
| `dobApprovedDestinations` / `fdnyApprovedDestinations` | Where an active approval lets the player go next | space names |

## 7. Contractor (construction)
| Field | Meaning |
|---|---|
| `contractor.quality` | `HIGH` \| `MED` \| `LOW` (affects change-order frequency) |
| `contractor.multiplier` | 1–6, scales base construction cost |
| `contractor.hiredAt` | Space where hired |

## 8. Progress & movement
| Field | Meaning |
|---|---|
| `visitedSpaces` | Every space visited (IDs) |
| `spaceVisitLog` | Per-space detail: `{ spaceName, daysSpent, entryTurn, scopeAtEntry, exitTurn }[]` |
| `moveIntent` | Intended next destination (set before the move) |
| `mainPathResumePoint` | Last main-path space before a detour |
| `hasUsedCheatBypass` | Took the point-of-no-return shortcut |
| `pathChoiceMemory` | Committed path choices: `{ [memoryKey]: destination }` |

## 9. Derived / computed (not stored — compute for display)
| Value | Where it comes from |
|---|---|
| Card counts by type | tally `hand` by first letter |
| Project time progress | `TurnEffectResult.projectTime`: `actionDays, totalDays, estimatedDays, progressPercent, uniqueWorkTypes` |
| Project scope (live) | `GameRulesService.calculateProjectScope` |
| Resource snapshot | `ResourceSnapshot`: `money, projectScope, timeSpent, handCount, cardCountsByType` |
| End-game stats bundle | `buildEndGameStats(player, { projectScope })` — already aggregates fees-vs-funding, turns taken, etc. |

## 10. Turn/game context (from GameState, per player)
| Field | Meaning |
|---|---|
| `playerTurnCounts[id]` | How many turns this player has taken |
| `gameRound`, `globalTurnCount` | Round / absolute turn number |
| `isGameOver`, `winner` | End state |
| `endGamePenalty` | `{ dobMissing, days, fee, playerId }` — penalty for finishing without DOB sign-off |

---

### Notes for the redesign
- **Money has three honest views**: a single `money` number, *where it came from* (§4), and *where it went* (§5). A dashboard can show the headline number with drill-down into both.
- **`expenditures.fees` excludes** bank/investor repayment (those are funding, not fees) — see the v3.0.11–13 note in CLAUDE.md before summing.
- **Approvals are the clearest "are you on track" signal** for the regulatory phase — surfacing DOB/FDNY status prominently likely helps players who get lost there.
- Anything in §1–8 is **stored and free to read**; §9 needs a small compute (helpers already exist).
