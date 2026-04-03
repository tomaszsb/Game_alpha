# How the Prototype Files Draw the Board

We built two prototype files to experiment with different ways of drawing the board. Both use SVG arrows (drawn lines with arrowheads) instead of the CSS rectangles used in the production game. Here's how each one works.

---

# Prototype 1: SVG Arrows Prototype (`svg_arrows_prototype.html`)

This prototype keeps the same snake layout as the production game but replaces the CSS connectors with SVG arrows that are drawn on a transparent layer sitting on top of the board.

## 1. Planning Where the Boxes Go

This works exactly the same as the production game:

- The list of spaces is written out in order, hardcoded in the file.
- Each box gets a 120-pixel-wide slot (134 pixels total including spacing).
- The program measures how wide the screen is and divides by 134 to figure out how many boxes fit in a row.
- When a row fills up, the next row starts below it going in the opposite direction (the snake pattern).
- Forks show up as stacked rows of choices. Legs show up as three boxes stacked vertically.

The boxes are placed using flexbox — a browser tool that automatically lines things up in a row. Even-numbered rows go left to right. Odd-numbered rows go right to left.

## 2. How Arrow Start and End Points Are Determined

This is where this prototype gets interesting. Instead of using fixed CSS lines, the program **measures where the browser actually placed each box on screen**, then draws arrows between them.

Here's how it works:

1. After all the boxes are placed on screen, the program asks the browser: "Where exactly is each box right now?" It gets back the exact pixel position of every box — its left edge, right edge, top, bottom, and center.

2. For each connection (edge) between two boxes, the program figures out where the arrow should start and end by looking at how the boxes are positioned relative to each other:
   - **If the boxes are at the same height** (side by side): the arrow exits the right side of the first box and enters the left side of the second box (or vice versa).
   - **If the boxes are at the same horizontal position** (stacked vertically, like legs): the arrow exits the bottom of the top box and enters the top of the bottom box.
   - **If they're diagonal** (different row AND different height, like fork entries): the program picks the side based on which direction has a bigger gap — horizontal or vertical.

## 3. How Arrow Directions Are Determined

The program uses a simple comparison: it looks at the center of each box and asks "Is box B to the right, left, above, or below box A?"

- **Horizontal neighbors** (same Y position, within 8 pixels): arrow goes left or right.
- **Vertical neighbors** (same X position, like legs): arrow goes up or down.
- **Fork connections** (different X and Y): the arrow goes sideways first, then turns to go up or down — making an L-shaped path.

The direction is also used to pick the correct **exit side** of the source box and **entry side** of the destination box. For example, if box B is to the right, the arrow leaves from the right wall of box A and arrives at the left wall of box B.

## 4. How the Arrow Path Is Drawn

The arrows are drawn as SVG paths — think of these as instructions that tell the computer "start here, draw a line to here, then to here." They sit on an invisible layer (like a sheet of tracing paper) placed on top of the entire board.

**Straight arrows (side by side or vertically stacked):**
- Just a straight line from point A to point B. Simple.

**L-shaped arrows (fork entries and exits):**
- The arrow goes horizontal first, then turns 90 degrees and goes vertical (or the other way around).
- The turn point is placed at the midpoint between the two boxes.
- Example: to go from a box on the left to a fork branch above-right, the arrow goes right to the halfway point, then turns and goes up to reach the branch.

**U-turn arrows (connecting one row to the next):**
- The arrow exits the bottom of the last box in a row.
- It drops down 8 pixels.
- Then it travels sideways to the edge of the container (14 pixels from the wall).
- It goes straight down along the edge to the level of the next row.
- Then it travels sideways back to the first box of the next row.
- Finally it enters the top of that box.
- This creates a path that looks like it wraps around the side of the board.
- Even rows wrap around the **right** side. Odd rows wrap around the **left** side.

**Rounded corners:**
- Where the arrow changes direction (like at the corner of an L-shape or U-turn), the program adds a small curve instead of a sharp 90-degree angle. The curve radius is 8 pixels, which makes the arrows look smooth and professional.
- The math works by backing up slightly before each corner, then drawing a short curved arc through the corner point, then continuing in the new direction.

**Arrowheads:**
- Each arrow ends with a small triangular arrowhead. These are defined once as reusable "markers" in the SVG — little triangle templates that get automatically placed at the end of each line.
- Each color gets its own arrowhead template (so blue arrows get blue arrowheads, orange arrows get orange arrowheads, etc.).

---

# Prototype 2: Graph Paper Grid (`elk_prototype.html`)

This prototype takes a completely different approach. Instead of a snake layout with flexbox, it uses a **CSS grid** — imagine the board is drawn on graph paper, and each box sits in a specific cell.

## 1. Planning Where the Boxes Go

**The path is not hardcoded.** Instead, the program reads the actual game data files (CSV spreadsheets) and figures out the path automatically by following the movement rules:

1. It starts at the space marked "is_starting_space = Yes" in the game config.
2. It looks at that space's movement type:
   - **Fixed**: go to the one destination listed.
   - **Choice**: the path splits into branches (a fork).
   - **Dice**: follow the dice destinations, continuing along the same branch type.
   - **Special** (like PM-DECISION-CHECK): creates a complex hub with legs above/below and a mega-fork of all the branches radiating outward.
3. It walks forward through the game, collecting spaces into segments (nodes, forks, and legs) until every space has been placed.

**The grid layout uses an "onion" pattern.** Each box sits in a group of 5 cells (both horizontally and vertically). The cells in each group have different sizes:

- **Center cell** (where the box normally sits): the largest — about 63 pixels wide and 32 pixels tall at default scale.
- **Inner cells** (one on each side of center): medium — about 11 pixels each. Used when a box expands to 3x3 on hover.
- **Outer cells** (the edges): small — about 11 pixels wide, 5 pixels tall. Used when a box expands to 5x5 for full detail.

