# Showing time on the town board: design

**Status:** design only, **all decisions made** (2026-10-25): stripes along the player bands, d-pad-only corner box, one clock per player at the top of their band, start at today's real date, calm town, controls and clocks first. Nothing drawn, nothing built, no version, no deploy. Final build order is section 6.
**Asked by:** Tom. **Written for:** Tom (plain words first, file names in brackets for the builder).

Tom's wish: the board should *feel* time pass. (1) A flip-board date. (2) The blue area changes look every month (12 looks). (3) Scattered props: trees that grow, flowers, grass, snow drifts, falling snow, rain, sun, clouds. Tom's answer on "whose date": every player's own days are true for that player, so **divide the board into 2, 3 or 4 areas, each with its own clock in that player's colour, and when a player finishes, the remaining players take over their area.**

---

## 1. What exists today (read first, nothing assumed)

| Piece | What I found |
|---|---|
| **The town board** | [TownBoard.tsx](../../src/components/board/TownBoard.tsx), built on React Flow. One "ground" node (grass island + streets) and one node per building. Layout comes from `TOWN.csv` through [townLayout.ts](../../src/utils/townLayout.ts). |
| **The controls** | React Flow's stock `<Controls>` box, bottom-left (about line 815): zoom in, zoom out, fit, plus four extra "pan" arrow buttons. A column of 7 small buttons. The classic board has its own copy. |
| **The "blue area"** | The **water** outside the grass island: the colour `GROUND[mode].water` (`#8fd0f0` light, `#0f172a` dark), painted behind React Flow and as its background. One flat colour today. |
| **Days** | Each player has their own `timeSpent` ([DataTypes.ts](../../src/types/DataTypes.ts)). Moving adds days to **that player only**. It can also go **down** (good-luck life events, saved days). **There is no calendar date anywhere** in the game; `gameStartTime` is an optional real-clock stamp, not a game date. |
| **How the town is built for several players** *(important for the areas)* | With 2 to 4 players the town is drawn as **stacked bands, one under the other** ([townLayout.ts](../../src/utils/townLayout.ts) ~line 145, `seat_drow = 16.4` in `TOWN.csv`). Only the buildings marked `perplayer` (Owner's house, Your office, the two construction sites and their trailers) get a **copy per player**, placed one band further down for each player. The **shared** buildings (Architect, Buildings Dept, Engineer, Firehouse, Bank, Investor, Ribbon cutting) exist **once**, in the top band. Between two bands there is a strip of bare grass (about 1.4 tiles). |
| **Characters and buildings** | Buildings are flat SVG blocks in a slightly 3-D angle with name signs on top that never tilt. Characters are PixelLab pictures. Recipe from [BETA_PLAN_V3.md](BETA_PLAN_V3.md): one locked prompt template per set, `no_background`, 64x64, about **$0.0064 per picture**. |
| **Screens** | **PC:** panel + board. **TV:** board only, camera follows the current player. **Phone:** panel only, **no board**. **Remote:** panel + a small board strip. The phone panel must never get bigger (360x640, 390x844); this design adds nothing to the phone. |
| **Animation facts** | The walk and bubbles end **by the clock** (timers), because weak TVs give no animation frames. `prefersReducedMotion()` is already used. The Browser pane fires no frames; animation is checked with Playwright + Edge. |

---

## 2. The design, in plain words

### 2.1 The areas: how the board is cut

**The honest finding first:** the town is already built as **stripes**, one per player, stacked top to bottom, not as a round pie. Each player's own house, office and site sit in their own stripe. If we cut a real pie from the middle, a player's own house could land inside someone else's season. So:

**Plan (my pick): cut along the stripes that already exist.** Each player's area is their stripe, full width, from the island edge out across the water to the frame. The cut line runs **through the bare grass strip between two bands**, halfway between the lowest wall of one band and the highest wall of the next (about row 16.1 for the first cut; the builder works it out from the layout so a different board works). So:

- **No building ever sits on a cut line.** The strip is empty by design. A test checks it for 2, 3 and 4 players.
- **No tree sits on a line** (trees are authored away from the strip, same test).
- **The shared buildings** (Architect, Buildings Dept, Bank and the rest) all stand in the top stripe, so the ground *around* them shows player 1's season. The **buildings themselves look the same in every season** (they are not tinted), so a shared building never looks "wrong". Honest cost: the top player's winter is the backdrop of the shared buildings. I think that is acceptable; a true pie would fix it (below).
- **One player:** no cut, the whole board is theirs.

**The true pie** (pie slices meeting in the middle, shared buildings in the centre where all slices touch) is possible, but only by **redrawing the town for 2, 3 and 4 players** (own buildings placed round the middle like a clock face, new streets, new walking routes). I estimate about **+4 days** and it re-opens the walk tests. It is option 2 in the questions.

### 2.2 What each area shows

Each area shows **its owner's own date and its owner's own season**: the water, grass, light, trees, flowers and weather for the month that player's day count has reached. Dates all start from the **same start date** (the day the game began), so every clock starts equal and drifts apart as players use different numbers of days.

- The **start date** is stored once in the game state (new field, set from the real "today" on the host). Date = start date + that player's days. Every phone and TV already gets game state, so every screen computes the same answer with **no extra network traffic**.
- Old games without the field use the game's creation date.

### 2.3 The edges: do the colours blend?

**Yes, softly.** Water and grass colours fade into each other over about 2 tiles on each side of the cut (a plain colour gradient strip, which is cheap; I avoid CSS masks because weak TV chips handle them badly). Along the cut a **thin dotted line in each player's colour**, on their own side, makes it obvious whose ground is whose, so the blend never leaves it unclear. Trees and buildings are never cut or blended (they pick one owner; see 2.7).

### 2.4 Where each clock sits

Each area has **one flip-board clock in the player's colour** (the frame and the little flap tops in that colour, a small name tag under it).

- **Where (Tom's answer: the top of the band):** the clock sits at the **top of that player's band**, horizontally centred, hugging the cut line (for the first band, the top of the island). It is a **screen-size** object, not a map object: at fit view four bands are each only a quarter of the screen high, and a map-size clock would be too small to read. So it keeps one readable size at any zoom.
- **How it stays readable when zoomed out or panned:** it is **pinned to the top of the band's visible part**. Zoom out and every band's clock sits at its own cut line. Zoom in or pan so the top of a band scrolls off the screen, and the clock slides down to stay stuck to the top edge of the screen (like a sticky table heading) for as long as enough of the band is on screen. If less than about 60 pixels of the band is visible, its clock hides. Several bands in view means several clocks, each at the top of its own band, so they never overlap each other.
- **Name signs always win:** the clock is drawn **under** an open name sign, so a clock can never hide a building name; a sign that opens simply covers it for a moment. Clocks are slightly see-through (about 90%) over the map.
- **PC:** all clocks shown, about the size of a big wristwatch face. The clock of whoever's turn it is gets a soft glow ring.
- **TV:** same, about 1.6 times bigger (readable from the couch). The TV camera follows the current player, so their band is on screen and their clock is stuck to the top of it, glowing; other bands' clocks show if their band is in view.
- **Remote strip:** the strip follows the current player, so it shows **one clock, the current player's**, stuck to the top of the strip at the right end (the right end keeps it clear of most name signs), one slim line with their colour dot. No other clocks.
- **Phone:** no board, nothing changes.
- **One-player game:** one clock, pinned the same way.
- **The shuffle:** when a player's days change, **only that player's clock** shuffles (year, month, day flaps cycle through random characters for about 0.6 seconds, staggered, then settle). Built from text swaps on a timer (`setInterval` ~70 ms, stopped by `setTimeout` ~600 ms), so it ends on time even without animation frames. The 3-D flap tilt is decoration only and is skipped on weak TVs. Reduce motion: no shuffle, the new date appears at once with a short highlight ring.

### 2.5 What the controls corner holds now

**Only the d-pad box; the single date there is dropped.** There are now up to four dates, each living in its own area; one more date in the corner would be a duplicate and would raise "whose date is this?".

```
        ^
   <  [fit]  >      [ + ]
        v           [ - ]
```

- Up/down/left/right pan (same 120-pixel steps as today), **middle = fit view**, zoom + and - on the side. One small plate in the same corner, no bigger than today's 7-button column.
- **Remote strip:** folds to one "view" button that opens the d-pad. **TV:** no d-pad drawn (nobody touches it; remote-control arrows still work). **Phone:** nothing.
- If Tom wants the corner to also hold a date, the choice is "the current player's date, in their colour" (it would duplicate that player's area clock), listed in the questions.
- The classic board keeps its old controls and gets no clocks.

### 2.6 The 12 monthly looks (data, not code)

A new table **`TOWN_SEASONS.csv`**, 12 rows, loaded like `TOWN.csv`. A different board swaps the file and gets a different year. Because up to four months show at once, **every colour is chosen so any two neighbours still look good side by side**, and the tint is capped at a low strength.

| Column | What it controls |
|---|---|
| `month` | 1 to 12 |
| `water_light`, `water_dark` | the blue (or grey-blue, icy) for light and dark mode |
| `grass_light`, `grass_dark`, `grass_edge` | the island's colour |
| `tint`, `tint_opacity` | a see-through colour over the area for the month's light (capped about 18%) |
| `daylight` | how bright (never so dark that names are hard to read) |
| `tree_look` | which tree picture (blossom, summer, autumn, bare, snowy) |
| `flowers` | flower count (0 in winter) |
| `grass_fresh_pct` | fresh vs dying grass patches |
| `snow_cover_pct` | how many snow drifts |
| `leaves_pct` | how much of the fallen-leaf budget shows (0 in summer and deep winter) |
| `sun_pct`, `cloud_pct`, `rain_pct`, `snow_pct` | weather odds (add to 100) |

Moods for the New York year: Jan/Feb icy grey-blue and snow; March slate and a little snow; April/May bright blue and blossom; June to August deep warm blue and sun; Sept/Oct steel blue and autumn leaves; November grey with early snow chance; December cold blue and snow. A colour change fades over about 1.5 seconds (the end colour is set at once, so it never gets stuck if frames are missing).

### 2.7 Props, trees and the "correct places" rules

**Trees are fixed and in data.** Rows say `tree, id, col, row, species, seed`, placed by hand once on open grass for the **top band**, then **copied for each player** the same way the player buildings are (each copy moved down by `seat_drow`). So each area has the same number of trees. Never on a street, a building, a sign or a cut line. Each tree **belongs to its home area** forever; its **look** (leaves, bare, snow) follows whoever owns the ground under it right now (see 2.8).

- **Size, 10% a year, trees never shrink:** a tree's size is 1.1 to the power of (days / 365), counted from the **highest day count that player ever had** (a new small state field, `peakDays`, the same pattern the game already uses for `peakScope` / `peakPlanDays`). So when a lucky event hands days back and the **season goes back**, the **date and the leaves go back but the trees keep their biggest size**. Cap about 1.5x. After a takeover a tree uses the bigger of its home player's peak and the new owner's peak, so a takeover never shrinks a tree either.

**Everything else moves around.** Each other prop has a "slot" and a lifetime (flowers about 20 to 40 days). Its spot, and when it expires so a new one appears elsewhere, is **calculated from the owner's day number and a fixed seed** (`hash(scene_seed, slot, epoch)`), never `Math.random`. Same inputs, same scene, on every screen.

**"Correct places":** spots come only from **free grass tiles inside that area**: not a street, not inside a building plus a one-tile margin, not under a name sign, not within 2 tiles of a cut.

| Prop | Where | When |
|---|---|---|
| Flowers | near trees and the island edge | bud then bloom through the months; **none Dec to Feb** |
| Fresh / dying grass | open grass | by `grass_fresh_pct` |
| Fallen leaves and leaf piles | scatter near trees; piles under or beside trees, on free grass only (never on streets, buildings or signs) | **October to early December**; a few left in March after the snow melts (see below) |
| Snow drifts | against building walls and tree bases, shady side | only months with snow cover above 0 |
| Falling snow / rain | over the area | by the weather odds; snow only in snow months |
| Sun | warm glow in the area's top-left plus lighter tint | sunny blocks |
| Clouds | 2 to 4 soft shapes drifting, **below the name signs** | cloudy blocks |

**Fallen leaves and leaf piles (Tom's addition).**
- **Which months:** the table gets one more column, `leaves_pct`, with the share of the leaf budget that shows that month. Roughly: Sept 10%, Oct 70%, Nov 100%, Dec 40% (early winter), Jan and Feb 0%, March 15% (a few leftovers once the snow is gone), April on 0%. The leaf amount follows the **owner's own month**, so one band can be knee-deep in leaves while another is in spring.
- **How they relate to the trees:** leaves fall **from the trees**. A tree's look changes with the month (summer, then autumn, then bare), and the leaf props are placed **around the base of those same trees**: a loose scatter within about 2 tiles, and a pile 1 tile from the trunk. The more the tree has lost (autumn then bare), the more leaves lie under it; a tree in blossom or summer look has none under it. Leaves with no tree near (a spot far from any tree) are never made.
- **Same day-number rule:** the spots come from the same pure function as other movable props, `hash(scene_seed, slot, epoch)` of the owner's day number, using only the free-tile finder. Every screen draws the same leaves on the same day.
- **How they go away:** (1) a **pile expires** like any movable prop (lifetime about 15 to 30 days) and is re-spotted or not by the same hash rule; (2) **wind**: in a windy block (a share of the 3-day weather blocks in Oct to Dec) scatters thin out to about half and the piles shrink one size, shown as a short fade, no motion needed; (3) **snow covers them**: in any block with snow cover above 0, leaf props in that band are replaced by the snow drifts (the leaf draw is skipped), and when the snow is gone in March a few scatter reappear at a low share. Reduce motion: the same changes, instantly.
- **Limits:** leaves count inside the existing "other props" budget, they do not add to it: at most 8 leaf props per band on PC, 3 per band on a TV (Light level), and none at the Calm/off level beyond a still sprinkle.

Weather is picked per **3-day block** of that player's days: `hash(scene_seed, seat, floor(day/3))` against the month's odds.

**Layering:** ground decals on one extra node under buildings; trees are nodes sorted with the buildings by depth; clouds above ground and below signs; falling bits one overlay with `pointer-events: none`, below pop-ups. Signs, walkers, bubbles and the current-building glow stay on top and unchanged.

### 2.8 When a player finishes: the takeover

**Which game field says a player has finished (checked 2026-10-25):** `finishedAtTurn` on the player ([StateTypes.ts](../../src/types/StateTypes.ts) line 539; set in [TurnService.ts](../../src/services/TurnService.ts) ~line 485 when the player reaches FINISH, together with a `player_finished` event). A player can also go **out** without finishing: `outReason` ('bankruptcy', 'design_fee_cap' or 'time_cap'). The game itself already treats both the same way ("every player has finished or gone out", TurnService ~line 586). So **"leaves the board" = `finishedAtTurn` is set OR `outReason` is set**, and both free their area for the others. Both fields already travel with the game state to every screen, so no new field is needed for this.

**Rule (one function, no history needed):** the board is told **which players have finished or gone out**. Every piece of ground belongs to the **nearest unfinished player's area** (nearest by distance from the ground to that player's stripe centre; ties go to the lower seat). That gives:

- A finished player in the **middle** (3 players): the upper half of their stripe goes to the player above, the lower half to the player below.
- A finished player at the **top or bottom edge**: all of their stripe goes to the one neighbour next to it.
- With two finishers in a 4-player game: the same rule on the new set, so ownership is **recomputed from scratch from the finished list**, not patched step by step.
- **Last player standing:** the whole board is theirs. If everyone is finished the end screen takes over as it does today.

**Whose season shows where:** every tile shows the season of the player who owns that tile *now*. Their clock stays pinned to the left edge of the **visible part of their (now larger) area**; the finished player's clock is removed from the board.

**All screens agree** because ownership is a pure function of three things every screen already has: the list of finished players, the seat order, and the layout. It uses no timers, no "who finished first" order and no messages between screens.
**Fade, not snap:** the ground changes with a crossfade of about 1.5 seconds (two stacked colour layers swap opacity); if frames are missing the end state is set at once by timer. Trees: look crossfades (two images, opacity); props in a taken-over area expire and are re-spotted by the same hash rule, so they simply appear/disappear with a short fade. Walkers and signs are never faded. In reduce motion it is an instant swap.

**Which player gets which part of a trees' ground:** a tree keeps its home position, but the ground (and therefore the tree's look) follows the ownership above. A tree sitting exactly on the halfway line between two receivers uses the tie rule (lower seat), so it never flickers between two looks.

### 2.9 Weather with up to four seasons at once: too busy?

**Yes, if all four move; so only one moves.** Rule: **falling rain and snow, drifting clouds and the flip shuffle only animate in the area of the player whose turn it is** (the TV camera is already there). Every other area shows only still hints: snow cover on the ground, a still cloud shadow, the month's colour and tint. That keeps the picture rich ("I can see the others are in different seasons") without four storms. The total number of falling bits stays at the level cap, not per area.

### 2.10 Cost on a 2021 TV with four seasons

The extra work of four seasons is mostly **colour layers** (four flat rectangles and two gradient strips, trivial) and **four small clocks** (about 10 boxes each; usually only one shuffles at a time). The costly parts (falling bits, cloud drift, moving props) are **capped and shared across the whole board**, not per player. So four seasons cost nearly the same as one. Level table (set by data, `scene_detail`):

| Level | Used on | Trees (total) | Other props (total) | Falling bits | Clouds |
|---|---|---|---|---|---|
| Full | PC, tablets | up to 14 per area | up to 40 | up to 40, one area | drift |
| Light | TV and the Remote strip | up to 12 total | up to 12 total | up to 14, one area | still |
| Calm / off | reduce motion, or the player switch | still | up to 12, still | none | still |

Animation uses only `transform` and `opacity`. A **Menu to View to Scene: Full / Calm / Off** switch (no loose buttons) lets a class with a slow TV turn it down in one tap. A takeover briefly shows two tree pictures per tree (about 14 extra images for 1.5 s), which the Light level skips (instant swap).

### 2.11 How I would check it

- The scene is **one pure function**: `sceneFor(startDate, players[{seat, colour, days, peakDays, finished}], layout, tables, level)`. Unit-tested: same input twice gives the same output; no `Math.random` in the file; all 12 months present; no prop on a street, a building or a cut line; no flowers in winter; snow only in snow months; **takeover agrees from any starting order of finishing**; trees never shrink when days go backward.
- Looks and the flip are checked in Playwright + Edge at PC 1920, TV 960x540 and the remote strip, light and dark, 1 to 4 players, then **Tom on the real TV**. The flip is also tested with animation frames switched off.

---

## 3. Cost: steps that ship one at a time (detail; letters A to G are steps 1 to 7 in section 6, which is the final order)

Days are working sessions of AI build time. Pictures: PixelLab, 64x64, one locked template per set (corner-pixel transparency check).

| Step | What ships | Days | Pictures | Depends on |
|---|---|---|---|---|
| **A. The control dock** | New bottom-left d-pad box (no date in it), compact for the Remote strip, hidden on TV. | 1.2 | 0 | nothing |
| **B. Dates and clocks** | Start-date field, date arithmetic per player, `TOWN_SEASONS.csv` loader (with the classroom-bake and pipeline tests), the flip-board clock in player colours pinned at the left edge of each area, bigger on TV, one slim clock on the Remote strip. At this step the areas are not drawn yet; the clocks float where the areas will be. | 3.5 | 0 | A |
| **C. Areas and monthly looks** | Cut lines in the band gaps, per-area water/grass/tint from the month table, soft blends and coloured dotted edge, takeover with crossfade, `peakDays` field. | 3 | 0 | B |
| **D. Trees** | Tree places as data, copied per player, 5 looks, 10% a year from peak days, never shrink, home-area rule and takeover look. | 3 | 10 (2 tree kinds x 5 looks) | C |
| **E. Weather and light** | Sun glow, clouds, rain, falling snow in the current player's area only, still hints elsewhere, reduce motion, Scene switch, TV Light level. | 2.5 | 3 (cloud shapes; rain, snow, sun drawn in code) | C |
| **F. Flowers, grass, drifts, leaves** | Moving props with lifetimes per area, the free-tile finder with cut margins, re-spotting after a takeover, fallen leaves and leaf piles under the trees. | 3 | 15 (3 flowers x bud/bloom = 6; grass fresh/dying/dead = 3; drifts = 2; leaves: 2 scatter looks + 2 pile sizes = 4) | D |
| **G. Polish and real-TV pass** | Old-TV tuning, 4-player tests, phone-panel measure, dark mode, fixes from Tom's TV look. | 2 | 0 | all |

**Total about 18.2 days (was 13), 28 pictures.** Pictures cost about **$0.54** at most (28 pictures, up to 3 tries each, $0.0064 apiece), about $0.18 with no retries. Tom's fallen leaves and piles add 4 pictures (about $0.08 with 3 tries each) and half a day. The extra days over the first design are the areas, the takeover rule, the pinned clocks and the peak-days rule. If Tom wants the **true pie instead of stripes**, add about **+4 days** (town redrawn for 2, 3, 4 players) inside step C, making about 22.2 days.

**Order:** A, B (Tom sees real working clocks and the new controls quickly), C, then D, E, F, G. After B and C the idea is already visible; D to F are scenery.

---

## 4. What could go wrong

1. **A player's days go backward (lucky event).** Their clock flips backward, their season goes back, their weather re-shuffles. Trees keep their biggest size (the `peakDays` rule), so nothing visibly shrinks. Rare.
2. **Stripes are not a round pie.** Tom said "like a pie". Stripes match how the town is already built and keep each player's own buildings inside their own season; a pie costs about 4 more days and a town redraw. This is question 1.
3. **Shared buildings sit in the top player's stripe.** Their ground shows player 1's season. Buildings look the same everywhere, so only the grass around them differs.
4. **Clocks pinned to the top of each band** are a bit of new code (positions follow pan and zoom). They hide when almost off screen. Risk: a clock covering a building sign near the band's top row; the rule that open signs are drawn on top handles reading a name, and the builder can nudge the clock sideways if a particular board needs it.
5. **Finished or out.** The board reads `finishedAtTurn` and `outReason` (both exist). A player who leaves the board by going out (bankruptcy, fee cap, time cap) frees their area the same way as one who finished; if Tom wants only finishers to give up their area, it is a one-line change.
6. **Growth may not be visible.** If a typical game covers under a year of days, "10% a year" barely shows (rate is data, can be raised).
7. **A winter start** starts in snow; a July start never sees winter. True to "today's date" (question 3).
8. **Old TVs.** Caps, Light level, Scene switch, one animated area at a time. I cannot test a 2021 TV here; Tom's TV look in step G is the real test.
9. **Names must stay readable** through tints, snow and darker winter light. Signs sit above everything; tint strength is capped and has a brightness floor.
10. **Odd prop spots** on a teacher's board with an added square: the free-tile finder works from the layout and a test covers it.
11. **A new CSV file** needs the loader, the classroom bake and the pipeline-faithful test taught about it. Budgeted in step B.
12. **Picture consistency.** One locked template per set; regenerate a whole set rather than patching one.
13. **Dark mode** doubles the colour work (both columns are in the table).
14. **The built-in Browser pane cannot play animation**, so I check with Playwright and Edge and send frames.

---

## 5. Decisions (all settled; nothing left open)

**ANSWERED by Tom:**

1. **Shape of the areas: ANSWERED, stripes** along the bands the town already has (not a true pie). Each player's own buildings stay inside their own season.
2. **Corner box: ANSWERED, only the d-pad, fit and zoom.** No date in the corner.
3. **Clock position: ANSWERED, at the top of each player's band** (see 2.4).

**Working defaults (stand unless Tom changes them):**

4. **Start date:** everyone's clock starts at **today's real date**.
5. **How busy:** **calm.** Only the current player's band animates (rain, snow, clouds, clock shuffle); other bands show still hints. About 14 trees per band, up to 12 other things on a TV.
6. **Ship order:** **controls and clocks first, on their own (steps 1 and 2 below), then areas and scenery step by step.**

---

## 6. Final build order

Each step ships on its own and Tom can deploy and look at it. Days are AI working sessions.

| # | What Tom sees | Days | Pictures |
|---|---|---|---|
| **1. The d-pad box (the first small step)** | The 7-button column becomes one small plate: arrows round a middle fit button, zoom + and - on the side. Compact on the remote strip, hidden on the TV. Nothing else on the board changes, no data, no game rules touched. This is the one to deploy first. | 1.2 | 0 |
| **2. The clocks** | A flip clock in each player's colour at the top of their band: start date stored once, each player's date from their own days, shuffle on change, pinned at the top of the visible part of the band, bigger on TV, one slim clock on the remote strip. The board is still one look; the bands are not yet cut. | 3.5 | 0 |
| **3. Bands and monthly looks** | Cut lines in the grass strips, each band's water, grass and light from its player's month (12-month table), soft blends and dotted colour edges, takeover when a player finishes or goes out, trees' `peakDays` memory. | 3 | 0 |
| **4. Trees** | Fixed trees in every band, 5 looks, 10% bigger a year, never shrink. | 3 | 10 |
| **5. Weather and light** | Sun glow, clouds, rain, snow in the current player's band only; still hints elsewhere; reduce motion and the Scene switch. | 2.5 | 3 |
| **6. Flowers, grass, drifts, leaves** | Moving props with lifetimes, none in winter; fallen leaves and leaf piles under the trees from autumn into early winter, a few left in March. | 3 | 15 |
| **7. Polish and the real-TV pass** | Old-TV tuning, 4-player tests, phone-panel measure, dark mode, fixes from Tom's TV look. | 2 | 0 |

**Total about 18.2 days and 28 pictures** (about $0.54 at most, about $0.18 with no retries). Steps 1 and 2 are the first 4.7 days and need no pictures and no scenery decisions; if Tom likes them he can stop there.
