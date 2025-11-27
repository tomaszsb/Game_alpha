# UI Standardization Action Plan

**Based on:** [UI Style Guide](./UI_STYLE_GUIDE.md)
**Created:** November 2025
**Status:** Ready for Implementation

---

## Overview

This document provides a prioritized list of specific files and changes needed to align the codebase with the UI Style Guide standards.

---

## Phase 1: Critical Standardization (High Priority)

### 1.1 Migrate Hardcoded Colors to Theme System

**Goal:** Eliminate hardcoded hex values in favor of centralized theme colors.

#### Files with Hardcoded Colors:

**ExpandableSection.css** (`src/components/player/ExpandableSection.css`)
```css
/* CURRENT */
.section-icon {
  color: var(--text-color, #333);  /* Hardcoded fallback */
}

/* SHOULD BE */
.section-icon {
  color: var(--text-color, #212529);  /* Use theme.colors.text.primary */
}
```

**Action Items:**
- [ ] Line 54: Update `#333` → `#212529` (colors.text.primary)
- [ ] Line 60: Update `#333` → `#212529` (colors.text.primary)
- [ ] Line 72: Update `#666` → `#6c757d` (colors.text.secondary)
- [ ] Line 86: Update `#dc3545` → verified against colors.danger.main
- [ ] Line 90: Update `#666` → `#6c757d` (colors.text.secondary)

---

**PlayerPanel.css** (`src/components/player/PlayerPanel.css`)
```css
/* CURRENT */
.player-name {
  color: #1976d2;  /* Should reference theme */
}

/* SHOULD BE - Document as standard or update */
/* This IS from theme (colors.primary.text), but should verify usage */
```

**Action Items:**
- [ ] Line 18: Verify gradient colors align with theme
- [ ] Line 40: `#1976d2` - Already correct (colors.primary.text) ✓
- [ ] Line 48: `#5c6bc0` - Not in theme palette, consider replacing
- [ ] Line 77: `#856404` - Already correct (colors.warning.text) ✓
- [ ] Line 109: `#000` for warning button text - Consider using theme color

**Recommendation:** Create CSS variable for player header gradient:
```css
:root {
  --player-header-gradient-start: #e3f2fd;
  --player-header-gradient-end: #bbdefb;
  --player-header-border: #2196f3;
}
```

---

**CardsSection.css** (`src/components/player/sections/CardsSection.css`)
```css
/* CURRENT - Multiple hardcoded grays */
.card-type-header {
  color: #2c3e50;  /* Not in theme */
}
```

