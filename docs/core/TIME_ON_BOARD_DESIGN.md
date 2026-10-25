# Showing time on the town board: design

**Status:** design only (2026-10-25). Nothing drawn, nothing built, no version, no deploy.
**Asked by:** Tom. **Written for:** Tom (plain words first, file names in brackets for the builder).

Tom's wish, short version: the board should *feel* time pass. (1) A flip-board date in the control corner, with the controls reshaped into a d-pad. (2) The blue area changes look every month (12 looks). (3) Scattered props: trees that grow, flowers, grass, snow drifts, falling snow, rain, sun, clouds.

---

## 1. What exists today (read first, nothing assumed)

| Piece | What I found |
|---|---|
| **The town board** | [TownBoard.tsx](../../src/components/board/TownBoard.tsx). Built on React Flow. One "ground" node (grass island + streets, `TownGround`) and one node per building (`TownBuildingNode`). Layout comes from `TOWN.csv` through [townLayout.ts](../../src/utils/townLayout.ts) (buildings, streets, rooms, and `setting` rows such as `walk_ms`, `bubble_ms`). |
| **The controls** | React Flow's stock `<Controls>` box, bottom-left (TownBoard.tsx ~line 815): zoom in, zoom out, fit view, plus four extra "pan" arrow buttons added as `ControlButton`s. So today it is a tall column of 7 small buttons. The classic board ([BoardCanvas.tsx](../../src/components/board/BoardCanvas.tsx)) has its own copy. |
| **The "blue area"** | It is the **water**, i.e. everything outside the grass island. It is the colour `GROUND[mode].water` (`#8fd0f0` light, `#0f172a` dark) painted twice: behind React Flow and as the React Flow background. The grass island, streets and edge colours sit in the same `GROUND` table. So the blue area is one colour today, no picture. |
| **How days are counted** | Each player has their own `timeSpent` ([DataTypes.ts](../../src/types/DataTypes.ts)), a plain count of days used. Moving to a space adds days to **that player only**. It can also go **down** (good-luck life events and saved days, see `TurnService` around the `timePenalty`/`lifeEvents.timeDelta` code). There is **no calendar date anywhere** in the game. `gameStartTime` exists on the game state but is optional and is a real-clock timestamp, not a game date. |
| **Turn order** | Players take turns in order (`TurnService.nextPlayer`). Several players, each with a different day count, share one board. |
| **How characters and buildings are drawn** | Buildings are flat SVG blocks in a slightly 3-D (isometric) angle, with name signs on top that never tilt. Characters are PixelLab pixel portraits (`public/images/characters`, 400x400; avatars `public/images/avatars`, 64x64 transparent). The recipe, from the trophy-art plan in [BETA_PLAN_V3.md](BETA_PLAN_V3.md): one **locked prompt template** for a whole set, `no_background: true`, 64x64, about **$0.0064 per picture**. |
| **Screens** | **PC:** panel + board. **TV:** board only, big, camera follows the current player, nobody touches it. **Phone:** panel only, **no board at all**. **Remote:** panel + a small board strip on top ([TOWN_BOARD_REVIEW.md](TOWN_BOARD_REVIEW.md) part 7). Phone panel must never get bigger (360x640 and 390x844); this design adds nothing to the phone panel. |
| **Animation facts** | The walk, bubbles and pop-ups already end **by the clock** (`setTimeout`), not by counting frames, because weak TVs give no animation frames. `prefersReducedMotion()` is already used in TownBoard. Game speed (Normal/Fast) already exists. The built-in Browser pane fires **no** animation frames, so animation must be checked with Playwright + Edge (see CLAUDE.md). |

**Plain summary:** there is a board, a pile of buttons in one corner, one flat blue colour, and day counts per player. There is no date, no season, no scenery.

---

## 2. The design, in plain words

### 2.1 Whose date does the board show?

Days belong to each player, but the board is **one picture shared by everybody** (PC table, TV). If the board followed whoever's turn it is, the whole town would jump from winter to summer every time the turn passed to a player with fewer days. That would look broken.

**Plan: the board shows the "town clock" = the latest date among all players** (the player furthest along in days). It only moves forward, except when a good-luck event hands days back to the front player. Under the calendar, one small line names whose day count it is when you want to look ("Sam is on day 42"). One shared scene, one date, nobody sees a jump on a turn change.

(Other choices are in the questions at the end.)

### 2.2 Where does the date come from?

