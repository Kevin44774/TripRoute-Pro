import { Variants } from 'framer-motion';

// Animation variants/presets
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.4, ease: 'easeOut' }
  },
  
  slideIn: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  
  scaleHover: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { duration: 0.15, ease: 'easeInOut' }
  },
  
  collapseY: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
    transition: { duration: 0.3, ease: 'easeInOut' }
  },
  
  staggerChildren: {
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  }
} as const;

// Stagger animation for lists
export const staggerVariants: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

// Utility to get motion props based on reduced motion preference
export const getMotionProps = (preset: keyof typeof motionPresets, reducedMotion?: boolean) => {
  if (reducedMotion) {
    return {};
  }
  return motionPresets[preset];
};

// Enhanced utility that provides reduced motion alternatives
export const getAccessibleMotionProps = (preset: keyof typeof motionPresets, reducedMotion?: boolean) => {
  if (reducedMotion) {
    // Return static versions for accessibility
    switch (preset) {
      case 'fadeIn':
      case 'fadeUp':
      case 'slideIn':
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.1 }
        };
      case 'collapseY':
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.1 }
        };
      case 'scaleHover':
        return {
          transition: { duration: 0.1 }
        };
      default:
        return {};
    }
  }
  return motionPresets[preset];
};

// Create reduced motion variants for stagger animations
export const getAccessibleStaggerVariants = (reducedMotion?: boolean): Variants => {
  if (reducedMotion) {
    return {
      animate: { transition: { staggerChildren: 0.05, delayChildren: 0 } }
    };
  }
  return staggerVariants;
};

export const getAccessibleStaggerItemVariants = (reducedMotion?: boolean): Variants => {
  if (reducedMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1, transition: { duration: 0.1 } }
    };
  }
  return staggerItemVariants;
};

// Easing curves
export const easings = {
  smooth: [0.25, 0.1, 0.25, 1],
  snappy: [0.4, 0, 0.2, 1],
  bounce: [0.68, -0.55, 0.265, 1.55]
} as const;

// Duration presets
export const durations = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5
} as const;