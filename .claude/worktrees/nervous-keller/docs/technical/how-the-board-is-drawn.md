# How the Game Board Is Drawn

This explains, step by step, how the computer draws the game board you see on screen.

---

## 1. Planning Where the Boxes Go

The board is like a board game — a path of boxes (we call them "spaces") that players move through from start to finish. The program needs to figure out how to arrange all these boxes on your screen.

**The list of spaces is written out in order**, like a recipe. The program knows exactly which space comes first, which comes second, and so on. Some spaces are simple single boxes. Others are special:

- **Forks** — where the path splits into two choices (like "Do you go to the Bank or the Investor?"). These show up as two rows stacked on top of each other.
- **Legs** — where one space has a space above it and a space below it (like a decision point with side paths).

**Each box takes up a fixed amount of room** — exactly 134 pixels wide (think of it like each box getting a 1.5-inch slot on screen).

**The program figures out how many boxes fit in one row** by looking at how wide your screen is. It takes the screen width and divides by 134. So on a wide screen you might fit 8 boxes per row. On a phone, maybe only 4.

**When a row fills up, it wraps to the next row** — just like how words wrap to the next line when you type a long sentence. But here's the fun part: **every other row goes in the opposite direction**. The first row goes left to right. The second row goes right to left. The third row goes left to right again. This creates a snake or zig-zag pattern, like the path on a Chutes and Ladders board.

---

## 2. How Arrow Start and End Points Are Determined

Arrows connect one box to the next box to show which direction you move. The program needs to figure out where each arrow starts and where it ends.

**For boxes sitting next to each other in the same row:**
- The arrow starts at the right edge of one box and ends at the left edge of the next box (or the other way around if the row goes right-to-left).
- Think of it like drawing a short line between two boxes sitting side by side.

**For fork splits (where the path branches):**
- A vertical line runs up and down along the left side of the fork, connecting to each branch.
- Short horizontal arms stick out from this vertical line to reach each branch.
- On the other side, another vertical line with arms collects the branches back together.
- It looks like a bracket: `{` on one side and `}` on the other.

**For U-turns (where one row connects down to the next row):**
- The arrow starts at the last box in a row.
- It drops straight down through the gap between rows.
- Then it connects to the first box of the next row (which is directly below, on the same side of the screen).

**For legs (the vertical decision points):**
- A vertical line runs through the center, connecting the top space, the middle space, and the bottom space.

---

## 3. How Arrow Directions Are Figured Out

The program looks at where two connected boxes are sitting on screen and uses simple rules:

**Same row, side by side:**
- If the row goes left-to-right, arrows point right →
- If the row goes right-to-left, arrows point left ←
- The program knows which direction each row goes because it alternates: row 1 goes right, row 2 goes left, row 3 goes right, and so on.

**Fork branches:**
- Arrows always go into the fork from the left side and come out the right side (or reversed if the row is going right-to-left).
- The vertical bracket lines don't have arrows — they just show that the paths are connected.

**U-turns (connecting one row to the next):**
- The arrow points downward, because you're moving from one row to the row below it.
- If the row was going left-to-right, the U-turn happens on the right side of the screen.
- If the row was going right-to-left, the U-turn happens on the left side.

**Legs (vertical stacks):**
- Arrows point up or down depending on whether the connected space is above or below.

---

## 4. How the Arrow Path Is Drawn

The actual arrows you see are drawn using simple shapes and lines built right into the web page (not images).

**Straight connectors (between side-by-side boxes):**
- These are just thin horizontal rectangles, 14 pixels wide and 4 pixels tall.
- At the end of each rectangle, a tiny triangle is added to make it look like an arrowhead. This triangle is made purely with CSS (the styling language that controls how things look on screen) — it's just a small shape that says "this way."

**Fork brackets:**
- The vertical lines are thin 4-pixel-wide rectangles.
- The program calculates exactly how tall they need to be by looking at how many branches there are. Each branch is 36 pixels tall, so if there are 2 branches, the vertical line is 36 pixels. If there are 3 branches, it's 72 pixels. And so on.
- The small horizontal arms connecting each branch to the vertical line are 8 pixels wide.

**U-turn connections:**
- These are also thin lines drawn with CSS.
- One line drops down from the end of a row through the 6-pixel gap between rows.
- Another line rises up into the start of the next row.
- Together they look like the path is bending around a corner and continuing on the next row.

**No complex curves are needed.** Because boxes line up neatly in rows and columns, all the connections are straight horizontal or vertical lines. The program doesn't need to draw curvy or diagonal arrows — everything is at right angles, which keeps it simple and clean.

---

## Putting It All Together

When you load the game, here's what happens in order:

1. The program reads the list of all spaces in the game path.
2. It measures how wide your screen is.
3. It calculates how many boxes fit per row (screen width ÷ 134).
4. It splits the spaces into rows, reversing every other row to make the snake pattern.
5. It draws each box in its row.
6. Between every pair of connected boxes, it draws a small arrow or line showing the connection.
7. At the end of each row, it draws a U-turn connector down to the next row.
8. For forks and legs, it draws the vertical bracket lines and arms.

If you resize your browser window, the program re-measures the width and rearranges everything — more boxes per row on a wider screen, fewer on a narrower one. The snake pattern adjusts automatically.
