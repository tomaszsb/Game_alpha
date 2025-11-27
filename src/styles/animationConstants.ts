// Central Animation System for Code2027
// Single source of truth for all animation timings, easing, and durations

/**
 * Animation Duration Constants
 * Consistent timing values for all animations across the application
 */
export const duration = {
  // Instant (no animation)
  instant: '0ms',

  // Fast interactions (buttons, hover effects)
  fast: '150ms',

  // Normal interactions (default for most UI)
  normal: '200ms',

  // Moderate transitions (expandable sections, tooltips)
  moderate: '300ms',

  // Slow transitions (modals, page transitions)
  slow: '400ms',

  // Very slow (complex animations, entrance effects)
  verySlow: '500ms',

  // Loading states
  loading: '800ms',
} as const;

/**
 * Animation Easing Functions
 * Consistent easing curves for natural motion
 */
export const easing = {
  // Default easing - use for most interactions
  default: 'ease',

  // Ease in - accelerating from zero velocity
  easeIn: 'ease-in',

  // Ease out - decelerating to zero velocity (best for entrance)
  easeOut: 'ease-out',

  // Ease in-out - acceleration and deceleration (best for exit)
  easeInOut: 'ease-in-out',

  // Linear - constant speed
  linear: 'linear',

  // Custom cubic-bezier curves
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',           // Material Design standard
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',            // Material Design sharp
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',      // Bounce effect (overshoots)
  elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Elastic effect
} as const;

/**
 * Animation Delays
 * Standard delays for staggered animations
 */
export const delay = {
  none: '0ms',
  short: '50ms',
  medium: '100ms',
  long: '150ms',
  veryLong: '200ms',
} as const;

/**
 * Common Transition Presets
 * Pre-configured transitions for common use cases
 */
export const transitions = {
  // Button interactions
  button: `all ${duration.normal} ${easing.default}`,
  buttonFast: `all ${duration.fast} ${easing.default}`,

  // Background color changes
  background: `background-color ${duration.normal} ${easing.default}`,

  // Color transitions
  color: `color ${duration.normal} ${easing.default}`,

  // Border transitions
  border: `border ${duration.normal} ${easing.default}`,

  // Opacity fades
  fade: `opacity ${duration.moderate} ${easing.easeInOut}`,
  fadeFast: `opacity ${duration.normal} ${easing.easeInOut}`,

  // Transform (scale, translate, rotate)
  transform: `transform ${duration.moderate} ${easing.smooth}`,
  transformFast: `transform ${duration.normal} ${easing.smooth}`,

  // Height changes (expandable sections)
  height: `max-height ${duration.moderate} ${easing.default}`,

  // Modal transitions
  modal: `opacity ${duration.moderate} ${easing.easeInOut}, transform ${duration.moderate} ${easing.smooth}`,

  // Smooth all properties
  all: `all ${duration.normal} ${easing.default}`,
  allFast: `all ${duration.fast} ${easing.default}`,
  allModerate: `all ${duration.moderate} ${easing.default}`,
  allSmooth: `all ${duration.moderate} ${easing.smooth}`,
} as const;

/**
 * Transform Values
 * Standard transform values for consistent animations
 */
export const transforms = {
  // Scale
  scaleUp: 'scale(1.05)',
  scaleUpLarge: 'scale(1.1)',
  scaleDown: 'scale(0.95)',
  scaleDownLarge: 'scale(0.9)',

  // Translate
  translateUp: 'translateY(-2px)',
  translateUpLarge: 'translateY(-4px)',
  translateDown: 'translateY(2px)',

  // Rotate
  rotate90: 'rotate(90deg)',
  rotate180: 'rotate(180deg)',
  rotate360: 'rotate(360deg)',

  // Combined
  hoverElevate: 'translateY(-1px)',
  hoverElevateLarge: 'translateY(-2px)',
  hoverScale: 'scale(1.02)',
  hoverScaleLarge: 'scale(1.05)',
} as const;