This means boxes can grow and shrink **without moving any other box**. When you hover over a box, it expands from 1x1 (center cell only) to 3x3 (center + inner cells), and on click to 5x5 (the full group). The surrounding boxes stay exactly where they are because the grid cells were already allocated for the expansion.

**Snake pattern:** The boxes still follow a snake pattern. The program calculates `tilesPerRow` the same way (container width ÷ group width), then alternates row direction. But instead of flexbox, each tile gets placed at a specific grid column and row using `grid-column` and `grid-row` CSS properties.

**Mega-fork layout:** The PM-DECISION-CHECK hub creates a large fan of branches. Each branch (Architecture, Engineering, Regulatory, Construction, etc.) gets its own horizontal row in the grid. They all start from the same column (one to the right of the hub) and extend rightward.

**Compaction:** After placing everything, the program removes empty rows and columns from the grid to avoid wasted whitespace. It remaps all positions so that unused grid cells are collapsed.

## 2. How Arrow Start and End Points Are Determined

Like the SVG Arrows prototype, this one measures where the browser placed each box after the grid renders. But the logic for picking exit and entry sides is slightly different:

- **Same column** (vertically aligned): arrow exits from top or bottom of the source, but always **arrives at the left side** of the destination.
- **Same row** (horizontally aligned): arrow exits from left or right of the source, and arrives at the **left side** of the destination.
- **Diagonal** (different row and column): exit side is picked based on whichever direction (horizontal or vertical) has the bigger gap. Entry is always the **left side**.

The "always arrive on the left" rule gives a consistent visual style — all arrowheads point into the left wall of their target box.

## 3. How Arrow Directions Are Determined

The direction comes from comparing the grid positions (column and row numbers) of the two connected boxes:

- **Same column**: vertical arrow (up or down based on which box is higher).
- **Same row**: horizontal arrow (left or right based on which box is further left).
- **Different row and column**: the program compares the horizontal distance vs. vertical distance. If the boxes are farther apart horizontally, the arrow primarily goes sideways. If farther apart vertically, it primarily goes up/down.

The program also adds **extra edges from the game data**. Besides the connections built from the path layout, it checks every space's movement destinations. If a movement destination exists on the board but isn't already connected by the layout edges, it adds an extra arrow. This means back-edges (arrows that loop backward) and cross-branch connections show up automatically.

## 4. How the Arrow Path Is Drawn

This prototype has the most sophisticated arrow routing. It uses a **three-pass** system:

### Pass 1: Route each arrow around obstacles

For each connection, the program tries to find a path that **doesn't pass through any other box**:

**Straight line (horizontal or vertical):**
- If two boxes are in a straight line, it first checks: "Does a straight line between them hit any other box along the way?"
- If not, it draws a straight line.
- If yes, it finds a "clear channel" — a parallel path offset to the side that avoids all boxes. It searches in 5-pixel steps until it finds an unblocked route.

**L-shaped (two segments with a corner):**
- For boxes that aren't aligned, the program tries two L-shape orientations:
  - **Horizontal first**: go sideways to a turning point, then go vertically to the target.
  - **Vertical first**: go up/down to a turning point, then go sideways to the target.
- It picks whichever orientation avoids passing through other boxes.
- If **both** orientations would hit a box, it falls back to a **Z-shape** (three segments: go out sideways, down through a clear channel, then sideways again to the target).

**Finding clear channels:**
- The `findClearX` and `findClearY` functions search for a coordinate where a line won't pass through any box. They start at the midpoint between the two boxes and search outward in 5-pixel steps until they find an open path.

### Pass 2: Separate overlapping arrows

When multiple arrows run along the same path (like several branches all leaving from the same hub), they would normally draw right on top of each other. This pass fixes that:

1. It breaks every arrow into individual horizontal and vertical **segments**.
2. It groups segments that overlap (running parallel within 3 pixels of each other, overlapping in range).
3. Within each overlapping group, it counts how many **different colors** are present.
4. It then offsets each color by 4 pixels, spreading them apart like lanes on a highway. So if a blue arrow and an orange arrow share the same path, the blue one shifts 2 pixels left and the orange shifts 2 pixels right.
5. Same-color arrows are allowed to overlap (they just stack on top of each other, which looks fine).

### Pass 3: Render the SVG

Finally, all the arrow paths are converted to SVG and drawn:

- Each arrow is a `<path>` element with a stroke color matching its game phase.
- Arrowhead markers (small triangles) are added at the end of each path.
- Dimmed arrows (for branches the player didn't take) are drawn at 20% opacity so they fade into the background.

---

# Key Differences Between the Two Prototypes

| Feature | SVG Arrows Prototype | Graph Paper Grid |
|---------|---------------------|-----------------|
| **Path source** | Hardcoded list | Read from CSV game data files |
| **Layout method** | Flexbox rows (like the production game) | CSS Grid with 5-cell onion groups |
| **Box sizing** | Fixed 74px wide | Expandable: 1x1, 3x3, or 5x5 cells |
| **Arrow routing** | Simple: straight, L-shape, or edge-hugging U-turn | Smart: avoids other boxes, tries multiple routes |
| **Overlapping arrows** | Arrows may overlap | Arrows are spread apart into lanes |
| **Rounded corners** | Yes (8px radius curves) | No (sharp 90-degree turns) |
| **Hover/expand** | Tiles swap between node/card/expanded card | Tiles grow from 1 cell to 3x3 or 5x5 cells in place |
| **Content** | Placeholder text | Real story and action text from CSV |
| **Grid stability** | Layout can shift when cards expand | Grid never moves — expansion fills pre-allocated cells |
