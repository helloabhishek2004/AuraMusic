import { Easing } from 'react-native-reanimated';

/**
 * AuraMusic Unified Motion System
 * 
 * Standardized timing and spring profiles to ensure perceptual consistency
 * across the entire application.
 */

export const MotionTiming = {
  INSTANT: 0,
  QUICK: 100,
  FAST: 140,
  STANDARD: 200,
  NAV_SLIDE: 250,
  MEDIUM: 280,
  SLOW: 420,
  ENTRANCE: 500,
  ATMOSPHERIC: 800,
  REDUCED: 140,
};

export const MotionSpring = {
  // Ultra-responsive, no bounce
  SNAPPY: {
    damping: 24,
    stiffness: 280,
    mass: 0.8,
  },
  // Default premium feel
  STANDARD: {
    damping: 20,
    stiffness: 180,
    mass: 1,
  },
  // Soft, smooth, cinematic
  SOFT: {
    damping: 28,
    stiffness: 120,
    mass: 1.2,
  },
  // Heavy modal or sheet transitions
  MODAL: {
    damping: 28,
    stiffness: 240,
    mass: 0.9,
  },
  // Tactile buttons
  TAPPING: {
    damping: 12,
    stiffness: 300,
    mass: 0.5,
  },
  // Expressive physical spring for Now Playing expansion
  PLAYER_EXPAND: {
    damping: 26,
    stiffness: 220,
    mass: 0.9,
  },
  // Responsive, physical spring for queue sheets & drawers
  QUEUE_SHEET: {
    damping: 24,
    stiffness: 220,
    mass: 0.85,
  },
  // Restrained popup dialog spring
  DIALOG: {
    damping: 28,
    stiffness: 260,
    mass: 0.9,
  },
  // Subtle non-bouncy settle
  SUBTLE: {
    damping: 28,
    stiffness: 180,
    mass: 1.0,
  },
};

export const MotionEasing = {
  // Perceptually linear start with smooth deceleration
  STANDARD: Easing.bezier(0.2, 0, 0, 1),
  // Aggressive acceleration
  ACCELERATE: Easing.bezier(0.3, 0, 0.8, 0.15),
  // Gentle, restrained Apple Music-style deceleration curve for page navigation
  DECELERATE: Easing.bezier(0.16, 1, 0.3, 1),
  // Apple Music-style smooth cinematic curve
  CINEMATIC: Easing.bezier(0.25, 0.1, 0.25, 1),
  // Smooth symmetric cubic
  SMOOTH: Easing.bezier(0.25, 0.1, 0.25, 1),
};

export const MotionPresets = {
  // Ordinary page navigation transition
  pageNavigation: {
    duration: MotionTiming.NAV_SLIDE,
    easing: MotionEasing.DECELERATE,
  },
  // Modal screen transition (create playlist, etc.)
  modalNavigation: {
    duration: MotionTiming.MEDIUM,
    easing: MotionEasing.DECELERATE,
  },
  // Now Playing expand spring
  nowPlaying: MotionSpring.PLAYER_EXPAND,
  // Queue sheet spring
  queueSheet: MotionSpring.QUEUE_SHEET,
  // Dialog modal spring
  dialog: MotionSpring.DIALOG,
  // Reduced motion fallback
  reducedMotion: {
    duration: MotionTiming.REDUCED,
    easing: Easing.linear,
  },
};

