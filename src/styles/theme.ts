// Central Theme System for Code2027
// Single source of truth for all color constants across the application

/**
 * Color Palette
 * Organized by semantic usage and Bootstrap-inspired naming
 */
export const colors = {
  // Primary Brand Colors
  primary: {
    main: '#007bff',        // Primary blue (Bootstrap primary)
    dark: '#0056b3',        // Darker primary blue
    light: '#e3f2fd',       // Light primary background
    lighter: '#f0f9ff',     // Lighter primary background
    bg: '#e3f2fd',          // Light primary background
    text: '#1976d2',        // Primary text color
  },

  // Secondary Colors
  secondary: {
    main: '#6c757d',        // Most used color - Bootstrap secondary gray
    dark: '#495057',        // Dark secondary
    darker: '#5a6268',      // Darker secondary (for hover states)
    light: '#e9ecef',       // Light secondary
    bg: '#f8f9fa',          // Secondary background (very common)
    border: '#dee2e6',      // Border color (very common)
  },

  // Success Colors (Green)
  success: {
    main: '#28a745',        // Second most used - Bootstrap success green
    dark: '#218838',        // Dark success
    darker: '#155724',      // Darker success text
    light: '#d4edda',       // Light success background
    bg: '#e8f5e8',          // Success background variant
    border: '#c3e6cb',      // Success border color
    text: '#2c5530',        // Success text color
  },

  // Warning Colors (Yellow/Orange)
  warning: {
    main: '#ffc107',        // Bootstrap warning yellow
    dark: '#e0a800',        // Dark warning
    text: '#856404',        // Warning text color
    bg: '#fff3cd',          // Warning background
    light: '#ffeaa7',       // Light warning variant
    border: '#ffd700',      // Warning border color
  },

  // Danger Colors (Red)
  danger: {
    main: '#dc3545',        // Bootstrap danger red
    dark: '#c53030',        // Dark danger
    darker: '#721c24',      // Darker danger text
    light: '#ffebee',       // Light danger background
    bg: '#f8d7da',          // Danger background variant
    border: '#ffcdd2',      // Danger border color
    text: '#c62828',        // Danger text color
  },

  // Info Colors (Cyan/Light Blue)
  info: {
    main: '#17a2b8',        // Bootstrap info cyan
    dark: '#0c5460',        // Dark info
    light: '#d1ecf1',       // Light info background
    bg: '#e8f4fd',          // Info background variant
  },

  // Purple Colors
  purple: {
    main: '#6f42c1',        // Purple main
    dark: '#5a359a',        // Dark purple
    darker: '#4c1d5b',      // Darker purple text
    light: '#f3e5f5',       // Light purple background
    lighter: '#f3f0ff',     // Very light purple background
  },

  // Brown Colors
  brown: {
    main: '#795548',        // Brown main
    dark: '#5d4037',        // Dark brown
    light: '#d7ccc8',       // Light brown background
    text: '#8d6e63',        // Brown text
  },

  // Basic Colors
  white: '#ffffff',       // White (commonly accessed directly)
  black: '#000000',       // Black (commonly accessed directly)

  // Neutral Colors
  neutral: {
    white: '#fff',          // Pure white (very common)
    black: '#333',          // Near black for text
    gray: {
      50: '#f8fafc',        // Lightest gray
      100: '#f1f5f9',       // Very light gray
      200: '#e2e8f0',       // Light gray
      300: '#cbd5e1',       // Medium light gray
      400: '#94a3b8',       // Medium gray
      500: '#64748b',       // Base gray
      600: '#475569',       // Dark gray
      700: '#334155',       // Darker gray
      800: '#1e293b',       // Very dark gray
      900: '#0f172a',       // Darkest gray
    },
  },

  // Background Colors
  background: {
    primary: '#ffffff',     // Primary background
    secondary: '#f8f9fa',   // Secondary background
    tertiary: '#e9ecef',    // Tertiary background
    dark: '#212529',        // Dark background
    light: '#f5f5f5',       // Light background variant
    paper: '#ffffff',       // Paper/card background
    muted: '#f1f3f4',       // Muted background
    hover: '#f8f9ff',       // Hover background
    focus: '#f0f8ff',       // Focus background
    gradient: '#f0f9ff',    // Gradient background
  },

  // Text Colors
  text: {
    primary: '#212529',     // Primary text
    secondary: '#6c757d',   // Secondary text
    muted: '#6b7280',       // Muted text
    light: '#9ca3af',       // Light text
    white: '#ffffff',       // White text
    dark: '#2d3748',        // Dark text
    darkSlate: '#1e293b',   // Dark slate text
    mediumGray: '#374151',  // Medium gray text
    lightGray: '#555',      // Light gray text
    slate: {
      500: '#64748b',       // Slate 500
      600: '#475569',       // Slate 600
      700: '#334155',       // Slate 700
      800: '#1e293b',       // Slate 800
    },
    success: '#2e7d32',     // Success text
    successDark: '#276749', // Dark success text
    info: '#0369a1',        // Info text
    danger: '#c53030',      // Danger text
  },

  // Border Colors
  border: {
    light: '#e5e7eb',       // Light border
    medium: '#d1d5db',      // Medium border
    dark: '#9ca3af',        // Dark border
    primary: '#dee2e6',     // Primary border (most common)
    slate: '#cbd5e1',       // Slate border color
  },

  // Special Purpose Colors
  special: {
    transparent: 'transparent',
    overlay: 'rgba(0, 0, 0, 0.5)',     // Dark overlay
    shadow: 'rgba(0, 0, 0, 0.1)',      // Box shadow
    focus: '#80bdff',                   // Focus ring color
    hover: 'rgba(0, 0, 0, 0.05)',      // Hover state
    hoverBlue: '#f8f9ff',               // Blue hover background
    // Card effect backgrounds
    cardEffects: {
      positive: '#f0fff4',              // Positive effect background
      negative: '#fff5f5',              // Negative effect background
      neutral: '#f0f9ff',               // Neutral effect background
    },
    // Button variations
    button: {
      primaryHover: '#218838',          // Primary button hover
      disabledBg: '#d1d5db',            // Disabled button background
      disabledText: '#9ca3af',          // Disabled button text
      activeBg: '#3b82f6',              // Active button background
      hoverBg: '#f3f4f6',               // Button hover background
    },
  },

  // Game-Specific Colors
  game: {
    // Card type colors
    cardW: '#6f42c1',       // W card color (purple)
    cardB: '#28a745',       // B card color (green) - reuse success
    cardE: '#dc3545',       // E card color (red) - reuse danger
    cardI: '#007bff',       // I card color (blue) - reuse primary
    cardL: '#ffc107',       // L card color (yellow) - reuse warning
    
    // Card background colors  
    cardBg: {
      W: '#f3e5f5',         // Purple card background
      B: '#e8f5e8',         // Green card background
      E: '#fff3e0',         // Orange card background
      L: '#fce4ec',         // Pink card background
      I: '#f3e5f5',         // Purple card background
    },
    
    // Space colors
    spaceDefault: '#e1e5e9', // Default space background
    spaceActive: '#e3f2fd',  // Active space background
    
    // Player colors (extended set)
    player1: '#007bff',     // Player 1 color (blue)
    player2: '#28a745',     // Player 2 color (green)
    player3: '#dc3545',     // Player 3 color (red)
    player4: '#ffc107',     // Player 4 color (yellow)
    player5: '#6f42c1',     // Player 5 color (purple)
    player6: '#e83e8c',     // Player 6 color (pink)
    player7: '#20c997',     // Player 7 color (teal)
    player8: '#fd7e14',     // Player 8 color (orange)
    
    // Extended UI colors for game components
    boardTitle: '#4285f4',  // Game board title color
    teal: '#20c997',        // Teal accent color
    pink: '#e83e8c',        // Pink accent color
    orange: '#fd7e14',      // Orange accent color
    lightBlue: '#7dd3fc',   // Light blue variant
    lightGreen: '#68d391',  // Light green variant
    lightRed: '#feb2b2',    // Light red variant
  },

  // Status Colors
  status: {
    online: '#10b981',      // Online/active status
    offline: '#6b7280',     // Offline/inactive status
    loading: '#3b82f6',     // Loading state
    error: '#ef4444',       // Error state
  },
};

