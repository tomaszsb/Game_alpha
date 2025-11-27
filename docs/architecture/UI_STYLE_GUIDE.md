# Code2027 UI Style Guide

**Version:** 1.0
**Last Updated:** November 2025
**Status:** Active Reference

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Buttons](#buttons)
4. [Spacing & Layout](#spacing--layout)
5. [Components](#components)
6. [Animations & Transitions](#animations--transitions)
7. [Accessibility](#accessibility)
8. [Implementation Guidelines](#implementation-guidelines)

---

## Color System

### Primary Palette

The game uses Bootstrap-inspired semantic colors defined in `src/styles/theme.ts`.

#### Core Colors

```typescript
// Primary (Blue) - Main brand color
Primary Main:    #007bff  // Use for primary actions, links, active states
Primary Dark:    #0056b3  // Use for hover states on primary elements
Primary Light:   #e3f2fd  // Use for light backgrounds, highlights
Primary Text:    #1976d2  // Use for primary text elements

// Secondary (Gray) - Most commonly used
Secondary Main:  #6c757d  // Use for secondary actions, muted elements
Secondary Dark:  #495057  // Use for dark text, emphasis
Secondary Darker:#5a6268  // Use for hover states
Secondary Light: #e9ecef  // Use for subtle backgrounds
Secondary BG:    #f8f9fa  // Use for section backgrounds (VERY COMMON)
Secondary Border:#dee2e6  // Use for borders (VERY COMMON)

// Success (Green) - Second most used
Success Main:    #28a745  // Use for positive actions, confirmations
Success Dark:    #218838  // Use for success hover states
Success Light:   #d4edda  // Use for success backgrounds
Success Text:    #2c5530  // Use for success messages

// Warning (Yellow/Orange)
Warning Main:    #ffc107  // Use for caution, important notices
Warning Dark:    #e0a800  // Use for warning hover states
Warning BG:      #fff3cd  // Use for warning backgrounds
Warning Text:    #856404  // Use for warning text

// Danger (Red)
Danger Main:     #dc3545  // Use for destructive actions, errors
Danger Dark:     #c53030  // Use for danger hover states
Danger Light:    #ffebee  // Use for error backgrounds
Danger Text:     #c62828  // Use for error text
```

#### Usage Rules

**DO:**
- Use `colors.primary.main` for primary CTAs (Call-to-Action buttons)
- Use `colors.success.main` for confirmation/next step buttons
- Use `colors.secondary.bg` (#f8f9fa) for section backgrounds
- Use `colors.secondary.border` (#dee2e6) for most borders
- Always import from `src/styles/theme.ts`

**DON'T:**
- Don't hardcode hex values in components
- Don't use colors outside the defined palette
- Don't use primary blue for destructive actions
- Don't use more than 3 colors in a single component

### Game-Specific Colors

```typescript
// Card Types
Card W (Purple):  #6f42c1
Card B (Green):   #28a745
Card E (Red):     #dc3545
Card I (Blue):    #007bff
Card L (Yellow):  #ffc107

// Player Colors (1-8)
Player 1: #007bff  (Blue)
Player 2: #28a745  (Green)
Player 3: #dc3545  (Red)
Player 4: #ffc107  (Yellow)
Player 5: #6f42c1  (Purple)
Player 6: #e83e8c  (Pink)
Player 7: #20c997  (Teal)
Player 8: #fd7e14  (Orange)
```

---

## Typography

### Font Hierarchy

The application uses system fonts for optimal performance and native feel.

#### Heading Levels

```css
/* H1 - Modal Titles, Main Headers */
font-size: 24px;
font-weight: bold (700);
color: colors.text.primary (#212529);
line-height: 1.2;

/* H2 - Section Titles */
font-size: 20px;
font-weight: bold (700);
color: colors.text.primary (#212529);
line-height: 1.3;

/* H3 - Subsection Headers */
font-size: 16px;
font-weight: bold (700);
color: colors.text.primary (#212529);
margin-bottom: 8px;

/* H4 - Minor Headers */
font-size: 15px;
font-weight: bold (700);
color: colors.primary.text (#1976d2);
margin: 0 0 4px 0;
```

#### Body Text

```css
/* Primary Body Text */
font-size: 14px;
font-weight: 400;
color: colors.text.primary (#212529);
line-height: 1.5;

/* Secondary Body Text */
font-size: 14px;
font-weight: 400;
color: colors.text.secondary (#6c757d);
line-height: 1.4;

/* Small Text / Labels */
font-size: 13px;
font-weight: 500;
color: colors.text.secondary (#666);
line-height: 1.4;

/* Micro Text / Helper Text */
font-size: 0.8rem (12.8px);
font-weight: 400;
color: colors.text.muted (#6b7280);
font-style: italic;
```

#### UI Labels & Stats

```css
/* Stat Labels */
font-size: 14px;
font-weight: 500;
color: var(--text-secondary, #666);

/* Stat Values */
font-size: 15px;
font-weight: 600;
color: var(--text-color, #333);

/* Player Name */
font-size: 1.2rem (19.2px);
font-weight: bold;
color: #1976d2;

/* Section Titles (Compact) */
font-size: 14px;
font-weight: bold;
color: var(--text-color, #333);
```

### Font Weight Usage

- **400 (Normal):** Body text, descriptions
- **500 (Medium):** Labels, secondary emphasis
- **600 (Semi-bold):** Values, stats, important data
- **700 (Bold):** Headings, buttons, player names

---

## Buttons

### Button Variants

#### Primary Button (Action Button)

**Use:** Main actions, primary CTAs

```css
/* Base State */
padding: 4px 12px;
font-size: 14px;
font-weight: 500;
border: none;
border-radius: 6px;
background: var(--primary-color, #007bff);
color: white;
cursor: pointer;
transition: all 0.2s ease;

/* Hover State */
background: var(--primary-hover, #0056b3);
transform: translateY(-1px);
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

/* Active State */
transform: translateY(0);

/* Focus State */
outline: 2px solid var(--primary-color, #007bff);
outline-offset: 2px;

/* Disabled State */
opacity: 0.6;
cursor: not-allowed;
```

**Implementation:**
```tsx
// Import colors
import { colors } from '../../styles/theme';

// Inline styles for buttons
const buttonStyle = {
  padding: '10px 20px',
  border: 'none',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  backgroundColor: colors.primary.main,
  color: 'white'
};
```

#### Success Button (Next Step)

**Use:** Confirmation actions, progression

```css
/* Base State */
padding: 10px 16px;
background: var(--primary-color, #28a745);
color: white;
border: none;
border-radius: 6px;
font-size: 0.9rem;
font-weight: bold;
min-height: 44px; /* Touch-friendly */
transition: all 0.2s ease;

/* Hover State */
background: #218838;
transform: translateY(-1px);
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

/* Disabled State */
background: #cccccc;
color: #666666;
opacity: 0.6;
```

#### Secondary Button

**Use:** Less prominent actions, cancel actions

```css
/* Base State */
background: var(--secondary-color, #6c757d);
color: white;
/* All other properties same as Primary */

/* Hover State */
background: var(--secondary-hover, #5a6268);
```

#### Danger Button

**Use:** Destructive actions, removals

```css
/* Base State */
background: var(--error-red, #dc3545);
color: white;

/* Hover State */
background: var(--error-hover, #c82333);
```

#### Warning Button (Try Again)

**Use:** Retry actions, special cases

```css
/* Base State */
padding: 10px 16px;
font-size: 0.9rem;
font-weight: bold;
color: #000;
background-color: #ffc107;
border: none;
border-radius: 6px;
transition: all 0.2s ease;

/* Hover State */
background-color: #e0a800;
transform: translateY(-1px);
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
```

### Button Loading State

```css
/* Loading Spinner */
.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### Button Best Practices

**DO:**
- Use `min-height: 44px` for touch-friendly targets
- Include hover animations (translateY, box-shadow)
- Use consistent border-radius (6px for small, 8px for large)
- Include disabled states
- Use semantic colors (success for confirm, danger for delete)

**DON'T:**
- Don't use buttons smaller than 44px height on mobile
- Don't skip transition properties
- Don't use custom colors outside the palette
- Don't forget focus states for accessibility

---

## Spacing & Layout

### Spacing Scale

Based on 8px grid system defined in `src/styles/theme.ts`:

```typescript
spacing: {
  xs: '4px',   // Tight spacing, internal gaps
  sm: '8px',   // Default internal spacing
  md: '16px',  // Standard component spacing
  lg: '24px',  // Section spacing
  xl: '32px',  // Large section breaks
}
```

### Layout Patterns

#### Flex Containers

```css
/* Vertical Stack (Default) */
display: flex;
flex-direction: column;
gap: 8px; /* or appropriate spacing */

/* Horizontal Row */
display: flex;
flex-direction: row;
gap: 12px;
align-items: center;

/* Space Between */
display: flex;
justify-content: space-between;
align-items: center;
```

#### Grid Layouts

```css
/* Stat Grid (FinancesSection) */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}
```

#### Padding Standards

```css
/* Component Padding */
Small Component:   padding: 6px 12px;
Medium Component:  padding: 8px 12px;
Large Component:   padding: 12px 16px;
Modal Content:     padding: 12px 16px;
Modal Large:       padding: 30px;
```

#### Gap Standards

```css
/* Gap Sizes */
Tight Items:    gap: 2px-4px;
Related Items:  gap: 8px;
Components:     gap: 12px;
Sections:       gap: 16px;
```

### Border Radius

```typescript
borderRadius: {
  sm: '4px',   // Small elements, stats
  md: '8px',   // Buttons, cards
  lg: '12px',  // Modals, large containers
  full: '50%', // Circular elements
}
```

**Common Usage:**
- Buttons: `6px` or `8px`
- Cards: `8px`
- Modals: `12px` or `16px`
- Input fields: `4px`
- Badges/Pills: `50%` or `9999px`

---

## Components

### Modals

#### Base Modal Structure

```tsx
// Overlay (DiceResultModal pattern - BEST EXAMPLE)
const modalStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)', // Dark overlay
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '20px',
  animation: 'fadeIn 0.2s ease-out'
};

// Content Container
const contentStyle = {
  backgroundColor: 'white',
  borderRadius: '16px',
  maxWidth: '500px',
  width: '100%',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
  animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
};

// Header
const headerStyle = {
  padding: '12px 16px',
  borderBottom: `2px solid ${colors.secondary.light}`,
  textAlign: 'center'
};

// Body
const bodyStyle = {
  padding: '12px 16px',
  flex: 1,
  overflowY: 'auto'
};

// Footer
const footerStyle = {
  padding: '12px 16px',
  display: 'flex',
  justifyContent: 'center',
  gap: '12px'
};
```

#### Modal Animations

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    transform: scale(0.9) translateY(-20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
```

### Expandable Sections

**Pattern from:** `src/components/player/ExpandableSection.css`

```css
/* Container */
.expandable-section {
  border-top: 1px solid var(--border-color, #eee);
  background: var(--card-bg, #fff);
}

/* Header Button */
.expandable-section__header {
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.expandable-section__header:hover {
  background-color: var(--hover-bg, #f5f5f5);
}

/* Content */
.expandable-section__content {
  padding: 0 12px;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.expandable-section__content--expanded {
  padding-bottom: 12px;
  max-height: 500px;
}
```

### Player Panel

**Pattern from:** `src/components/player/PlayerPanel.css`

#### Header Design (BEST EXAMPLE)

```css
.player-panel__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  border: 2px solid #2196f3;
  border-radius: 8px;
  margin-bottom: 4px;
}

.player-avatar {
  font-size: 2.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.player-name {
  font-size: 1.2rem;
  font-weight: bold;
  color: #1976d2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

#### Inline Notification (BEST EXAMPLE)

```css
.player-notification-inline {
  flex: 1 1 50%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: linear-gradient(135deg, #fff3cd, #ffeaa7);
  border: 2px solid #ffc107;
  border-radius: 6px;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Stats Display

```css
/* Stat Line (horizontal) */
.stat-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 14px;
}

.stat-label {
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.stat-value {
  font-weight: 600;
  color: var(--text-color, #333);
  font-size: 15px;
}

/* Stat Item (boxed) */
.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
}
```

### Cards & Backgrounds

```css
/* Card Background (standard) */
background: var(--card-bg, #fff);
border: 1px solid var(--border-color, #eee);
border-radius: 8px;
padding: 12px;

/* Section Background */
background: #f8f9fa;
border-radius: 4px;
padding: 8px;

/* Highlight Box (Summary) */
background: colors.primary.light (#e3f2fd);
border: 2px solid colors.primary.main (#007bff);
border-radius: 8px;
padding: 10px 12px;

/* Warning Box */
background: #fff3cd;
border-left: 3px solid #ff9800;
padding: 8px;
font-size: 0.85rem;
color: #856404;
```

---

## Animations & Transitions

### Standard Transitions

```css
/* Default Transition (most common) */
transition: all 0.2s ease;

/* Background Color Only */
transition: background-color 0.2s ease;

/* Transform + Box-Shadow (buttons) */
transition: all 0.2s ease;
/* On hover */
transform: translateY(-1px);
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

/* Expand/Collapse */
transition: max-height 0.3s ease;
```

### Keyframe Animations

```css
/* Fade In (modals) */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Usage: animation: fadeIn 0.2s ease-out; */

/* Slide In (modals) */
@keyframes slideIn {
  from {
    transform: scale(0.9) translateY(-20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
/* Usage: animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); */

/* Bounce In (large elements) */
@keyframes bounceIn {
  from { transform: scale(0.8); }
  to { transform: scale(1); }
}
/* Usage: animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55); */

/* Spin (loading) */
@keyframes spin {
  to { transform: rotate(360deg); }
}
/* Usage: animation: spin 0.8s linear infinite; */
```

### Easing Functions

```css
/* Standard Easing */
ease:           General purpose
ease-in:        Slow start
ease-out:       Slow end (best for entering)
ease-in-out:    Slow start and end

/* Custom Cubic Bezier */
cubic-bezier(0.34, 1.56, 0.64, 1):  Bouncy (for modals)
cubic-bezier(0.68, -0.55, 0.265, 1.55): Extra bouncy (for icons)
```

### Hover Effects

```css
/* Button Hover (standard) */
onMouseEnter: transform: translateY(-1px), opacity: 0.8
onMouseLeave: transform: translateY(0), opacity: 1

/* Background Hover */
onMouseEnter: background: darker shade
onMouseLeave: background: original

/* Section Hover */
onMouseEnter: background-color: var(--hover-bg, #f5f5f5)
```

---

## Accessibility

### Focus States

```css
/* Standard Focus Ring */
:focus {
  outline: 2px solid #80bdff;
  outline-offset: 2px;
}

/* Button Focus */
.action-button:focus {
  outline: 2px solid var(--primary-color, #007bff);
  outline-offset: 2px;
}
```

### Keyboard Support

**Required handlers:**
```tsx
// Modal keyboard handling
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Escape') onClose();
  if (e.key === 'Enter' || e.key === ' ') handleAction();
};

// Apply to modal overlay
<div
  onKeyDown={handleKeyDown}
  tabIndex={0}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
```

### Touch Targets

```css
/* Minimum touch target size */
min-height: 44px;
min-width: 44px;

/* Touch-friendly padding */
padding: 10px 16px; /* Minimum */
```

### Color Contrast

**Minimum contrast ratios (WCAG AA):**
- Normal text (14px+): 4.5:1
- Large text (18px+ or 14px bold): 3:1
- UI components: 3:1

**Verified combinations:**
- White on Primary (#007bff): ✓ 4.5:1
- White on Success (#28a745): ✓ 4.5:1
- White on Danger (#dc3545): ✓ 4.5:1
- Primary text (#212529) on white: ✓ 16:1
- Secondary text (#6c757d) on white: ✓ 4.5:1

---

## Implementation Guidelines

### CSS Variable Pattern

Many components use CSS variables for theming:

```css
/* Define CSS variables (not currently in global scope) */
:root {
  --primary-color: #007bff;
  --primary-hover: #0056b3;
  --secondary-color: #6c757d;
  --error-red: #dc3545;
  --border-color: #dee2e6;
  --text-color: #333;
  --text-secondary: #666;
  --card-bg: #fff;
  --hover-bg: #f5f5f5;
}

/* Use with fallbacks */
color: var(--text-color, #333);
background: var(--card-bg, #fff);
border: 1px solid var(--border-color, #eee);
```

### TypeScript/TSX Pattern

```tsx
import { colors } from '../../styles/theme';

const MyComponent = () => {
  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: colors.primary.main,
    color: colors.white,
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  return (
    <button
      style={buttonStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.dark;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = colors.primary.main;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      Click Me
    </button>
  );
};
```

### Component CSS Pattern

```css
/* Component-specific file: ComponentName.css */

/* Use BEM-like naming */
.component-name {
  /* Container styles */
}

.component-name__element {
  /* Element styles */
}

.component-name__element--modifier {
  /* Modified element styles */
}

/* Use CSS variables for theme values */
color: var(--text-color, #333);

/* Include responsive breakpoints */
@media (min-width: 480px) {
  /* Mobile landscape */
}

@media (min-width: 768px) {
  /* Tablet */
}

@media (min-width: 1024px) {
  /* Desktop */
}
```

---

## Elements Requiring Updates

Based on the analysis, the following elements should be reviewed for consistency:

### High Priority

1. **CSS Variables Implementation**
   - **Issue:** Not all components use the central theme system
   - **Action:** Migrate hardcoded colors to `colors` from `src/styles/theme.ts`
   - **Files to check:** All `.css` files with hardcoded hex values

2. **Modal Standardization**
   - **Best Example:** `DiceResultModal.tsx`
   - **Action:** Update other modals to match animation and structure pattern
   - **Files:** `CardDetailsModal.tsx`, `EndGameModal.tsx`, etc.

3. **Button Consistency**
   - **Best Examples:** `ActionButton.css`, `NextStepButton.css`
   - **Action:** Ensure all buttons use consistent hover states (translateY, box-shadow)
   - **Check:** Custom inline buttons in modals and forms

### Medium Priority

4. **Spacing Standardization**
   - **Issue:** Mix of px values and rem values
   - **Action:** Standardize on px for consistency (current pattern)
   - **Alternative:** Migrate to rem for better scaling

5. **Border Radius Consistency**
   - **Current:** Mix of 4px, 6px, 8px, 12px, 16px
   - **Action:** Consolidate to: 4px (small), 8px (medium), 16px (large)
   - **Files:** All CSS files

6. **Typography Scale**
   - **Issue:** Font sizes use mix of px and rem
   - **Action:** Choose one unit system and apply consistently
   - **Recommendation:** Keep px for precision, or use rem for accessibility

### Low Priority

7. **Animation Timing**
   - **Current:** Mix of 0.2s, 0.3s, 0.6s, 0.8s
   - **Action:** Document as standard timing scale
   - **OK as-is:** Current variety is intentional and appropriate

8. **Shadow Standardization**
   - **Current:** Various shadow values throughout
   - **Action:** Use theme.shadows (sm, md, lg) consistently
   - **Files:** Review all components with box-shadow

---

## Quick Reference

### Most Common Patterns

```css
/* Standard Button */
padding: 10px 16px;
border-radius: 6px;
font-size: 0.9rem;
font-weight: bold;
transition: all 0.2s ease;

/* Standard Modal */
border-radius: 16px;
max-width: 500px;
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

/* Standard Section */
padding: 6px 12px;
background: #f8f9fa;
border-radius: 4px;

/* Standard Stat */
font-size: 14px;
font-weight: 500;
color: #666;
```

### Color Quick Picks

```typescript
// Most used colors (in order)
colors.secondary.bg        // #f8f9fa - Section backgrounds
colors.secondary.border    // #dee2e6 - Borders
colors.success.main        // #28a745 - Primary actions
colors.primary.main        // #007bff - Links, active states
colors.secondary.main      // #6c757d - Muted elements
```

---

## Best Practices Summary

### DO

✓ Import colors from `src/styles/theme.ts`
✓ Use semantic color names (primary, success, danger)
✓ Include hover states with translateY and box-shadow
✓ Use 0.2s transition for most interactions
✓ Use 44px minimum height for touch targets
✓ Include keyboard handlers for modals
✓ Use consistent border-radius (6px buttons, 8px cards, 16px modals)
✓ Include loading states for async actions
✓ Use flex layouts with appropriate gaps
✓ Test color contrast for accessibility

### DON'T

✗ Don't hardcode color values in components
✗ Don't skip disabled states on buttons
✗ Don't use buttons smaller than 44px on mobile
✗ Don't mix units (choose px OR rem and stick with it)
✗ Don't skip transitions
✗ Don't forget focus states
✗ Don't use more than 3 colors per component
✗ Don't create custom colors outside the palette
✗ Don't skip responsive breakpoints
✗ Don't ignore semantic HTML (use button for buttons, etc.)

---

## Maintenance

This style guide should be updated when:
- New component patterns are established
- Color palette is extended
- New spacing or typography scales are added
- Significant UI refactoring occurs

**Maintainer:** Development Team
**Review Cycle:** Quarterly
**Last Review:** November 2025

---

## Related Documentation

- [Game Actions Guide](./GAME_ACTIONS_GUIDE.md)
- [Changelog](./CHANGELOG.md)
- Theme System: `src/styles/theme.ts`
- Component Library: `src/components/`

---

*This style guide is a living document. When in doubt, refer to the best examples identified: DiceResultModal, ActionButton, ExpandableSection, and PlayerPanel.*
