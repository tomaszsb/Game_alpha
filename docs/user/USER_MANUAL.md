# User Manual - Game Alpha

**Last Updated:** December 9, 2025
**Version:** 2.0
**Status:** Production Ready

Welcome to Game Alpha! This manual will help you understand how to play the game and use the interface effectively.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Game Overview](#game-overview)
3. [Player Panel Guide](#player-panel-guide)
4. [Game Actions](#game-actions)
5. [Multi-Device Play](#multi-device-play)
6. [Tips & Strategies](#tips--strategies)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Quick Start

1. **Access the game** at http://localhost:3000 (local) or your hosted URL
2. **Add players** in the setup screen (2-4 players)
3. **Start game** - players automatically placed at START space
4. **Play turns** - follow the "Next Step" button guidance
5. **Win** by completing your construction project first!

### Multi-Device Setup

**For individual player control on separate devices:**

1. Start game on main device
2. Each player scans their QR code or uses short URL (`?p=P1`, `?p=P2`)
3. Players can now control their turns from their own device
4. All devices stay synchronized in real-time

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
- Track via Finances section

**Time:**
- Measured in "ticks" (weeks/months)
- Affected by space effects and cards
- Win condition: Finish with lowest time

**Project Scope:**
- Based on Work (W) cards collected
- Determines funding amounts
- Recalculated when W cards played

---

## Player Panel Guide

### Interface Layout

The Player Panel uses a **mobile-first expandable design**:

```
┌─────────────────────────────────┐
│ 🃏 CURRENT CARD         (🔴)   │  ← Action indicator
├─────────────────────────────────┤
│ 📊 PROJECT SCOPE               │
│ 💰 FINANCES            (🔴)    │  ← Shows money actions
│ ⏱️  TIME                        │
│ 🎴 CARDS                        │
├─────────────────────────────────┤
│  🔄 Try Again  |  ▶️ End Turn   │  ← Action buttons
└─────────────────────────────────┘
```

### Expandable Sections

**Click section headers** to expand/collapse:

- **🃏 Current Card:** Active space details and effects
- **📊 Project Scope:** Work cards and project value
- **💰 Finances:** Money, loans, transactions
- **⏱️ Time:** Elapsed time, time-affecting cards
- **🎴 Cards:** Available, active, and discarded cards

### Action Indicators (🔴)

**Red dots** show where actions are available:
- **Finances 🔴:** "Get Funding" button available
- **Time 🔴:** "Roll to Move" button available
- **Cards 🔴:** Cards can be played

### Next Step Button

**Context-aware button** showing your next action:

| State | Display | Action |
|-------|---------|--------|
| **Ready** | ✅ "End Turn" (green) | Click to end your turn |
| **Waiting** | ⏸️ "2 actions remaining" (gray) | Complete pending actions first |
| **Moving** | 🎲 "Roll to Move" (blue) | Roll dice for movement |

---

## Game Actions

### Turn Sequence

1. **Turn starts** automatically
2. **Space effects** process (if applicable)
3. **Take manual actions** (optional):
   - Get funding (if at funding space)
   - Play cards from hand
   - Transfer cards to other players
4. **Roll to move** (if on dice space)
5. **Choose destination** (if multiple paths)
6. **End turn** when all actions complete

### Manual Actions

#### Get Funding
- **When:** At OWNER-FUND-INITIATION space
- **How:** Click "Get Funding" button in Finances section
- **Effect:** Automatically draws appropriate loan card based on project scope

#### Play Cards
- **When:** Anytime during your turn (phase restrictions apply)
- **How:**
  1. Expand Cards section
  2. Click card to view details
  3. Click "Play Card" button
  4. Pay cost (if applicable)
- **Effect:** Card effects execute immediately or become active

#### Transfer Cards
- **When:** You have transferable cards (E or L types)
- **How:**
  1. Click card in Cards section
  2. Click "Transfer" button
  3. Select recipient player
- **Effect:** Card moves to recipient's hand

#### Try Again
- **When:** Available on certain spaces (button appears)
- **How:** Click "🔄 Try Again" button
- **Effect:** Reverts to state before current space entry (time penalty may apply)

### Automatic Actions

These happen automatically when conditions are met:

- **Space arrival effects:** Process when you land on a space
- **Card expirations:** Active cards with durations expire at turn end
- **Win condition check:** Game ends when a player finishes

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
- Track loan balances in Finances section

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
- Can be transferred between players

**Life Event (L) Cards:**
- Usually negative effects
- Can be transferred to opponents (strategic!)
- Some have dice-based outcomes

### Movement Strategy

**Path Choices:**
- Some choices lock permanently (e.g., DOB type)
- Plan ahead before committing
- "Try Again" available on some spaces

**Dice Spaces:**
- Outcomes vary - calculated risk
- Check DICE_OUTCOMES data for probabilities
- "Try Again" if outcome is unfavorable

---

## Troubleshooting

### Common Issues

**"Actions remaining" - can't end turn**
- Check for red action indicators (🔴)
- Pending choice modals must be resolved
- Some spaces require mandatory actions

**Card won't play**
- Check phase restrictions (card may not be playable in current phase)
- Verify you have enough money for cost
- Ensure it's your turn

**Movement not working**
- Dice spaces require rolling first
- Choice spaces require selecting destination
- Terminal spaces (FINISH) have no movement

**Connection lost**
- Check internet connection
- Refresh browser
- Server auto-reconnects within 30 seconds

### Getting Help

- **Technical issues:** Check `docs/technical/` folder
- **Game rules:** See PROJECT_STATUS.md for game mechanics
- **Bug reports:** Create issue with reproduction steps

---

## Additional Resources

- **[RELEASE_NOTES.md](./RELEASE_NOTES.md)** - Latest features and changes
- **[API_REFERENCE.md](../technical/API_REFERENCE.md)** - Technical API details
- **[ARCHITECTURE.md](../technical/ARCHITECTURE.md)** - System architecture

---

**Enjoy the game!** 🎮

**Last Updated:** December 9, 2025