- The game stores **one start date** when it begins (new field, set once from the real "today" on the host). Every screen already receives game state, so every phone and TV gets it with the rest. **No new network traffic.**
- The date shown = start date + the town clock's day count. That is plain date arithmetic, same answer on every device.
- Old games without a start date fall back to the game's creation date.
- Real months, real month lengths. "Year" is the real year of the start date (question 2 lets Tom pick an invented one instead).

### 2.3 The flip board (train-station style)

- Three groups of flaps: **YEAR**, **MONTH** (3 letters, like JAN), **DAY** (number). Order: year, then month, then day, like Tom said.
- When the town clock changes (a player moves and adds days), the groups that changed **shuffle**: each flap cycles through random letters/digits for about 0.6 seconds, staggered left to right, then settles on the new value. Year flips rarely, day flips almost every move.
- **How it is built (cheap):** about 10 small HTML boxes with a CSS flip. The shuffle is a text swap on a timer (`setInterval` every ~70 ms, stopped by a `setTimeout` at ~600 ms). That means it **ends on time even if the TV gives no animation frames**, which is the same safety the walk already has. The 3-D flap tilt is only decoration on top; on a weak TV it is skipped and you just see the characters change.
- **Cost:** no pictures to draw, no libraries. Roughly 10 elements and 10 timers for under a second per move. Negligible.
- **Reduce motion:** no shuffle. The new date appears at once with a short highlight ring so the eye still catches it.
- If the town clock did not change (moves that cost 0 days), nothing flips.

### 2.4 The controls become a d-pad (without growing the panel)

New piece replaces the stock `<Controls>` box in the bottom-left corner:

```
 [ calendar flip board ]
        ^
   <  [fit]  >      [ + ]
        v           [ - ]
```

