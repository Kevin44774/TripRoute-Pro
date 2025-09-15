import React from 'react';
import { Clock, Construction, ChartPie, Pause } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HOSStatus } from '../types/trucking';
import { motion } from 'framer-motion';
import { getAccessibleMotionProps } from '@/lib/motion';
import { useMotion } from '@/components/ui/motion-provider';

interface HOSStatusDashboardProps {
  hosStatus: HOSStatus;
  isLoading?: boolean;
}

const HOSStatusDashboard: React.FC<HOSStatusDashboardProps> = ({ hosStatus, isLoading = false }) => {
  const { reducedMotion } = useMotion();
  const statusCards = [
    {
      title: "Drive Time Left",
      value: hosStatus.driveTimeLeft,
      icon: Construction,
      colorClass: "text-primary",
      testId: "drive-time-left"
    },
    {
      title: "On-Duty Left", 
      value: hosStatus.onDutyLeft,
      icon: Clock,
      colorClass: "text-secondary",
      testId: "on-duty-left"
    },
    {
      title: "Cycle Hours Used",
      value: hosStatus.cycleUsed,
      icon: ChartPie,
      colorClass: "text-accent",
      testId: "cycle-used"
    },
    {
      title: "Next Break",
      value: hosStatus.nextBreak,
      icon: Pause,
      colorClass: "text-destructive",
      testId: "next-break"
    }
  ];

  // Skeleton loading component
  const SkeletonCard = () => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
    </Card>
  );

  if (isLoading) {
    return (
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
        {...getAccessibleMotionProps('staggerChildren', reducedMotion)}
        aria-busy="true"
        aria-label="Loading HOS status dashboard"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <motion.div
            key={index}
            {...getAccessibleMotionProps('fadeUp', reducedMotion)}
            transition={{ delay: reducedMotion ? 0 : index * 0.1 }}
          >
            <SkeletonCard />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      {...getAccessibleMotionProps('staggerChildren', reducedMotion)}
      aria-label="HOS status dashboard"
    >
      {statusCards.map((card, index) => (
        <motion.div
          key={index}
          {...getAccessibleMotionProps('fadeUp', reducedMotion)}
          transition={{ delay: reducedMotion ? 0 : index * 0.1 }}
          whileHover={reducedMotion ? {} : { y: -2, scale: 1.02 }}
          whileTap={reducedMotion ? {} : { scale: 0.98 }}
        >
          <Card className="p-4 cursor-pointer transition-shadow hover:shadow-md" role="region" aria-label={`${card.title}: ${card.value}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <motion.p 
                  className={`text-2xl font-bold ${card.colorClass}`}
                  data-testid={`text-${card.testId}`}
                  initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: reducedMotion ? 0 : index * 0.1 + 0.2, duration: reducedMotion ? 0.1 : 0.3 }}
                >
                  {card.value}
                </motion.p>
              </div>
              <motion.div
                whileHover={reducedMotion ? {} : { rotate: 360 }}
                transition={{ duration: reducedMotion ? 0.1 : 0.6, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <card.icon className={`${card.colorClass} text-xl`} />
              </motion.div>
            </div>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
};

export default HOSStatusDashboard;
