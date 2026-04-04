# Ghost Player Findings

Bugs discovered by the v3.0 Beta Ghost Player regression bot. Each entry is
a real gameplay issue that was silent in the Alpha codebase until the
headless simulator started playing random games.

---

## Finding #1: Dice-based W-card draws don't land in player.hand

**Discovered:** 2026-04-04, first Ghost Player smoke run
**Severity:** HIGH — blocks the starting space of every game
**Status:** OPEN

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

Once this bug is fixed, convert the `it.skip(...)` in
`tests/ghost/ghostPlayer.test.ts` back to `it(...)` and the 50-game batch
becomes the CI regression gate for the rest of v3.0 Beta work.
