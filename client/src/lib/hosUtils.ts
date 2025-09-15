import { TimeEntry } from "../types/trucking";

export const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, '0')}m`;
};

export const parseTimeString = (timeStr: string): number => {
  const match = timeStr.match(/(\d+)h\s*(\d+)m/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'driving':
      return 'bg-blue-600';
    case 'on-duty':
      return 'bg-orange-500';
    case 'sleeper':
      return 'bg-green-500';
    case 'off-duty':
      return 'bg-gray-400';
    default:
      return 'bg-gray-200';
  }
};

export const getStatusGradient = (status: string): string => {
  switch (status) {
    case 'driving':
      return 'bg-gradient-to-br from-blue-600 to-blue-800';
    case 'on-duty':
      return 'bg-gradient-to-br from-orange-500 to-orange-600';
    case 'sleeper':
      return 'bg-gradient-to-br from-green-500 to-green-600';
    case 'off-duty':
      return 'bg-gradient-to-br from-gray-400 to-gray-500';
    default:
      return 'bg-gray-200';
  }
};

export const calculateDayTotals = (timeEntries: TimeEntry[]) => {
  const totals = {
    driving: 0,
    onDuty: 0,
    offDuty: 0,
    sleeper: 0
  };

  timeEntries.forEach(entry => {
    switch (entry.status) {
      case 'driving':
        totals.driving += 60;
        totals.onDuty += 60;
        break;
      case 'on-duty':
        totals.onDuty += 60;
        break;
      case 'off-duty':
        totals.offDuty += 60;
        break;
      case 'sleeper':
        totals.sleeper += 60;
        break;
    }
  });

  return {
    driving: formatTime(totals.driving),
    onDuty: formatTime(totals.onDuty),
    offDuty: formatTime(totals.offDuty),
    sleeper: formatTime(totals.sleeper)
  };
};

export const checkHOSCompliance = (timeEntries: TimeEntry[], currentCycleHours: number): boolean => {
  const drivingTime = timeEntries.filter(e => e.status === 'driving').length;
  const onDutyTime = timeEntries.filter(e => e.status === 'driving' || e.status === 'on-duty').length;
  
  // Check 11-hour driving limit
  if (drivingTime > 11) return false;
  
  // Check 14-hour duty limit
  if (onDutyTime > 14) return false;
  
  // Check 70-hour cycle limit
  if (currentCycleHours >= 70) return false;
  
  return true;
};

export const getHOSAlerts = (timeEntries: TimeEntry[], currentCycleHours: number): Array<{type: string, message: string, severity: 'warning' | 'error'}> => {
  const alerts = [];
  const drivingTime = timeEntries.filter(e => e.status === 'driving').length;
  const onDutyTime = timeEntries.filter(e => e.status === 'driving' || e.status === 'on-duty').length;
  
  // Driving time warnings
  if (drivingTime >= 10) {
    alerts.push({
      type: 'driving_limit',
      message: `Approaching 11-hour driving limit (${drivingTime}h used)`,
      severity: 'warning' as const
    });
  }
  
  if (drivingTime >= 11) {
    alerts.push({
      type: 'driving_violation',
      message: `Exceeded 11-hour driving limit`,
      severity: 'error' as const
    });
  }
  
  // On-duty time warnings
  if (onDutyTime >= 13) {
    alerts.push({
      type: 'duty_limit',
      message: `Approaching 14-hour duty limit (${onDutyTime}h used)`,
      severity: 'warning' as const
    });
  }
  
  if (onDutyTime >= 14) {
    alerts.push({
      type: 'duty_violation',
      message: `Exceeded 14-hour duty limit`,
      severity: 'error' as const
    });
  }
  
  // Cycle warnings
  if (currentCycleHours >= 65) {
    alerts.push({
      type: 'cycle_limit',
      message: `Approaching 70-hour cycle limit (${currentCycleHours}h used)`,
      severity: 'warning' as const
    });
  }
  
  if (currentCycleHours >= 70) {
    alerts.push({
      type: 'cycle_violation',
      message: `Exceeded 70-hour cycle limit`,
      severity: 'error' as const
    });
  }
  
  return alerts;
};
