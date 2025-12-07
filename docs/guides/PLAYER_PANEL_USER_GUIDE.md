# Player Panel User Guide

**Date:** November 30, 2025
**Version:** 2.0 - Enhanced Edition
**Applies to:** UI Redesign Phases 1-5 (Complete)

---

## 1. Introduction

Welcome to the completely redesigned Player Panel UI! This mobile-first interface provides a clearer, more organized experience for managing your construction project game. All key information and actions are now accessible through an intuitive expandable section design, reducing clutter while improving your strategic overview.

### What's New in Version 2.0
- 🎯 **Mobile-First Design** - Optimized for phone, tablet, and desktop
- 📱 **Multi-Device Support** - Play on multiple devices simultaneously via QR codes
- 🔴 **Action Indicators** - Red circles show where actions are available
- ⚡ **Context-Aware Buttons** - "Next Step" button adapts to game state
- 💰 **Enhanced Finances** - Detailed cost tracking and financial health warnings
- ♿ **Accessibility** - WCAG 2.1 AA compliant for all users

---

## 2. Expandable Sections

The Player Panel is now organized into several expandable sections, each dedicated to a specific aspect of your game.

*   **Current Card:** Shows details and choices for the card you're currently interacting with.
*   **Project Scope:** Displays your project progress and "Work" card related actions.
*   **Finances:** Manages your money, budget, and financial actions.
*   **Time:** Tracks your elapsed time and time-related actions.
*   **Cards:** Provides an overview of your card hand and options to acquire more cards.

### How to Use:
*   **Expand/Collapse:** Click on the section header (e.g., "💰 FINANCES") to expand or collapse its content.
*   **Action Indicator (🔴):** A red circle next to a section title (e.g., "💰 FINANCES 🔴") indicates that there's an action available or required within that section.

---

## 3. Current Card Section

This section dynamically appears when you interact with a card that requires a choice or provides detailed information.

*   **Card Details:** Displays the card's name, story, required action, and potential outcomes.
*   **Dynamic Choices:** If the card requires a decision (e.g., Accept, Negotiate, Reject), interactive buttons will appear for you to make your choice. Click the appropriate button to proceed.

---

## 4. Next Step Button

The **Next Step Button** is a persistent, context-aware button located at the bottom-right of your screen. Its label and functionality dynamically change to guide you through the primary game loop.

*   **"Roll to Move"**: Appears when you need to roll dice to move your player on the board.
*   **"End Turn"**: Appears when you have completed all mandatory actions and are ready to pass the turn to the next player.
*   **Disabled State**: The button will be grayed out and display a tooltip like "Complete current action first" if you have a pending choice (e.g., from a card or space effect) that needs to be resolved before proceeding.

---

## 5. Try Again Button

The **Try Again Button** (🔄 Try Again) is located to the left of the Next Step Button. This button allows you to revert your last action on certain spaces, giving you a chance to make a different decision.

*   **Purpose:** Use it if you made a mistake or want to explore a different outcome for your current space action.
*   **Availability:** Only appears when you are on a space that supports the "Try Again" feature.

---

## 6. Discard Pile Modal

You can view your discarded cards through a dedicated modal.

*   **Access:** Click the "View Discarded" button within the "Cards" section of the Player Panel.
*   **Content:** Lists all cards you have discarded during the game.
*   **Filtering & Sorting:** Use the dropdown menus to filter cards by type (Work, Bank Loan, etc.) or sort them by name.

---

## 7. Game Board Player Roles

Player roles are now visually displayed directly on the Game Board.

*   **Visibility:** When a player token is on a space, a small badge with their shortened role (e.g., "EXP" for Explorer) will appear next to their avatar. This provides quick visual information about each player's identity.

---

## 8. Accessibility

The new UI has been designed with accessibility in mind, incorporating:
*   **Semantic HTML:** Ensures compatibility with assistive technologies.
*   **ARIA Attributes:** Provides additional context for screen readers.
*   **Keyboard Navigation:** All interactive elements are reachable and operable via keyboard.
*   **Color Contrast:** Meets WCAG AA standards for readability.

---

## 9. Detailed Section Guides

### 9.1 Finances Section - Deep Dive

The Finances section provides comprehensive financial tracking for your construction project.

#### Scope & Budget Display
- **Project Scope:** Total project value ($100,000 typical)
- **Total Budget:** Available funding from all sources
- **Cash on Hand:** Liquid money for immediate expenses

#### Expenditure Tracking
Tracks spending across three main categories:
1. **Design** - Architectural and planning costs
2. **Fees** - Permits, licenses, professional fees
3. **Construction** - Building and labor costs

