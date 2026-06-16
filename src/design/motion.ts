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
  MEDIUM: 280,
  SLOW: 420,
  ENTRANCE: 500,
  ATMOSPHERIC: 800,
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
    damping: 32,
    stiffness: 200,
    mass: 1,
  },
  // Tactile buttons
  TAPPING: {
    damping: 12,
    stiffness: 300,
    mass: 0.5,
  }
};

export const MotionEasing = {
  // Perceptually linear start with smooth deceleration
  STANDARD: Easing.bezier(0.2, 0, 0, 1),
  // Aggressive acceleration
  ACCELERATE: Easing.bezier(0.3, 0, 0.8, 0.15),
  // Gentle deceleration
  DECELERATE: Easing.bezier(0.1, 0.9, 0.2, 1),
  // Apple Music-style smooth curve
  CINEMATIC: Easing.bezier(0.25, 0.1, 0.25, 1),
};