/**
 * Animation Names
 * Standard names for keyframe animations defined in animations.css
 */
export const animationNames = {
  // Entrance animations
  fadeIn: 'fadeIn',
  fadeInUp: 'fadeInUp',
  fadeInDown: 'fadeInDown',
  slideIn: 'slideIn',
  slideInFromLeft: 'slideInFromLeft',
  slideInFromRight: 'slideInFromRight',
  bounceIn: 'bounceIn',
  scaleIn: 'scaleIn',

  // Exit animations
  fadeOut: 'fadeOut',
  fadeOutDown: 'fadeOutDown',
  slideOut: 'slideOut',

  // Loading animations
  spin: 'spin',
  pulse: 'pulse',
  shimmer: 'shimmer',

  // Game-specific animations
  playerTokenAppear: 'playerTokenAppear',
  playerTokenPulse: 'playerTokenPulse',

  // Attention seekers
  shake: 'shake',
  bounce: 'bounce',
} as const;

/**
 * Complete Animation Strings
 * Ready-to-use animation declarations
 */
export const animations = {
  // Entrance
  fadeIn: `${animationNames.fadeIn} ${duration.moderate} ${easing.easeInOut}`,
  fadeInFast: `${animationNames.fadeIn} ${duration.normal} ${easing.easeInOut}`,
  fadeInUp: `${animationNames.fadeInUp} ${duration.moderate} ${easing.easeOut}`,
  slideIn: `${animationNames.slideIn} ${duration.moderate} ${easing.smooth}`,
  slideInFromLeft: `${animationNames.slideInFromLeft} ${duration.slow} ${easing.easeOut}`,
  bounceIn: `${animationNames.bounceIn} ${duration.verySlow} ${easing.bounce}`,

  // Loading
  spin: `${animationNames.spin} ${duration.loading} ${easing.linear} infinite`,
  pulse: `${animationNames.pulse} 2s ${easing.easeInOut} infinite`,
  shimmer: `${animationNames.shimmer} 2s ${easing.linear} infinite`,

  // Game specific
  playerTokenAppear: `${animationNames.playerTokenAppear} ${duration.slow} ${easing.easeOut}`,
  playerTokenPulse: `${animationNames.playerTokenPulse} 2s ${easing.easeInOut} infinite`,

  // Attention
  shake: `${animationNames.shake} ${duration.slow} ${easing.default}`,
  bounce: `${animationNames.bounce} ${duration.slow} ${easing.default}`,
} as const;

/**
 * Hover State Effects
 * Common hover effect configurations
 */
export const hoverEffects = {
  // Elevation (shadow + translate)
  elevate: {
    transform: transforms.hoverElevate,
    transition: transitions.transformFast,
  },

  // Scale up
  scale: {
    transform: transforms.hoverScale,
    transition: transitions.transformFast,
  },

  // Opacity change
  fade: {
    opacity: '0.8',
    transition: transitions.fadeFast,
  },

  // Background change
  background: {
    transition: transitions.background,
  },

  // Combined elevation and shadow
  elevateWithShadow: {
    transform: transforms.hoverElevate,
    transition: `${transitions.transformFast}, box-shadow ${duration.normal} ${easing.default}`,
  },
} as const;

/**
 * Loading State Configurations
 */
export const loadingStates = {
  spinner: {
    animation: animations.spin,
    display: 'inline-block',
  },

  pulse: {
    animation: animations.pulse,
  },

  shimmer: {
    animation: animations.shimmer,
  },
} as const;

/**
 * Animation Theme Object
 * Complete animation system export
 */
export const animationTheme = {
  duration,
  easing,
  delay,
  transitions,
  transforms,
  animationNames,
  animations,
  hoverEffects,
  loadingStates,
} as const;

// Export type for TypeScript support
export type AnimationTheme = typeof animationTheme;
export type Duration = typeof duration;
export type Easing = typeof easing;
export type Transitions = typeof transitions;

// Default export
export default animationTheme;