#### Detailed Cost Breakdown
Expandable cost categories provide granular tracking:
- **Bank Fees** - Loan origination, interest payments
- **Architectural Fees** - Design services
- **Engineering Fees** - Structural and systems design
- **Permit Fees** - Government approvals
- And more...

#### Financial Health Indicators
- **Design Cost %** - Warns if design exceeds 20% (⚠️ indicator)
- **Budget Variance** - Shows over/under budget status
- **Funding Mix** - Ratio of owner vs external funding

#### Money Sources Breakdown
Track where your money comes from:
- **Owner Funding** - Personal investment
- **Investor Funding** - External capital
- **Bank Loans** - Borrowed funds with interest

**Pro Tip:** Keep design costs under 20% of total budget to avoid financial health warnings!

---

### 9.2 Project Scope Section

Tracks your project completion progress through Work cards.

**Key Metrics:**
- **Scope Completion %** - Visual progress bar
- **Work Cards Played** - Count of completed work
- **Remaining Scope** - Work still needed

**Work Card Actions:**
When Work cards are available and conditions met, action buttons appear:
- "Play Work Card" - Apply work to reduce scope
- Card selection modal for choosing which Work card to use

---

### 9.3 Time Section

Monitors your time spent on the project.

**Displays:**
- ⏰ **Time Spent** - Current time investment
- Time threshold warnings
- Time-related manual actions (when available)

**Time Actions:**
- Roll for time (if available)
- Time-based choices from cards or spaces

---

### 9.4 Cards Section

Manage your card hand and acquisitions.

**Hand Overview:**
- **W (Work)** - Reduce project scope
- **B (Bank Loan)** - Borrow money
- **E (Event)** - Special events and opportunities
- **L (Legal)** - Legal challenges
- **I (Investment)** - External funding

**Actions:**
- **Draw Cards** - Acquire new cards from deck
- **View Discarded** - Access discard pile modal
- **Play Cards** - Use cards for effects (when applicable)

**Card Limit:** Maximum hand size enforced by game rules

---

## 10. Common Workflows

### 10.1 Starting Your Turn
1. **Check Next Step Button** - See what action is required
2. **Review Action Indicators** (🔴) - Identify available actions
3. **Roll to Move** (if shown) - Click to roll dice and move
4. **Handle Space Effects** - Complete any automatic effects
5. **Make Choices** - Select from presented options
6. **End Turn** - When all actions complete

### 10.2 Playing a Card
1. **Receive Card** - From space effect or draw action
2. **Review Card** - Opens automatically in Current Card section
3. **Read Story/Effects** - Understand what the card does
4. **Make Choice** - Accept, Negotiate, or Reject
5. **Negotiate (if chosen)** - Engage with other players
6. **Resolve Effects** - Card effects apply to your game state

### 10.3 Financial Management
1. **Monitor Cash Flow** - Check Finances section regularly
2. **Track Expenditures** - Review cost breakdown
3. **Manage Funding** - Balance owner vs external funding
4. **Take Loans Wisely** - Bank Loan cards available when needed
5. **Watch Design Costs** - Keep under 20% threshold

### 10.4 Using Manual Actions
1. **Look for 🔴 Indicators** - Shows where actions available
2. **Expand Section** - Click section header to open
3. **Click Action Button** - "Roll for Money", "Draw Cards", etc.
4. **Confirm Action** - Some actions require confirmation
5. **View Results** - Effects applied immediately

---

## 11. Multi-Device Play

### 11.1 Setting Up Multiple Devices

**Desktop (Host):**
1. Start the game on your desktop/laptop
2. Navigate to the game URL (e.g., `http://localhost:3000`)
3. Look for QR codes in the setup screen
4. Each player gets a unique QR code

**Mobile (Player Device):**
1. Scan your player's QR code with your phone
2. Opens player-specific URL: `http://[host]:3000?p=P1`
3. Your Player Panel appears (no game board)
4. All actions sync automatically with host

### 11.2 Benefits of Multi-Device
- **Privacy** - Each player only sees their own panel
- **Mobility** - Move around while playing
- **Focus** - Dedicated view without distractions
- **Accessibility** - Players can zoom, adjust text size on their device

### 11.3 Device Sync
- **Automatic Updates** - Changes sync every 500ms
- **Real-Time** - See effects immediately
- **No Refresh Needed** - Updates happen in background
- **Reconnection** - Simply refresh if connection drops

---

## 12. Tips & Tricks