/**
 * Semantic Color Mappings
 * Easy-to-use semantic names that map to the color palette
 */
export const semanticColors = {
  // Buttons
  buttonPrimary: colors.primary.main,
  buttonPrimaryHover: colors.primary.dark,
  buttonSecondary: colors.secondary.main,
  buttonSuccess: colors.success.main,
  buttonDanger: colors.danger.main,
  buttonWarning: colors.warning.main,
  
  // Backgrounds
  bgPrimary: colors.background.primary,
  bgSecondary: colors.background.secondary,
  bgMuted: colors.background.tertiary,
  
  // Text
  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  textMuted: colors.text.muted,
  
  // Borders
  borderDefault: colors.border.primary,
  borderLight: colors.border.light,
  borderMuted: colors.border.medium,
};

/**
 * Theme object for consistent styling
 */
export const theme = {
  colors,
  semanticColors,
  
  // Spacing - Consistent spacing scale
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },

  // Border radius - Consistent border radius scale
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '50%',
  },

  // Shadows - Consistent shadow scale
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
    md: '0 4px 8px rgba(0, 0, 0, 0.15)',
    lg: '0 10px 25px rgba(0, 0, 0, 0.25)',
    xl: '0 20px 60px rgba(0, 0, 0, 0.3)',
  },

  // Modal Layout - Consistent modal spacing and layout
  modal: {
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      padding: '20px',
      zIndex: 1000,
    },
    container: {
      maxWidth: '500px',
      maxHeight: '80vh',
      borderRadius: '16px',
    },
    header: {
      padding: '16px 20px',
      borderBottom: `2px solid ${colors.secondary.light}`,
    },
    body: {
      padding: '16px 20px',
    },
    footer: {
      padding: '16px 20px',
      gap: '12px',
    },
    animation: {
      duration: '0.3s',
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
  },

  // Button Layout - Consistent button spacing
  button: {
    padding: {
      sm: '8px 16px',
      md: '10px 20px',
      lg: '12px 24px',
    },
    borderRadius: '8px',
    gap: '12px',
    fontSize: {
      sm: '14px',
      md: '15px',
      lg: '16px',
    },
  },

  // Typography - Consistent text hierarchy
  typography: {
    heading: {
      h1: { fontSize: '28px', fontWeight: 'bold' },
      h2: { fontSize: '24px', fontWeight: 'bold' },
      h3: { fontSize: '18px', fontWeight: 'bold' },
      h4: { fontSize: '16px', fontWeight: 'bold' },
    },
    body: {
      large: '16px',
      normal: '15px',
      small: '14px',
      tiny: '13px',
    },
  },

  // Transitions - Consistent animation timings
  transitions: {
    fast: '0.15s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
    modal: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// Export individual color categories for convenience
export const {
  primary,
  secondary,
  success,
  warning,
  danger,
  info,
  neutral,
  background,
  text,
  border,
  special,
  game,
  status,
} = colors;

// Export type for TypeScript support
export type Theme = typeof theme;
export type Colors = typeof colors;