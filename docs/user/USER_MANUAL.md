# User Manual - Unravel Codes: The Game

**Last Updated:** August 1, 2026
**Version:** 3.1.85
**Status:** Beta — live at https://game.unravelcodes.com

Welcome to Unravel Codes: The Game! This manual will help you understand how to play the game and use the interface effectively.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Game Overview](#game-overview)
3. [Player Panel Guide](#player-panel-guide)
4. [Game Actions](#game-actions)
5. [Multi-Device Play](#multi-device-play)
6. [Tips & Strategies](#tips--strategies)
7. [Troubleshooting](#troubleshooting)
8. [Space Data Editor](#space-data-editor)

---

## Getting Started

### Accessing the Game

**Public URL:** `https://game.unravelcodes.com`

**Local Development:** `http://localhost:3000`

### Quick Start

1. **Go to the Game Lobby** at the URL above
2. **Create or Join a Game:**
   - Click "Create New Game" to start a new session
   - Or enter a Game Code to join an existing game
3. **Add players** in the setup screen (2-4 players)
4. **Start game** - players automatically placed at START space
5. **Play turns** - follow the "Things you can do" list and the End Turn control at the bottom of your panel
6. **Win** by completing your construction project first!

### Game Lobby

When you first access the game, you'll see the **Game Lobby**:

- **Create New Game:** Starts a fresh game session with a unique ID (e.g., G1, G2)
- **Join by Code:** Enter a game ID to join an existing session
- **Active Games:** See list of games currently in progress

**Tip:** Share the game URL with the game ID (`?g=G1`) to invite others to your specific game.

### Multi-Device Setup

**For individual player control on separate devices:**

1. Start game on main device
2. Each player scans their QR code or uses short URL (`?g=G1&p=P1`, `?g=G1&p=P2`)
3. Players can now control their turns from their own device
4. All devices stay synchronized in real-time

**Remote Play:** Share the public URL with friends and family anywhere in the world. As long as they have the game ID and player code, they can join from any device!

---

## Game Overview

### Objective

Navigate through construction project phases, manage resources (money and time), collect work cards, and complete your project before other players.

### Game Phases

- **SETUP:** Initial project definition and funding
- **DESIGN:** Architectural and engineering work
- **REGULATORY:** Permits and approvals
- **CONSTRUCTION:** Building execution
- **FINISH:** Project completion

### Resources

**Money:**
- Earn from loans, investments, owner funding
- Spend on permits, fees, card costs
- Shown in your panel's status row; tap 📋 **My numbers** for the full breakdown

**Time:**
- Measured in "days" (weeks/months)
- Affected by space effects and cards
- Win condition: Finish with lowest time

**Project Scope:**
- Based on Work (W) cards collected
- Determines funding amounts
- Recalculated automatically as you draw Work Package cards

---

## Player Panel Guide

### Interface Layout

The Player Panel is a **single scrolling mobile-first view**, not a set of separate tabbed sections:

```
┌─────────────────────────────────┐
│ ● Player Name          Phase   │  ← Header
├─────────────────────────────────┤
│ 💰 $Money   🕐 Days   DOB FDNY │  ← Status row (+ VIOLATION if active)
│ [📋 My numbers] [📜 History]   │
├─────────────────────────────────┤
│ 📍 Where you are & why         │  ← Current space + story
├─────────────────────────────────┤
│ Things you can do              │  ← Action buttons, incl. Move
├─────────────────────────────────┤
│ What's affecting you           │  ← Expeditors, effects, your cards
├─────────────────────────────────┤
│ [ Try Again  |  End Turn ]     │  ← Tap to compare, hold to confirm
└─────────────────────────────────┘
```

### Panel Zones

- **Status row:** Your cash on hand and days spent, plus small DOB/FDNY approval marks and a VIOLATION mark (only if you have an open violation — see [Homeowner Violations](#homeowner-violations)). Two buttons live here:
  - **📋 My numbers** opens a read-only recall screen with your project scope, work packages, money, and time.
  - **📜 History** opens a log of what's happened to you this game (moves and changes).
- **Where you are & why:** The space you're on, its story, and — if there's more to know — a "What to do & why" toggle that expands into what's expected of you and why.
- **Things you can do:** Every action currently available to you — manual effects (like accepting a loan or rolling for an outcome), and a **Move** row when you have a destination to choose. Tap **Move** to expand your route options; once expanded they stay visible so you can change your mind until you end your turn. Completed actions show with a checkmark.
- **What's affecting you:** Collapsed by default. Expand it to see any Expeditor cards you can activate right now (each has its own **Activate** button), ongoing effects currently applied to you, and the cards in your hand grouped by type (tap a group to see the cards in it, tap a single card for its details).

### Ending Your Turn / Try Again

The footer merges **Try Again** and **End Turn** into one control instead of two separate buttons:

- **Tap** either side to preview what it costs (money/time) before committing — nothing happens yet.
- **Press and hold** the side you want to commit to; a ring sweeps around the button as you hold, and releasing after it fills locks in that choice. This is deliberate — these are the most consequential actions in your turn (spending money or burning a day), so a stray tap can't trigger one by accident.
- The End Turn side's label changes with your situation: **"N action(s) left"** (grayed out) while you still have pending actions, a dice/movement prompt like **"Take your next step"** when it's time to roll or move, and **"End turn"** once everything is done. When it isn't your turn at all, it reads **"Waiting for [Player Name]"**.
- Try Again only appears on spaces that actually offer it.

---

## Game Actions

### Turn Sequence

1. **Turn starts** automatically
2. **Space effects** process (if applicable)
3. **Take manual actions** (optional):
   - Get funding (if at a funding space)
   - Activate an Expeditor card (if you have one ready)
   - Propose a trade (if you're holding a card that offers one)
4. **Roll to move** (if on dice space)
5. **Choose destination** (if multiple paths)
6. **End turn** when all actions complete

### Manual Actions

#### Get Funding
- **When:** At a funding space (e.g. the bank or investor loan review)
- **How:** A funding action shows up under "Things you can do" for that space (for example, "Accept Bank Loan") — tap it.
- **Effect:** Draws the appropriate loan card and applies its fees.

#### Activate an Expeditor Card
- **When:** Anytime during your turn (phase restrictions apply)
- **How:**
  1. Expand "What's affecting you"
  2. Expeditor cards you can currently use are listed with their own **Activate** button
  3. Tap **Activate**
- **Effect:** The card's effect applies immediately.

Expeditors are the only cards you actively play from your hand. Work Package, loan (Bank/Investor), and Life Event cards apply themselves automatically when you draw them — tapping one in "What's affecting you" just opens its details for reference, with nothing to activate.

#### Propose a Trade
- **When:** You're holding a card that offers a trade (e.g. "Backchannel Favor")
- **How:** See [Player-to-Player Trading](#player-to-player-trading) below.
- **Effect:** If the other player accepts, money and/or cards change hands immediately.

#### Try Again
- **When:** Available on certain spaces (appears as one side of the End Turn control)
- **How:** Tap "Try Again" to preview its cost, then press and hold it to commit
- **Effect:** Reverts to state before current space entry (time penalty may apply)

### Automatic Actions

These happen automatically when conditions are met:

- **Space arrival effects:** Process when you land on a space
- **Card expirations:** Active cards with durations expire at turn end
- **Win condition check:** Game ends when a player finishes

### Homeowner Violations

Two rare Life Event cards can hit you with a violation: **"Notice of Violation"** and **"Immediately Hazardous Violation"**. Drawing either one gives you a corrective Work Package (extra scope you now have to build) and starts a **180-day countdown** to file an **Affidavit of Correction**.

- **The penalty scales with the extra work**, not a flat number: 4%/8% of the corrective Work Package's cost for smaller projects, or 10%/20% for larger ones (the split is at $500,000 total project scope) — the lower rate applies if you file on time, the higher rate if you file late.
- **"Immediately Hazardous" is the more serious of the two.** On top of the filing fee, it adds a daily penalty ($500/day for smaller projects, $2,000/day for larger ones) that starts accruing once the 180-day deadline passes without a filed affidavit.
- **If you finish the game with a violation still open**, you're charged the late-filing rate as a backstop, and the End Game summary calls it out separately from any missing DOB approval.

**What you'll see:** a red **VIOLATION** mark next to your money and days, with a running "days left to file" (or "days overdue") count. While it's open, a **"File Affidavit of Correction"** button appears in your panel — tap it whenever you're ready to resolve it. Once filed, the mark turns green and fades, the same way a resolved DOB or FDNY approval does.

### Player-to-Player Trading

Certain Expeditor cards (for example, **"Backchannel Favor"**) let you propose a trade with another player instead of resolving a fixed effect. Play the card, pick who you want to trade with, then build an offer of cash and/or cards from your hand.

- The player you're offering the trade to gets a real **Accept / Decline** prompt on their own device (or on the shared screen, in shared-screen play), live over the network — they don't need to wait for your turn to end.
- **Accept:** the offered cash and cards move to them immediately.
- **Decline:** nothing moves — anything you offered stays with you.
- This first version is **accept/decline only** — there's no counter-offer step yet.

---

## Multi-Device Play

### Benefits

- Each player controls their own device
- Reduces waiting time
- Better visibility of personal information
- Mobile-friendly for phones/tablets

### How to Connect

**Method 1: QR Code**
1. Main device shows QR codes for each player
2. Scan with phone camera
3. Automatically opens to your player panel

**Method 2: Short URL**
1. Main device shows short URLs (`?p=P1`, `?p=P2`)
2. Type URL in browser address bar
3. Opens to your player panel

### Connection Status

**Green indicator:** ✅ Connected to server
**Red indicator:** ❌ Connection lost - will retry automatically

---

## Tips & Strategies

### Resource Management

**Money:**
- Take loans early to fund permits and cards
- Bank loans (<$4M projects) have lower interest
- Investor loans (>$4M projects) for large projects
- Track loan balances via 📋 **My numbers**

**Time:**
- Minimize time to win
- Use E (Expeditor) cards to reduce time
- Avoid L (Life Event) cards that add time
- "Try Again" costs time but may save money

### Card Strategy

**Work (W) Cards:**
- Increase project scope
- Draw early to qualify for investor funding
- Required to finish game

**Expeditor (E) Cards:**
- Reduce permit processing time
- Most valuable for time optimization
- The only card type you actively activate from your hand (see [Activate an Expeditor Card](#manual-actions))
- Some (like "Backchannel Favor") let you offer a trade to another player instead of a fixed effect — see [Player-to-Player Trading](#player-to-player-trading)

**Life Event (L) Cards:**
- Usually negative effects
- Applied automatically when drawn
- Some have dice-based outcomes
- Two rare ones ("Notice of Violation" and "Immediately Hazardous Violation") trigger the [Homeowner Violations](#homeowner-violations) mechanic — worth understanding before you're stuck with a filing deadline

### Movement Strategy

**Path Choices:**
- Some choices lock permanently (e.g., DOB type)
- Plan ahead before committing
- "Try Again" available on some spaces

**Dice Spaces:**
- **CHEAT spaces:** You actively roll the dice to try to cheat the system
- **REG spaces:** Dice rolls automatically (clerk/examiner makes the decision)
- Check DICE_OUTCOMES data for probabilities
- "Try Again" if outcome is unfavorable

---

## Troubleshooting

### Common Issues

**"N actions left" - can't end turn**
- Check "Things you can do" for anything still unfinished
- Pending choice modals must be resolved
- Some spaces require mandatory actions

**Expeditor won't activate**
- Check phase restrictions (it may not be usable in the current phase — a "Not yet" hint explains why)
- Verify you have enough money for its cost
- Ensure it's your turn

**Movement not working**
- **CHEAT dice spaces:** Tap the dice action button under "Things you can do" first (e.g. "Roll for...")
- **REG dice spaces:** Wait for auto-roll (happens automatically)
- Choice spaces require selecting destination
- Terminal spaces (FINISH) have no movement

**Connection lost**
- Check internet connection
- Refresh browser
- Server auto-reconnects within 30 seconds

### Getting Help

- **Technical issues:** Check `docs/technical/` folder
- **Game rules:** See [Game Overview](#game-overview) above and [Game Actions](#game-actions)
- **Bug reports:** Use the in-app bug-report button (floating ladybug icon) — submits with screenshot

---

## Space Data Editor

The Space Data Editor allows game designers to edit space data directly from the game interface.

### Accessing the Editor

1. Click the **gear icon** (⚙️) in the game header
2. Select **"Data Editor"** from the menu

### Editor Features

**Spaces Tab:**
- Browse all game spaces in the left panel
- Search by name or filter by phase
- Edit all 49 columns for each space (incl. Workstream 6 flags: starting space, scope-zero guard, fee math, auto-funding, path-choice memory, etc.)
- Toggle between First/Subsequent visit data
- Edit narrative text (Event, Action, Outcome) and per-action card narratives
- Configure card effects (W, B, I, L, E cards) and per-action modal overrides
- Set movement destinations and path types (FIXED / CHOICE / DICE / LOGIC)
- Configure dice roll requirements

**Dice Rolls Tab:**
- View dice roll outcomes for each space
- Edit roll 1-6 values
- Add new dice roll categories
- Delete unnecessary rows

### Workflow (Live Save — since v2.27.3)

1. **Make changes** in the editor
2. **Save** with Ctrl+S or the Save button — server writes `public/data/SOURCE_FILES/` and auto-regenerates `CLEAN_FILES/` via `server/processGameData.js`
3. **Reload game** to see changes (or use Live Reload)

> Export to file is still available as a secondary local backup option.

### Keyboard Shortcuts

- **Escape** - Close editor
- **Ctrl+S** - Save (writes SOURCE_FILES + regenerates CLEAN_FILES)

### Important Notes

- Editor saves persist across deploys (since v2.42.0).
- CLEAN_FILES are auto-regenerated — never edit them directly.
- Reset to Baseline is available in the editor toolbar to restore Dockerfile baseline.

---

## Additional Resources

- **[RELEASE_NOTES.md](./RELEASE_NOTES.md)** - Latest features and changes
- **[API_REFERENCE.md](../technical/API_REFERENCE.md)** - Technical API details
- **[ARCHITECTURE.md](../technical/ARCHITECTURE.md)** - System architecture

---

**Enjoy the game!** 🎮

**Feedback:** Use the in-app bug-report button (floating ladybug icon) — submits with screenshot directly to the host.

**Last Updated:** August 1, 2026