### 💡 Interface Tips
1. **Collapse Unused Sections** - Keep screen clean, expand only what you need
2. **Watch for 🔴 Indicators** - Don't miss available actions
3. **Use Keyboard** - Tab through buttons, Enter to activate
4. **Desktop Advantage** - See game board + panel side-by-side
5. **Mobile Optimization** - Portrait mode works best on phones

### 💰 Financial Strategy Tips
1. **Early Investment** - Front-load owner funding
2. **Monitor Design Costs** - Keep under 20% to avoid warnings
3. **Strategic Loans** - Use Bank Loan cards when cash-strapped
4. **Track Cash Flow** - Expandable cost categories show where money goes
5. **Budget Cushion** - Maintain reserve for unexpected fees

### 🎯 Gameplay Tips
1. **Read Card Stories** - Context helps decision-making
2. **Negotiate Wisely** - Don't always accept first option
3. **Plan Ahead** - Check upcoming spaces on game board
4. **Use Try Again** - Experiment with outcomes on supporting spaces
5. **Time Management** - Balance time spent vs project progress

---

## 13. Troubleshooting

### Issue: Next Step Button is Disabled
**Cause:** You have a pending choice or action to complete
**Solution:**
1. Look for open choice modals
2. Check for 🔴 action indicators in sections
3. Complete Current Card choices if present
4. Hover over button for tooltip explanation

### Issue: Can't See My Cards
**Cause:** Cards section may be collapsed
**Solution:**
1. Scroll to Cards section
2. Click "🃏 CARDS" header to expand
3. Cards listed by type (W/B/E/L/I)

### Issue: Action Button Not Working
**Cause:** Action may not be available yet
**Solution:**
1. Check if conditions are met (e.g., on correct space)
2. Verify you haven't already used that action
3. Refresh page if button seems stuck
4. Check game log for error messages

### Issue: Finances Don't Add Up
**Cause:** Multiple transactions may have occurred
**Solution:**
1. Check Expenditures section for all spending
2. Review Money Sources for all income
3. Check game log for transaction history
4. Remember: loans count as income but add debt

### Issue: Mobile View is Cut Off
**Cause:** Screen zoom or orientation
**Solution:**
1. Use portrait orientation on phones
2. Reset browser zoom to 100%
3. Try landscape on tablets
4. Full-screen mode can help

### Issue: QR Code Not Scanning
**Cause:** Camera permissions or code quality
**Solution:**
1. Allow camera access in browser
2. Ensure good lighting on QR code
3. Hold phone steady, 6-12 inches away
4. Try manual URL entry as alternative

---

## 14. Accessibility Features

### Screen Reader Support
- **ARIA Labels** - All interactive elements labeled
- **Semantic HTML** - Proper heading hierarchy
- **Live Regions** - Dynamic updates announced
- **Focus Management** - Logical tab order

### Keyboard Navigation
- **Tab** - Move between interactive elements
- **Enter/Space** - Activate buttons
- **Escape** - Close modals
- **Arrow Keys** - Navigate within components

### Visual Accessibility
- **High Contrast** - 4.5:1 minimum text ratio
- **Focus Indicators** - Visible keyboard focus
- **Color Independence** - Information not color-only
- **Resizable Text** - Supports browser zoom up to 200%

### Mobile Accessibility
- **Touch Targets** - Minimum 44x44px buttons
- **Swipe Support** - Alternative to clicks
- **Voice Control** - Works with mobile assistive tech
- **Screen Orientation** - Supports both portrait/landscape

---

## 15. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Next interactive element |
| `Shift+Tab` | Previous interactive element |
| `Enter` | Activate focused button |
| `Space` | Activate focused button |
| `Escape` | Close modal/cancel action |
| `Arrow Keys` | Navigate lists/choices |

---

## 16. Getting Help

### In-Game Help
- **Tooltips** - Hover over elements for hints
- **Button Explanations** - Disabled buttons show why
- **Game Log** - Review recent actions and events
- **Current Card** - Read story/description for context

### External Resources
- **Component Reference** - Developer documentation in `/docs/guides/UI_COMPONENT_REFERENCE.md`
- **Game Rules** - Full game rules documentation
- **Technical Support** - Report issues via GitHub

---

## 17. Version History

**Version 2.0** (Nov 30, 2025) - Enhanced Edition
- Added multi-device play guide
- Expanded financial tracking documentation
- Added common workflows section
- Added tips, tricks, and troubleshooting
- Enhanced accessibility documentation
- Added keyboard shortcuts reference

**Version 1.0** (Nov 27, 2025) - Initial Release
- Basic player panel UI guide
- Expandable sections introduction
- Next Step button explanation
- Core feature documentation

---

**END OF USER GUIDE**