**Action Items:**
- [ ] Line 85: `#2c3e50` → Replace with `colors.text.dark` (#2d3748) or similar
- [ ] Line 91: `#1a252f` → Choose closest theme color
- [ ] Line 102: `#7f8c8d` → Replace with theme gray
- [ ] Line 132: `#7f8c8d` → Replace with theme gray
- [ ] Line 136: `#5a6c7d` → Replace with theme gray
- [ ] Line 148: `#95a5a6` → Replace with theme gray
- [ ] Line 169: `#95a5a6` → Replace with theme gray
- [ ] Line 175: `#7f8c8d` → Replace with theme gray
- [ ] Line 182: `#6c757d` → Already correct (colors.secondary.main) ✓
- [ ] Line 185: `#f8f9fa` → Already correct (colors.secondary.bg) ✓

**Recommendation:** These grays (#2c3e50, #7f8c8d, #95a5a6, #5a6c7d) should be mapped to:
- `#2c3e50` → `colors.text.dark` (#2d3748)
- `#7f8c8d` → `colors.secondary.main` (#6c757d) or `colors.text.muted` (#6b7280)
- `#95a5a6` → `colors.text.light` (#9ca3af)
- `#5a6c7d` → `colors.text.slate[600]` (#475569)

---

**FinancesSection.css** (`src/components/player/sections/FinancesSection.css`)

**Action Items:**
- [ ] Line 36: `#27ae60` → Not in theme, should map to `colors.success.main` (#28a745)
- [ ] Line 58: `#2c3e50` → Map to `colors.text.dark` (#2d3748)
- [ ] Line 62: `#1a252f` → Choose closest theme color
- [ ] Line 73: `#7f8c8d` → Map to theme gray
- [ ] Line 82: `#27ae60` → Use `colors.success.main` (#28a745)
- [ ] Line 93: `#7f8c8d` → Map to theme gray
- [ ] Line 101: `#ecf0f1` → Map to `colors.secondary.light` (#e9ecef)
- [ ] Line 112: `#2c3e50` → Map to `colors.text.dark` (#2d3748)
- [ ] Line 154: `#27ae60` → Use `colors.success.main` (#28a745)
- [ ] Line 208: `#2c3e50` → Map to `colors.text.dark` (#2d3748)
- [ ] Line 224: `#7f8c8d` → Map to theme gray
- [ ] Line 233: `#e74c3c` → Map to `colors.danger.main` (#dc3545) or keep?
- [ ] Line 239: `#e9ecef` → Already correct (colors.secondary.light) ✓
- [ ] Line 258: `#5f6368` → Map to theme gray
- [ ] Line 264: `#e74c3c` → Map to `colors.danger.main` (#dc3545)

**Recommendations:**
- `#27ae60` (green) appears 3 times - standardize to `colors.success.main` (#28a745)
- `#e74c3c` (red) appears 2 times - consider using `colors.danger.main` (#dc3545)
- These are close but not exact matches - document decision to keep or update

---

**CurrentCardSection.css** (`src/components/player/sections/CurrentCardSection.css`)

**Action:** Search for file and analyze

---

**TimeSection.css** (`src/components/player/sections/TimeSection.css`)

**Action:** Search for file and analyze

---

**ProjectScopeSection.css** (`src/components/player/sections/ProjectScopeSection.css`)

**Action:** Search for file and analyze

---

### 1.2 Standardize Modal Animations and Structure

**Goal:** Align all modals with the DiceResultModal pattern (best example).

#### Reference Pattern (DiceResultModal.tsx):

```tsx
// Animations
animation: 'fadeIn 0.2s ease-out'  // Overlay
animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'  // Content

// Structure
backgroundColor: 'rgba(0, 0, 0, 0.7)'  // Dark overlay
borderRadius: '16px'  // Content
boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
maxWidth: '500px'
```

#### Modals to Review:

**CardDetailsModal.tsx** (`src/components/modals/CardDetailsModal.tsx`)
- [ ] Check overlay opacity and color
- [ ] Verify border radius (should be 16px)
- [ ] Add slideIn animation if missing
- [ ] Verify box-shadow matches standard
- [ ] Check button styles match style guide

**ChoiceModal.tsx** (`src/components/modals/ChoiceModal.tsx`)
- [x] Overlay: `rgba(0, 0, 0, 0.7)` ✓ Correct
- [ ] Content border-radius: Currently `12px`, should update to `16px`
- [ ] Add slideIn animation (currently no animation)
- [ ] Box-shadow: Currently `0 10px 30px`, should be `0 20px 60px`
- [ ] Border: Has `3px solid` border - evaluate if needed

**Specific Changes for ChoiceModal.tsx:**
```tsx
// Line 123-130: Update modal content styles
borderRadius: '16px',  // Change from 12px
boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',  // Enhance shadow
animation: 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',  // Add animation
```

**CardReplacementModal.tsx**
- [ ] Review and align with standard

**EndGameModal.tsx**
- [ ] Review and align with standard

**NegotiationModal.tsx**
- [ ] Review and align with standard

**RulesModal.tsx**
- [ ] Review and align with standard

**DiscardedCardsModal.tsx**
- [ ] Review and align with standard

---

### 1.3 Button Hover State Consistency

**Goal:** Ensure all buttons have consistent hover animations.

**Standard Pattern:**
```tsx
onMouseEnter: {
  transform: 'translateY(-1px)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  backgroundColor: darker
}
onMouseLeave: {
  transform: 'translateY(0)',
  boxShadow: 'none',
  backgroundColor: original
}
```

#### Files Using Inline Button Styles:

**DiceResultModal.tsx** (`src/components/modals/DiceResultModal.tsx`)
- [x] Line 373-374: Has opacity change (0.8), should add transform
- [x] Line 381-382: Has opacity change (0.8), should add transform

**Specific Changes:**
```tsx
// Line 373-374 & 381-382: Enhance hover
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = colors.primary.dark;
  e.currentTarget.style.transform = 'translateY(-1px)';
  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.backgroundColor = colors.primary.main;
  e.currentTarget.style.transform = 'translateY(0)';
  e.currentTarget.style.boxShadow = 'none';
}}
```

**ChoiceModal.tsx** (`src/components/modals/ChoiceModal.tsx`)
- [x] Line 170-178: Has translateY(-2px) and box-shadow ✓ Good!
- [ ] Consider reducing translateY to -1px for consistency

**CardDetailsModal.tsx**
- [ ] Review all inline buttons

**Other Modal Files**
- [ ] Review all inline buttons in modal files

---

## Phase 2: Medium Priority Improvements

### 2.1 Spacing Standardization

**Goal:** Ensure consistent use of 8px grid system.

**Current Issues:**
- Mix of padding values (4px, 6px, 8px, 10px, 12px, 16px, etc.)
- Some values don't align to 8px grid

**Action Items:**
- [ ] Audit all padding values in CSS files
- [ ] Round to nearest value in spacing scale (4, 8, 12, 16, 24, 32)
- [ ] Document exceptions (e.g., 6px is acceptable for compact UIs)

**Files to Review:**
- All `.css` files in `src/components/player/`
- All `.css` files in `src/components/player/sections/`

---

### 2.2 Border Radius Consolidation

**Goal:** Limit border-radius to 3 sizes: 4px, 8px, 16px.

**Current Border Radius Values Found:**
- 4px ✓ (small elements)
- 6px → Consider standardizing to 4px or 8px
- 8px ✓ (cards, buttons)
- 12px → Consider standardizing to 8px or 16px
- 16px ✓ (modals)

**Action Items:**
- [ ] Decide: Keep 6px for buttons or move to 8px?
- [ ] Decide: Keep 12px for certain modals or move to 16px?
- [ ] Update all instances to chosen values

**Recommendation:** Keep current variety BUT document as official scale:
- **4px:** Input fields, stat boxes, badges
- **6px:** Small buttons (ActionButton)
- **8px:** Standard buttons, cards
- **12px:** Medium containers
- **16px:** Large modals

---

### 2.3 Typography Unit Consistency

**Goal:** Choose px OR rem and use consistently.

**Current State:**
- Mix of px and rem throughout
- Most font-sizes use px or rem inconsistently

**Options:**

**Option A: Standardize on px**
- Pros: More precise control, matches current theme.ts
- Cons: Less responsive to user font-size preferences

**Option B: Convert to rem**
- Pros: More accessible, better for responsive design
- Cons: Requires conversion of all values

**Recommendation:** Standardize on **px** to match current patterns, with option to migrate to rem in future.

**Action Items:**
- [ ] Document px as the standard unit
- [ ] Convert rem values to px equivalent (1rem = 16px base)
- [ ] Update theme.ts if needed

---

### 2.4 Box Shadow Standardization

**Goal:** Use theme shadow values consistently.

**Current theme.ts shadows:**
```typescript
shadows: {
  sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 25px rgba(0, 0, 0, 0.15)',
}
```

**Additional shadows found in components:**
- `0 2px 8px rgba(0, 0, 0, 0.15)` (ActionButton hover)
- `0 20px 60px rgba(0, 0, 0, 0.3)` (DiceResultModal)
- `0 10px 30px rgba(0, 0, 0, 0.3)` (ChoiceModal)

**Action Items:**
- [ ] Extend theme.shadows to include all variants:
```typescript
shadows: {
  sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 25px rgba(0, 0, 0, 0.15)',
  xl: '0 20px 60px rgba(0, 0, 0, 0.3)',  // Add for modals
  button: '0 2px 8px rgba(0, 0, 0, 0.15)',  // Add for button hover
}
```
- [ ] Update all components to reference theme.shadows
- [ ] Remove hardcoded shadow values

---

## Phase 3: Low Priority Polish

### 3.1 Animation Timing Documentation

**Goal:** Document animation timing as official standards.

**Current timings found:**
- 0.2s - Most common (transitions)
- 0.3s - Expandable sections, modal slide-in
- 0.6s - Bounce animations
- 0.8s - Loading spinners

**Action:** These are appropriate, just document in theme.ts:
```typescript
animations: {
  fast: '0.2s',      // Standard transitions
  medium: '0.3s',    // Expand/collapse
  slow: '0.6s',      // Bounce effects
  spinner: '0.8s',   // Loading spinners
}
```

---

### 3.2 Responsive Breakpoints

**Goal:** Standardize breakpoints across the application.

**Current breakpoints found:**
```css
@media (min-width: 480px) { /* Mobile landscape */ }
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
```

**Action:**
- [ ] Add to theme.ts:
```typescript
breakpoints: {
  mobile: '480px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
}
```
- [ ] Consider CSS custom properties for breakpoints
- [ ] Audit all media queries for consistency

---

### 3.3 CSS Variables Implementation

**Goal:** Implement CSS variables globally for all theme colors.

**Current State:**
- Components use CSS variables with fallbacks
- No global CSS variable definitions

**Action:**
- [ ] Create global CSS file: `src/styles/variables.css`
```css
:root {
  /* Primary */
  --primary-color: #007bff;
  --primary-dark: #0056b3;
  --primary-light: #e3f2fd;
  --primary-text: #1976d2;

  /* Secondary */
  --secondary-color: #6c757d;
  --secondary-dark: #495057;
  --secondary-light: #e9ecef;
  --secondary-bg: #f8f9fa;
  --secondary-border: #dee2e6;

  /* Success */
  --success-color: #28a745;
  --success-dark: #218838;
  --success-light: #d4edda;

  /* Warning */
  --warning-color: #ffc107;
  --warning-dark: #e0a800;
  --warning-bg: #fff3cd;
  --warning-text: #856404;

  /* Danger */
  --danger-color: #dc3545;
  --danger-dark: #c53030;
  --danger-light: #ffebee;

  /* Text */
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #6b7280;

  /* Borders */
  --border-color: #dee2e6;
  --border-light: #e5e7eb;

  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --card-bg: #fff;
  --hover-bg: #f5f5f5;
}
```
- [ ] Import in main entry point
- [ ] Remove fallback values from components (keep them as backup)

---

## Implementation Priority Matrix

### Immediate (This Week)
1. ✅ Create UI Style Guide document
2. ✅ Create this Action Plan
3. Fix hardcoded colors in ExpandableSection.css
4. Fix hardcoded colors in PlayerPanel.css

### Short Term (Next 2 Weeks)
5. Fix hardcoded colors in CardsSection.css
6. Fix hardcoded colors in FinancesSection.css
7. Standardize modal animations (ChoiceModal first)
8. Add transform to button hovers in DiceResultModal

### Medium Term (Next Month)
9. Review and update all other modal components
10. Standardize border-radius values
11. Extend theme.shadows
12. Implement global CSS variables

### Long Term (Future Iterations)
13. Typography unit standardization decision
14. Spacing audit and alignment to 8px grid
15. Breakpoints standardization
16. Animation timing constants in theme

---

## Verification Checklist

After implementing changes, verify:

### Colors
- [ ] No hardcoded hex values in CSS files (except comments)
- [ ] All colors reference theme.ts or CSS variables
- [ ] Color contrast meets WCAG AA standards

### Buttons
- [ ] All buttons have hover states with transform
- [ ] All buttons have focus states
- [ ] All buttons have disabled states
- [ ] Min-height 44px on touch interfaces

### Modals
- [ ] Consistent overlay (rgba(0, 0, 0, 0.7))
- [ ] Consistent border-radius (16px)
- [ ] slideIn animation present
- [ ] Box-shadow matches standard
- [ ] Keyboard handlers (Escape, Enter)

### Spacing
- [ ] Padding values align to 4/8/12/16/24/32 scale
- [ ] Gap values are consistent
- [ ] No odd values (e.g., 7px, 13px, etc.)

### Accessibility
- [ ] Focus states visible
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] Color contrast verified

---

## Notes for Developers

### When Creating New Components

1. **Always import theme:**
   ```tsx
   import { colors } from '../../styles/theme';
   ```

2. **Use semantic color names:**
   ```tsx
   backgroundColor: colors.primary.main  // Good
   backgroundColor: '#007bff'            // Bad
   ```

3. **Include standard transitions:**
   ```css
   transition: all 0.2s ease;
   ```

4. **Follow button pattern:**
   - Base styles + hover + active + focus + disabled
   - Include transform and box-shadow on hover

5. **Follow modal pattern:**
   - Reference DiceResultModal.tsx as template
   - Include animations
   - Handle keyboard events

### When Refactoring Existing Components

1. **Don't change behavior, only styling**
2. **Test thoroughly after changes**
3. **Update tests if needed**
4. **Document any deviations in this file**
5. **Cross-reference with UI_STYLE_GUIDE.md**

---

## Progress Tracking

| Phase | Task | Status | Notes |
|-------|------|--------|-------|
| 1.1 | ExpandableSection.css colors | 🔴 Not Started | 5 color updates |
| 1.1 | PlayerPanel.css colors | 🔴 Not Started | Review gradient |
| 1.1 | CardsSection.css colors | 🔴 Not Started | 15+ color updates |
| 1.1 | FinancesSection.css colors | 🔴 Not Started | 15+ color updates |
| 1.2 | ChoiceModal animation | 🔴 Not Started | Add slideIn |
| 1.2 | Other modals review | 🔴 Not Started | 5+ files |
| 1.3 | DiceResultModal hovers | 🔴 Not Started | Add transform |
| 2.1 | Spacing audit | 🔴 Not Started | All CSS files |
| 2.2 | Border radius decision | 🔴 Not Started | Document standard |
| 2.3 | Typography units | 🔴 Not Started | px vs rem decision |
| 2.4 | Shadow standardization | 🔴 Not Started | Extend theme |
| 3.1 | Animation timing docs | 🔴 Not Started | Add to theme |
| 3.2 | Breakpoints standard | 🔴 Not Started | Add to theme |
| 3.3 | Global CSS variables | 🔴 Not Started | Create file |

**Legend:**
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Completed
- ⚪ Blocked

---

## Questions for Team Discussion

1. **Border Radius:** Keep 6px for buttons or move to 4px/8px?
2. **Typography:** Standardize on px or migrate to rem?
3. **Colors:** Should we keep close-but-not-exact colors (like #27ae60 vs #28a745) or standardize?
4. **CSS Variables:** Implement globally now or wait?
5. **Breaking Changes:** Any concerns about visual changes from standardization?

---

## Related Documents

- [UI Style Guide](./UI_STYLE_GUIDE.md) - The reference standard
- [Changelog](./CHANGELOG.md) - Document UI changes here
- Theme System: `src/styles/theme.ts`

---

*This action plan should be updated as work progresses. Mark tasks as complete and add notes about decisions made.*
