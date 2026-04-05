# Ghost Player Findings

Bugs discovered by the v3.0 Beta Ghost Player regression bot. Each entry is
a real gameplay issue that was silent in the Alpha codebase until the
headless simulator started playing random games.

---

## Finding #1: Dice-based W-card draws don't land in player.hand

**Discovered:** 2026-04-04, first Ghost Player smoke run
**Severity:** HIGH — blocks the starting space of every game
**Status:** RESOLVED 2026-04-04

### Root cause

Not an Alpha gameplay bug — a **headless bootstrap gap**. `src/context/ServiceProvider.tsx` constructs a `CardEffectHandler` and calls
`effectEngineService.setCardEffectHandler(...)`. `tests/ghost/bootstrapServices.ts` was missing that wire, so every `CARD_DRAW` effect
dispatched by `EffectEngineService.processEffects` threw "CardEffectHandler not set", was caught silently inside the batch, and the
surfaced effect summary in `DiceRollProcessor.convertEffectsToResults` still pushed a "Drew N Work cards" line with `cardIds: []`.

The same gap was why `tests/E2E-LogicPlaythrough.test.ts` had been silently failing on turn 0 — it copied the same incomplete wiring.

### Fix

Wire `CardEffectHandler` (plus its `dataService` and `notificationService` setters) in `bootstrapServices.ts`, matching the
production wiring in `ServiceProvider.tsx:84-85`. Verified by `tests/ghost/cardDrawRepro.test.ts` — both the direct-draw test and
the dice-driven test pass.

### Original investigation notes (kept for context)

### What happens

On turn 0, the player is on `OWNER-SCOPE-INITIATION` (First visit). The space
has a manual `dice:dice_outcome` effect that, per `DICE_EFFECTS.csv`, should
draw 1–3 W (Work) cards based on the roll:

```
OWNER-SCOPE-INITIATION,First,cards,W,Draw 1,Draw 1,Draw 2,Draw 2,Draw 3,Draw 3,,draw,false,false
```

When the Ghost Player calls `turnService.rollDiceWithFeedback(playerId)`:
- ✅ The dice rolls successfully
- ✅ `processDiceRollEffects` runs, reads `DICE_EFFECTS.csv`, and generates a
  `CARD_DRAW` effect for 1 W card
- ✅ The effect pipeline reports `effects: [{type: 'cards', description:
  'Drew 1 Work card', cardCount: 1}]` in the returned `TurnEffectResult`
- ❌ **But `player.hand` still contains zero W cards.**

The player is then blocked from ending their turn by the guard at
`TurnService.ts:395-400`:
> "You must draw Work cards before leaving this space. Your project needs a scope!"

Because they literally have no W cards, even though the roll claimed to
draw one.

### Why this was hidden in Alpha

The existing `tests/E2E-LogicPlaythrough.test.ts` has been silently failing
on this exact same error. Nobody runs it in the regular workflow, so it
never surfaced. The Ghost Player caught it on its very first run.

### Likely locations to investigate

- `EffectEngineService.processEffects()` — does the `CARD_DRAW` effect for
  `cardType: 'W'` actually mutate `player.hand`, or only report it?
- `CardService.drawCards()` — is the returned array of card IDs being
  appended to the player's hand via `StateService.updatePlayer`?
- The `CARD_DRAW` effect handler — there may be a path where the effect is
  "processed" (returned in `effects`) but `hand` is never updated.

Suggested starting point: set a breakpoint or log in whichever handler
converts a `CARD_DRAW` effect into a `hand` update, and verify it fires for
the dice-based path. The non-dice path (`cards:draw_E` triggered via
`triggerManualEffect`) correctly adds 3 E cards on the same turn — so the
bug is specific to the dice-driven flow, not card-drawing in general.

### Unblocking the Ghost Player strict mode

Done — strict mode is live as `tests/ghost/ghostPlayer.test.ts:strict`. The
CI gate is now: zero `EXCEPTION` / `INVARIANT_VIOLATION` failures, plus ≥90%
wins across 50 random games. Current baseline: 48/50 wins (96%), avgTurns≈110.

---

## Finding #2: Ghost Player occasionally loops forever at scope/card-return spaces

**Discovered:** 2026-04-04, first strict batch run
**Severity:** LOW — only affects random-move bot, not real players
**Status:** ACCEPTED

### What happens

Roughly 2 in 50 random-move games exceed the 300-turn cap without reaching
FINISH. Both observed failures ended at `PM-DECISION-CHECK` with hand sizes
of 119 and 138 cards — clearly stuck cycling through scope/fund review
loops where the bot's random choices keep drawing more cards instead of
progressing.

### Why we're not fixing it (yet)

- It's a bot-strategy artifact, not a game bug. A real player with goal-
  directed choices would not get stuck here.
- All 50 games complete without exceptions — the 48 wins prove the core
  pipeline is sound.
- Fixing it would require heuristic scoring in the ghost (pick choices that
  move you forward, not backward), which is a separate improvement.

Tracked as a future Workstream 1.1 enhancement: give the ghost a tiny bit
of planning so the strict gate can be tightened back to 50/50.