- **Up / down / left / right** pan the view (same 120-pixel steps as today's arrows). **Middle = fit view.** **+ and -** are zoom, as side buttons.
- Everything is in **one box in the same corner**, drawn as a small wooden/clipboard-style plate to match the town look. It takes about the room today's 7-button column takes, so the board does not lose space.
- **PC:** full size (calendar + d-pad + zoom), buttons at least 40 px.
- **Remote (small strip):** compact. The calendar is one slim line, and the d-pad is folded into a single "view" button; tap it to open the d-pad and tap away to close. The strip does not get taller.
- **TV:** nobody touches a TV and the camera follows the current player, so **no d-pad is drawn there**. The calendar is shown larger (readable from the couch). Keyboard/remote-control arrows still work as today.
- **Phone panel:** untouched. Phones do not show the board, so nothing here can make the phone panel bigger. I would still measure the card (360x640 and 390x844) once, as the existing rule asks.
- The classic board keeps its old controls. (Question: do we want the calendar there too? I say no; the town is the future board.)

### 2.5 The 12 monthly looks for the blue area (data, not code)

A new table, **`TOWN_SEASONS.csv`**, 12 rows (Jan to Dec), loaded the same way as `TOWN.csv`. A different board (a reskin, a teacher's board) swaps the file and gets a different year, no code change. Columns, each in words:

| Column | What it controls |
|---|---|
| `month` | 1 to 12 |
| `water_light`, `water_dark` | the blue (or grey-blue, or icy) for light and dark mode |
| `grass_light`, `grass_dark`, `grass_edge` | the island's colour (fresh green, dry yellow, brown, snowy white) |
| `tint`, `tint_opacity` | a see-through colour laid over the whole scene for the month's **light** (warm gold in summer evening, cold grey in January) |
| `daylight` | 0 to 100, how bright (a dark January is dimmer, but never darker than still-readable; names must stay readable on a TV) |
| `tree_look` | which tree picture (spring blossom, summer, autumn, bare, snowy) |
| `flowers` | how many flower props (0 in winter) |
| `grass_fresh_pct` | share of grass patches that are fresh vs dying |
| `snow_cover_pct` | how many snow drifts show |
| `sun_pct`, `cloud_pct`, `rain_pct`, `snow_pct` | the weather odds (add to 100) |

The water changes smoothly: when the month changes, the water colour fades over about 1.5 seconds (a simple CSS colour transition, no frames needed to end, the final colour is set at once). In reduce-motion it just switches.

Seed values for the New York year (the game is about NYC permits): Jan and Feb icy grey-blue, lots of snow chance; March slate blue, a little snow; April/May bright blue, blossom, rain showers; June to August deep warm blue, sun; September/October steel blue, autumn leaves; November grey with early snow chance; December cold blue with snow.

### 2.6 The props: trees, flowers, grass, drifts, weather

**Two kinds of prop rules:**

1. **Trees are fixed.** Their places are **data**: rows in the same new file (or `kind=prop` rows in `TOWN.csv`): `tree, id, col, row, species, seed`. Placed by hand once on open grass (not on streets, not touching buildings, not under a sign). Never move during the game. About 14 trees.
   - Look by month (leafy, autumn, bare, blossom, snowy) from the table above.
   - **10% bigger each year:** size = start size x 1.1 to the power of (days / 365), capped at about 1.5x so a long game cannot make giants. Smooth, no jump on New Year.
2. **Everything else moves around.** Each non-tree prop has a "slot" and a lifetime (for example flowers live 20 to 40 days). Which spot a slot uses, and when it "expires" so a new prop appears somewhere else, is **calculated from the day number and a fixed seed** (a small hash, `hash(scene_seed, slot, epoch)`), never `Math.random`. Same day number in, same scene out, on every phone, TV and PC, with nothing sent over the network.

**"Correct places":** spots are drawn only from a list of **free grass tiles** the code works out from the layout (inside the island, not on a street, not inside a building plus a one-tile margin, not under a name sign). Then each kind has a taste:

| Prop | Where | When |
|---|---|---|
| Flowers | near trees and along the island edge, on grass | grow bud then bloom through the months; **none in Dec to Feb** |
| Fresh / dying grass patches | open grass | fresh in spring/summer, dying (brown) in late autumn and winter, by `grass_fresh_pct` |
| Snow drifts | against building walls and tree bases, the shady side | only months with snow cover above 0 |
| Falling snow / rain | over the whole screen, not tied to the map | by the weather odds, and **snow only when the month says so** (cold months). Rain never in a snow month's snowy block. |
| Sun | a warm glow in the top-left corner plus a lighter tint | sunny blocks |
| Clouds | 2 to 4 soft shapes drifting slowly over the town, **below the name signs** so they never hide a name | cloudy blocks |

**Weather is picked per 3-day block:** `hash(scene_seed, floor(day/3))` against the month's odds. So one day is not stormy then sunny then stormy; it holds for a few days, and still every screen agrees.

**Layering (so nothing hurts play):** ground decals (grass, flowers, drifts) sit on one extra node *under* buildings; trees are nodes sorted with buildings by depth like the buildings (same z-index rule); clouds sit above ground but below signs; falling rain/snow is a plain overlay on the board's frame (not scaled with zoom), with `pointer-events: none`, below the pop-ups. Signs, walkers, bubbles and the glow on the current building stay on top and unchanged.

### 2.7 Limits so old TVs survive

Three detail levels, set by data (`scene_detail` in `TOWN.csv` settings, default chosen by screen type):

| Level | Used on | Trees | Other props | Falling bits | Clouds |
|---|---|---|---|---|---|
| Full | PC, tablets | 14 | up to 40 | up to 40 | drift |
| Light | TV (all TVs, since I cannot tell a 2021 from a 2025 set) and the Remote strip | 12 | up to 12 | up to 14 | still |
| Calm / off | reduce motion, or a player switch | 14 (still) | up to 12, still | none (a still sprinkle drawn once) | still |

- Everything animated uses only `transform` and `opacity` (cheap on weak chips). Falling bits are one overlay with CSS animations, not one React element per frame.
- A player-visible **Menu to View to Scene: Full / Calm / Off** switch, matching the "menus hide" rule (no loose buttons). A teacher or a class with a slow TV can turn it down in one tap. Nothing about play depends on it.
- The existing hidden-tab/self-heal camera logic is untouched.

### 2.8 How I would check it

- The scene is **one pure function**: `sceneFor(startDate, day, layout, tables, level)` returns the date, month look, tree sizes, prop spots, weather. It is unit-tested: same input twice gives the same answer; no `Math.random` in the file (a test greps for it); months 1 to 12 all have a row; no prop lands on a street or a building; no flowers in winter; snow only in snow months.
- Looks and the flip are checked in Playwright + Edge (the Browser pane cannot play animation), at PC 1920, TV 960x540, remote strip, light and dark; then **Tom on the real TV**.
- The flip ends by timer, so it is also tested with frames switched off.

---

## 3. Cost: steps that ship one at a time

Days are working sessions of AI build time. Pictures are PixelLab, 64x64, one locked prompt template per set (Tom's rule: one template, `no_background`, check the corner pixel).

| Step | What ships | Days | Pictures | Depends on |
|---|---|---|---|---|
| **A. The control dock** | New bottom-left box: d-pad, fit in the middle, zoom on the side; compact form for the Remote strip; hidden on TV. No date yet, no art. | 1.5 | 0 | nothing |
| **B. The date + flip board** | Start-date field in the game, date arithmetic, `TOWN_SEASONS.csv` loader (with the classroom-bake and pipeline tests such a new file needs), the flip-board calendar in the dock, big on TV. | 2.5 | 0 | A (for the place) |
| **C. Monthly water and grass** | The 12 looks as colours and light tints, smooth fade. Pure data, no pictures. | 1 | 0 | B |
| **D. Trees** | Fixed tree places as data, 5 looks, growth 10% a year, depth-sorted with buildings. | 2.5 | 10 (2 kinds of tree x 5 looks) | C |
| **E. Weather and light** | Sun glow, clouds, rain, falling snow, reduce-motion and the Scene switch, the TV "Light" level. | 2 | 3 (cloud shapes; rain, snow and sun are drawn in code) | C |
| **F. Flowers, grass, drifts** | Moving props with lifetimes, the free-tile finder. | 2 | 11 (3 flowers x bud/bloom = 6; grass fresh/dying/dead = 3; drifts = 2) | D |
| **G. Polish and real-TV pass** | Old-TV tuning, phone-panel measure, dark mode, fixes from Tom's TV look. | 1.5 | 0 | all |

**Total about 13 days, 24 pictures.** Money for pictures: at $0.0064 each, 24 pictures with up to 3 tries each (72 generations) is **about $0.46**; with no retries about $0.15. Tom says credits are plentiful, so cost is not the limit. If a picture comes out badly after 4 tries, a plain code-drawn shape stands in so nothing is ever missing.

**Order I would build in:** A, then B (Tom sees a working calendar and new controls fast, nothing else changes), then C (cheap and already changes the mood), then D, E, F, G. Each step can be switched off with the Scene setting and can stand alone. A and B ship even if Tom never wants the scenery.

---

## 4. What could go wrong

1. **Days run backwards.** Life events and saved days can lower a player's day count. If the front player gets days back, the town clock steps back: the date flips backward and a tree shrinks slightly. Rare, and it is true to the game, but it looks odd. Fix if it bothers Tom: only move the clock forward (keep a "highest date seen" number in the game state).
2. **Growth may not be visible.** If a typical game covers under a year of days, "10% bigger each year" is barely noticeable. Tom may want a faster growth rate (still data-driven).
3. **A game that starts in winter** starts in snow; one that starts in July never sees winter. That is true to "today's date" but classes will see different seasons. (Question 2.)
4. **Old TVs choke.** Many moving pieces on a weak chip is the real risk. Hence the caps, the Light level, the Scene switch, and transform/opacity-only animation. I cannot test a 2021 TV here; Tom's TV look in step G is the real test.
5. **Names must stay readable.** Tints, clouds, snow and darker winter light must never reduce the name signs' readability on the TV from the couch. Signs sit above all of it; the tint has a floor on brightness.
6. **Props land in odd places.** The free-tile finder depends on the layout, and a teacher's board with an added square changes it. It needs the same "no building, no street" rule recalculated from that layout; a test covers it.
7. **A new CSV file** needs the loader, the classroom bake and the "pipeline faithful" test taught about it (repeat of past gaps where a data file was written but never read). Budgeted inside step B.
8. **Picture consistency.** A mixed set of tree/flower pictures looks messy. One locked template per set; regenerate a whole set rather than patching one.
9. **Dark mode.** 12 months x light/dark doubles the colour work; the table has both columns so it is done once, but it needs a look.
10. **The built-in Browser pane cannot play animation**, so I cannot show Tom a flip in my own pane; I will check with Playwright and Edge and send a short video or frames.

---

## 5. Questions for Tom (4, my pick first)

1. **Whose date does the board show?**
   - **The latest date among all players (my pick)**: one town clock, only moves forward, no jumping on turn changes.
   - Whoever's turn it is: the town changes season whenever the turn passes between players with different days.
   - The player furthest behind: the board "waits" for the slowest player.

2. **Which start date and year?**
   - **Today's real date and year, as you said (my pick).** Classes see the real season.
   - An invented calendar ("Year 1") with a fixed start in spring, so every class sees all four seasons in the same order.

3. **How busy may the town get?**
   - **Calm (my pick): about 14 trees, up to 12 other things at a time, light weather. Easy on old TVs.**
   - Lively: about 40 other things and more weather on PC (TV stays Light).
   - Minimal: trees and the monthly colours only, no weather.

4. **How do we ship it?**
   - **Controls and calendar first, on their own (my pick), then scenery step by step.**
   - Everything together as one release after step G.
