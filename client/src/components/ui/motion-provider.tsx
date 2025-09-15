import { createContext, useContext, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface MotionContextType {
  reducedMotion: boolean;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const MotionContext = createContext<MotionContextType | undefined>(undefined);

export function useMotion() {
  const context = useContext(MotionContext);
  if (!context) {
    throw new Error('useMotion must be used within a MotionProvider');
  }
  return context;
}

interface MotionProviderProps {
  children: React.ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <MotionContext.Provider value={{ reducedMotion, isLoading, setIsLoading }}>
      <div className="relative">
        {/* Global loading progress bar */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { scaleX: 0, opacity: 0 }}
              animate={reducedMotion ? { opacity: 1 } : { scaleX: 1, opacity: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
              transition={reducedMotion ? { duration: 0.1 } : { duration: 0.3 }}
              className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary z-50 origin-left"
              style={{
                background: 'linear-gradient(90deg, hsl(210, 75%, 25%) 0%, hsl(210, 60%, 55%) 50%, hsl(210, 75%, 25%) 100%)',
                transform: reducedMotion ? 'scaleX(1)' : undefined
              }}
            >
              {!reducedMotion && (
                <motion.div
                  className="h-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </div>
    </MotionContext.Provider>
  );
}