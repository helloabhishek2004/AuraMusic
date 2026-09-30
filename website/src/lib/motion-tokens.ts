/**
 * AuraMusic Central Motion System — Inspired by Apple / iOS Interaction Physics
 * Calibrated for tactile, weighted, responsive physical feel.
 */

export const MOTION = {
  // Apple Signature Easing Curves
  ease: {
    // Smooth deceleration used across iOS navigation and views
    appleStandard: [0.16, 1, 0.3, 1] as const,
    // Immediate physical tactile feedback for touches and presses
    appleTactile: [0.2, 0.8, 0.2, 1] as const,
    // Gentle floating / environmental motion
    ambient: [0.4, 0, 0.2, 1] as const,
    // Emphasized entry for key visual elements
    emphasized: [0.05, 0.9, 0.15, 1] as const,
  },

  // Spring Physics Configurations
  spring: {
    // Crisp, immediate response for buttons and controls
    tactile: {
      type: 'spring',
      stiffness: 460,
      damping: 32,
      mass: 0.8,
    } as const,
    // Smooth pill / slider motion (e.g. tabs switcher)
    pill: {
      type: 'spring',
      stiffness: 420,
      damping: 30,
    } as const,
    // Subtle float / hover response
    surface: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
    } as const,
  },

  // Standard Timing Durations (seconds)
  duration: {
    instant: 0.12,
    fast: 0.2,
    base: 0.35,
    smooth: 0.5,
    deliberate: 0.75,
  },
};

// Reusable Framer Motion Variants for Staggered Hierarchy Entrances
export const staggerContainer = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const staggerContainerPreset = staggerContainer();

export const itemFadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.ease.appleStandard,
    },
  },
};

export const fadeUpItem = itemFadeUp;

export const itemScaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: MOTION.duration.base,
      ease: MOTION.ease.appleStandard,
    },
  },
};
