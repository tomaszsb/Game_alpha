# Player Panel User Guide

**Date:** November 27, 2025
**Version:** 1.0

---

## 1. Introduction

Welcome to the new and improved Player Panel UI! This redesign focuses on providing a clearer, more organized, and mobile-friendly experience for managing your game. All key information and actions are now more accessible, reducing clutter and improving your strategic overview.

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

**END OF USER GUIDE**
