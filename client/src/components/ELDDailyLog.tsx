import React, { useState } from 'react';
import { ClipboardList, Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ELDLogData } from '../types/trucking';
import { getStatusGradient, calculateDayTotals } from '../lib/hosUtils';
import { motion, AnimatePresence } from 'framer-motion';
import { getAccessibleMotionProps, getAccessibleStaggerVariants, getAccessibleStaggerItemVariants, motionPresets } from '@/lib/motion';
import { useMotion } from '@/components/ui/motion-provider';

interface ELDDailyLogProps {
  logs: ELDLogData[];
  driverName: string;
  currentLogIndex?: number;
  onExportPDF?: (logId: string) => void;
  onLogChange?: (index: number) => void;
}

const ELDDailyLog: React.FC<ELDDailyLogProps> = ({
  logs,
  driverName,
  currentLogIndex = 0,
  onExportPDF,
  onLogChange
}) => {
  const [selectedLogIndex, setSelectedLogIndex] = useState(currentLogIndex);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { reducedMotion } = useMotion();
  const currentLog = logs[selectedLogIndex];

  if (!currentLog) {
    return (
      <Card className="p-6">
        <motion.div 
          className="text-center"
          {...getAccessibleMotionProps('fadeUp', reducedMotion)}
        >
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6"
            {...getAccessibleMotionProps('scaleHover', reducedMotion)}
          >
            <Calendar className="w-10 h-10 text-muted-foreground" />
          </motion.div>
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: reducedMotion ? 0.1 : 0.4 }}
          >
            <p className="text-lg font-medium text-muted-foreground mb-2">No logs available</p>
            <p className="text-sm text-muted-foreground">Generate a trip to see daily logs</p>
          </motion.div>
        </motion.div>
      </Card>
    );
  }

  const totals = calculateDayTotals(currentLog.timeEntries);

  const handlePrevDay = async () => {
    if (selectedLogIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      // Small delay for smooth transition
      setTimeout(() => {
        const newIndex = selectedLogIndex - 1;
        setSelectedLogIndex(newIndex);
        onLogChange?.(newIndex);
        setTimeout(() => setIsTransitioning(false), reducedMotion ? 10 : 300);
      }, reducedMotion ? 10 : 150);
    }
  };

  const handleNextDay = async () => {
    if (selectedLogIndex < logs.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      // Small delay for smooth transition
      setTimeout(() => {
        const newIndex = selectedLogIndex + 1;
        setSelectedLogIndex(newIndex);
        onLogChange?.(newIndex);
        setTimeout(() => setIsTransitioning(false), reducedMotion ? 10 : 300);
      }, reducedMotion ? 10 : 150);
    }
  };

  const handleExportPDF = () => {
    onExportPDF?.(currentLog.id);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const amHours = hours.slice(0, 12);
  const pmHours = hours.slice(12);

  return (
    <Card className="p-6">
      <motion.div 
        className="flex items-center justify-between mb-6"
        {...getAccessibleMotionProps('fadeIn', reducedMotion)}
      >
        <motion.div 
          className="flex items-center space-x-2"
          {...getAccessibleMotionProps('slideIn', reducedMotion)}
        >
          <motion.div
            whileHover={reducedMotion ? {} : { rotate: 5, scale: 1.1 }}
            transition={{ duration: 0.2 }}
          >
            <ClipboardList className="text-primary" />
          </motion.div>
          <h2 className="text-xl font-semibold">
            Daily Log - Day {selectedLogIndex + 1}
          </h2>
        </motion.div>
        <motion.div 
          className="flex space-x-2"
          variants={getAccessibleStaggerVariants(reducedMotion)}
          initial="initial"
          animate="animate"
        >
          <motion.div variants={getAccessibleStaggerItemVariants(reducedMotion)}>
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              data-testid="button-export-pdf"
              className={reducedMotion ? '' : 'transition-all duration-200 hover:scale-105 active:scale-95'}
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </motion.div>
          <motion.div variants={getAccessibleStaggerItemVariants(reducedMotion)}>
            <Button
              variant="outline"
              onClick={handlePrevDay}
              disabled={selectedLogIndex === 0 || isTransitioning}
              data-testid="button-prev-day"
              className={reducedMotion ? '' : 'transition-all duration-200 hover:scale-105 active:scale-95'}
            >
              <motion.div
                whileHover={reducedMotion ? {} : { x: -2 }}
                transition={{ duration: 0.15 }}
                className="flex items-center"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev Day
              </motion.div>
            </Button>
          </motion.div>
          <motion.div variants={getAccessibleStaggerItemVariants(reducedMotion)}>
            <Button
              variant="outline"
              onClick={handleNextDay}
              disabled={selectedLogIndex === logs.length - 1 || isTransitioning}
              data-testid="button-next-day"
              className={reducedMotion ? '' : 'transition-all duration-200 hover:scale-105 active:scale-95'}
            >
              <motion.div
                whileHover={reducedMotion ? {} : { x: 2 }}
                transition={{ duration: 0.15 }}
                className="flex items-center"
              >
                Next Day
                <ChevronRight className="ml-1 h-4 w-4" />
              </motion.div>
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Driver Information Section */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={`driver-info-${selectedLogIndex}`}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted rounded-md"
          variants={getAccessibleStaggerVariants(reducedMotion)}
          initial="initial"
          animate="animate"
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
        >
          <motion.div variants={getAccessibleStaggerItemVariants(reducedMotion)}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Driver Name</label>
            <p className="font-mono" data-testid="text-driver-name">{driverName}</p>
          </motion.div>
          <motion.div variants={getAccessibleStaggerItemVariants(reducedMotion)}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
            <p className="font-mono" data-testid="text-log-date">{currentLog.date}</p>
          </motion.div>
          <motion.div variants={getAccessibleStaggerItemVariants(reducedMotion)}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Total Miles Today</label>
            <p className="font-mono" data-testid="text-total-miles">{currentLog.totalMiles}</p>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* ELD Grid Recreation */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={`eld-grid-${selectedLogIndex}`}
          className="overflow-x-auto"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.4, ease: 'easeInOut' }}
        >
          <div className="min-w-full">
            {/* Time Headers */}
            <motion.div 
              className="flex mb-2"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: reducedMotion ? 0.1 : 0.3 }}
            >
              <div className="w-24 text-xs font-medium p-2">Status</div>
              <div className="flex">
                {hours.map((hour, index) => (
                  <motion.div 
                    key={hour} 
                    className="w-6 text-xs text-center border-r border-border"
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
                    animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + (index * 0.01), duration: reducedMotion ? 0.1 : 0.2 }}
                  >
                    {hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* AM/PM Indicator */}
            <motion.div 
              className="flex mb-4"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: reducedMotion ? 0.1 : 0.3 }}
            >
              <div className="w-24"></div>
              <div className="flex">
                <div className="w-72 text-center text-xs bg-muted py-1 border border-border rounded-l-md">AM</div>
                <div className="w-72 text-center text-xs bg-muted py-1 border-t border-r border-b border-border rounded-r-md">PM</div>
              </div>
            </motion.div>

            {/* ELD Status Rows */}
            <motion.div 
              className="space-y-1"
              variants={getAccessibleStaggerVariants(reducedMotion)}
              initial="initial"
              animate="animate"
            >
              {['off-duty', 'sleeper', 'driving', 'on-duty'].map((status, statusIndex) => (
                <motion.div 
                  key={status} 
                  className="flex items-center"
                  variants={getAccessibleStaggerItemVariants(reducedMotion)}
                >
                  <motion.div 
                    className="w-24 text-sm font-medium flex items-center space-x-2 p-2"
                    whileHover={reducedMotion ? {} : { x: 5 }}
                    transition={{ duration: 0.15 }}
                  >
                    <motion.div 
                      className={`w-3 h-3 rounded-full ${getStatusGradient(status).replace('bg-gradient-to-br', 'bg')}`}
                      whileHover={reducedMotion ? {} : { scale: 1.3, rotate: 180 }}
                      transition={{ duration: 0.2 }}
                    ></motion.div>
                    <span className="capitalize">
                      {status === 'on-duty' ? 'On Duty' : status.replace('-', ' ')}
                    </span>
                  </motion.div>
                  <div className="flex">
                    {hours.map((hour, hourIndex) => {
                      // Check if any quarter-hour in this hour has this status
                      const quarterHours = [hour * 4, hour * 4 + 1, hour * 4 + 2, hour * 4 + 3];
                      const hasStatus = quarterHours.some(qh => 
                        currentLog.timeEntries.some(e => e.quarterHour === qh && e.status === status)
                      );
                      
                      return (
                        <motion.div
                          key={hour}
                          className={`w-6 h-6 border-r border-b border-border cursor-pointer transition-all duration-200 ${
                            hasStatus ? getStatusGradient(status) : 'bg-white hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                          title={hasStatus ? `${status}: ${hour}:00` : `${hour}:00`}
                          data-testid={`eld-hour-${hour}-${status}`}
                          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
                          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                          transition={{ 
                            delay: 0.3 + (statusIndex * 0.05) + (hourIndex * 0.005), 
                            duration: reducedMotion ? 0.1 : 0.15 
                          }}
                          whileHover={reducedMotion ? {} : { 
                            scale: 1.15, 
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}
                          whileTap={reducedMotion ? {} : { scale: 0.95 }}
                        ></motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Log Summary */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={`summary-${selectedLogIndex}`}
          className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-md"
          variants={getAccessibleStaggerVariants(reducedMotion)}
          initial="initial"
          animate="animate"
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: reducedMotion ? 0.1 : 0.3 }}
        >
          <motion.div 
            className="text-center"
            variants={getAccessibleStaggerItemVariants(reducedMotion)}
            whileHover={reducedMotion ? {} : { scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs text-muted-foreground mb-1">Total Miles</p>
            <motion.p 
              className="font-mono font-bold text-lg" 
              data-testid="text-summary-miles"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: reducedMotion ? 0.1 : 0.3 }}
            >
              {currentLog.totalMiles}
            </motion.p>
          </motion.div>
          <motion.div 
            className="text-center"
            variants={getAccessibleStaggerItemVariants(reducedMotion)}
            whileHover={reducedMotion ? {} : { scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs text-muted-foreground mb-1">Driving Time</p>
            <motion.p 
              className="font-mono font-bold text-lg text-blue-600" 
              data-testid="text-summary-driving"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: reducedMotion ? 0.1 : 0.3 }}
            >
              {totals.driving}
            </motion.p>
          </motion.div>
          <motion.div 
            className="text-center"
            variants={getAccessibleStaggerItemVariants(reducedMotion)}
            whileHover={reducedMotion ? {} : { scale: 1.05, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs text-muted-foreground mb-1">On-Duty Time</p>
            <motion.p 
              className="font-mono font-bold text-lg text-orange-500" 
              data-testid="text-summary-on-duty"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: reducedMotion ? 0.1 : 0.3 }}
            >
              {totals.onDuty}
            </motion.p>
          </motion.div>
          <motion.div 
            className="text-center"
            variants={getAccessibleStaggerItemVariants(reducedMotion)}
            whileHover={reducedMotion ? {} : { scale: 1.05, backgroundColor: 'rgba(107, 114, 128, 0.1)' }}
            transition={{ duration: 0.2 }}
          >
            <p className="text-xs text-muted-foreground mb-1">Off-Duty Time</p>
            <motion.p 
              className="font-mono font-bold text-lg text-gray-500" 
              data-testid="text-summary-off-duty"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: reducedMotion ? 0.1 : 0.3 }}
            >
              {totals.offDuty}
            </motion.p>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Remarks Section */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={`remarks-${selectedLogIndex}`}
          className="mt-6"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          transition={{ delay: 0.2, duration: reducedMotion ? 0.1 : 0.4 }}
        >
          <motion.label 
            className="block text-sm font-medium text-foreground mb-2"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: reducedMotion ? 0.1 : 0.3 }}
          >
            Remarks
          </motion.label>
          <motion.div 
            className="space-y-2"
            variants={getAccessibleStaggerVariants(reducedMotion)}
            initial="initial"
            animate="animate"
          >
            {currentLog.remarks.split('\n').filter(remark => remark.trim()).map((remark, index) => (
              <motion.div 
                key={index} 
                className="p-2 bg-muted rounded text-sm font-mono border border-transparent"
                data-testid={`remark-${index}`}
                variants={getAccessibleStaggerItemVariants(reducedMotion)}
                whileHover={reducedMotion ? {} : { 
                  scale: 1.02, 
                  borderColor: 'hsl(var(--border))', 
                  backgroundColor: 'hsl(var(--accent))' 
                }}
                transition={{ duration: 0.2 }}
              >
                {remark}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </Card>
  );
};

export default ELDDailyLog;
