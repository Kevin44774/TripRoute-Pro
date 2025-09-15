import React, { useState } from 'react';
import { AlertTriangle, Clock, Fuel, CheckCircle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Violation } from '../types/trucking';
import { motion, AnimatePresence } from 'framer-motion';
import { getAccessibleMotionProps } from '@/lib/motion';
import { useMotion } from '@/components/ui/motion-provider';

interface ComplianceAlertsProps {
  violations: Violation[];
  onResolveViolation?: (violationId: string) => void;
  isLoading?: boolean;
}

const ComplianceAlerts: React.FC<ComplianceAlertsProps> = ({
  violations,
  onResolveViolation,
  isLoading = false
}) => {
  const [resolvingAlerts, setResolvingAlerts] = useState<Set<string>>(new Set());
  const { reducedMotion } = useMotion();
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'break_required':
        return Clock;
      case 'fuel_recommended':
        return Fuel;
      default:
        return AlertTriangle;
    }
  };

  const getAlertColorClasses = (severity: string) => {
    switch (severity) {
      case 'violation':
        return {
          text: 'text-destructive',
          icon: 'text-destructive'
        };
      case 'warning':
        return {
          text: 'text-accent',
          icon: 'text-accent'
        };
      default:
        return {
          text: 'text-muted-foreground',
          icon: 'text-muted-foreground'
        };
    }
  };

  const getAlertBg = (severity: string) => {
    switch (severity) {
      case 'violation':
        return 'bg-destructive/10 border-destructive/20';
      case 'warning':
        return 'bg-accent/10 border-accent/20';
      default:
        return 'bg-muted border-border';
    }
  };

  const activeViolations = violations.filter(v => !v.resolved);

  // Add some sample alerts for demonstration
  const demoAlerts = [
    {
      id: 'break-required',
      type: 'break_required',
      severity: 'violation' as const,
      description: '30-Minute Break Required',
      details: 'You must take a 30-minute break before continuing to drive. Current continuous driving time: 8 hours.',
      icon: Clock
    },
    {
      id: 'fuel-recommended',
      type: 'fuel_recommended', 
      severity: 'warning' as const,
      description: 'Fuel Stop Recommended',
      details: 'Based on your route, fuel stop recommended at mile 487. Current fuel level estimated at 1/4 tank.',
      icon: Fuel
    }
  ];

  const allAlerts = [
    ...activeViolations.map(v => ({
      id: v.id,
      type: v.violationType,
      severity: v.severity,
      description: v.violationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      details: v.description,
      icon: getAlertIcon(v.violationType)
    })),
    ...(activeViolations.length === 0 ? demoAlerts : [])
  ];

  const handleResolve = async (alertId: string) => {
    setResolvingAlerts(prev => new Set([...Array.from(prev), alertId]));
    
    // Simulate async operation
    setTimeout(() => {
      onResolveViolation?.(alertId);
      setResolvingAlerts(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(alertId);
        return newSet;
      });
    }, 500);
  };

  return (
    <motion.div {...getAccessibleMotionProps('fadeUp', reducedMotion)}>
      <Card className="p-6" aria-live="polite" aria-label="Compliance alerts and violations">
        <motion.div 
          className="flex items-center space-x-2 mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            whileHover={reducedMotion ? {} : { rotate: 360 }}
            transition={{ duration: reducedMotion ? 0.1 : 0.6, ease: 'easeInOut' }}
          >
            <AlertTriangle className="text-accent" />
          </motion.div>
          <h2 className="text-xl font-semibold">Compliance & Alerts</h2>
        </motion.div>

        <motion.div 
          className="space-y-3"
          {...getAccessibleMotionProps('staggerChildren', reducedMotion)}
        >
          <AnimatePresence mode="wait">
            {allAlerts.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md"
              >
                <CheckCircle className="text-green-600 dark:text-green-400 mt-1 h-5 w-5" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-300">HOS Compliant</p>
                  <p className="text-sm text-green-600 dark:text-green-400">Your current schedule meets all Federal Hours of Service requirements.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {allAlerts.map((alert, index) => {
              const IconComponent = alert.icon;
              const colorClasses = getAlertColorClasses(alert.severity);
              const bgClass = getAlertBg(alert.severity);
              const isResolving = resolvingAlerts.has(alert.id);

              return (
                <motion.div
                  key={alert.id}
                  layout
                  {...getAccessibleMotionProps('fadeUp', reducedMotion)}
                  transition={{ delay: reducedMotion ? 0 : index * 0.1 }}
                  exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.95, height: 0 }}
                  whileHover={reducedMotion ? {} : { scale: 1.02 }}
                  className={`flex items-start justify-between p-3 ${bgClass} border rounded-md`}
                  data-testid={`alert-${alert.type}`}
                  aria-busy={isResolving}
                  role="alert"
                  aria-label={`${alert.severity} level alert: ${alert.description}`}
                >
                  <div className="flex items-start space-x-3 flex-1">
                    <motion.div
                      animate={isResolving && !reducedMotion ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.5, repeat: isResolving && !reducedMotion ? Infinity : 0 }}
                      aria-hidden="true"
                    >
                      <IconComponent className={`${colorClasses.icon} mt-1 h-5 w-5`} />
                    </motion.div>
                    <div className="flex-1">
                      <p className={`font-medium ${colorClasses.text}`}>{alert.description}</p>
                      <p className="text-sm text-muted-foreground mt-1">{alert.details}</p>
                    </div>
                  </div>
                  
                  {activeViolations.some(v => v.id === alert.id) && (
                    <motion.div
                      whileHover={reducedMotion ? {} : { scale: 1.1 }}
                      whileTap={reducedMotion ? {} : { scale: 0.9 }}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResolve(alert.id)}
                        disabled={isResolving}
                        className="ml-2"
                        data-testid={`button-resolve-${alert.id}`}
                        aria-label={`Resolve ${alert.description} alert`}
                        aria-busy={isResolving}
                      >
                        <motion.div
                          animate={isResolving && !reducedMotion ? { rotate: 360 } : {}}
                          transition={{ duration: 0.5, repeat: isResolving && !reducedMotion ? Infinity : 0, ease: 'linear' }}
                          aria-hidden="true"
                        >
                          <X className="h-4 w-4" />
                        </motion.div>
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </Card>
    </motion.div>
  );
};

export default ComplianceAlerts;
