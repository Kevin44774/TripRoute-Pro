import { TimeEntry } from "@shared/schema";
import { HOSCalculator } from "./hosCalculator";

export class ELDLogGenerator {
  private hosCalculator = new HOSCalculator();

  /**
   * Generate ELD log entries for a trip
   */
  generateLogForTrip(
    startTime: Date,
    totalMiles: number,
    drivingHours: number,
    pickupTime?: Date,
    dropoffTime?: Date,
    fuelStops: number = 0
  ): {
    timeEntries: TimeEntry[];
    drivingTime: number;
    onDutyTime: number;
    offDutyTime: number;
    sleeperBerthTime: number;
    remarks: string[];
    isCompliant: boolean;
  } {
    // Generate time entries
    const timeEntries = this.hosCalculator.generateTimeEntries(
      startTime,
      drivingHours,
      60, // pickup duration
      60, // dropoff duration
      fuelStops
    );

    // Calculate time totals
    const drivingTime = this.calculateTimeByStatus(timeEntries, 'driving');
    const onDutyTime = this.calculateTimeByStatus(timeEntries, 'on-duty') + drivingTime;
    const offDutyTime = this.calculateTimeByStatus(timeEntries, 'off-duty');
    const sleeperBerthTime = this.calculateTimeByStatus(timeEntries, 'sleeper');

    // Generate remarks
    const remarks = this.generateRemarks(timeEntries, startTime, totalMiles);

    // Check compliance
    const isCompliant = this.hosCalculator.checkCompliance(timeEntries, 0);

    return {
      timeEntries,
      drivingTime,
      onDutyTime,
      offDutyTime,
      sleeperBerthTime,
      remarks,
      isCompliant
    };
  }

  /**
   * Generate multiple day logs for long trips
   */
  generateMultiDayLogs(
    startTime: Date,
    totalMiles: number,
    totalDrivingHours: number,
    pickupLocation: string,
    dropoffLocation: string
  ): Array<{
    date: Date;
    timeEntries: TimeEntry[];
    drivingTime: number;
    onDutyTime: number;
    offDutyTime: number;
    sleeperBerthTime: number;
    remarks: string[];
    isCompliant: boolean;
    dailyMiles: number;
  }> {
    const logs = [];
    const maxDrivingPerDay = 11; // HOS limit
    const maxDutyPerDay = 14; // HOS limit
    
    let remainingHours = totalDrivingHours;
    let remainingMiles = totalMiles;
    let currentDate = new Date(startTime);
    let dayNumber = 1;

    while (remainingHours > 0) {
      const dailyDrivingHours = Math.min(remainingHours, maxDrivingPerDay);
      const dailyMiles = Math.round((dailyDrivingHours / totalDrivingHours) * totalMiles);
      
      // Adjust start time for subsequent days
      const dayStartTime = dayNumber === 1 ? startTime : new Date(currentDate.setHours(6, 0, 0, 0));
      
      const logData = this.generateLogForTrip(
        dayStartTime,
        dailyMiles,
        dailyDrivingHours,
        dayNumber === 1 ? new Date(startTime.getTime() + 60 * 60 * 1000) : undefined, // pickup on first day
        remainingHours <= maxDrivingPerDay ? new Date(dayStartTime.getTime() + dailyDrivingHours * 60 * 60 * 1000) : undefined, // dropoff on last day
        Math.floor(dailyMiles / 500) // fuel stops based on distance
      );

      // Add day-specific remarks
      const dayRemarks = [...logData.remarks];
      if (dayNumber === 1) {
        dayRemarks.unshift(`${this.formatTime(startTime)} - Trip started from current location`);
        dayRemarks.push(`${this.formatTime(new Date(startTime.getTime() + 60 * 60 * 1000))} - Pickup completed at ${pickupLocation}`);
      }
      if (remainingHours <= maxDrivingPerDay) {
        dayRemarks.push(`${this.formatTime(new Date(dayStartTime.getTime() + dailyDrivingHours * 60 * 60 * 1000))} - Delivery completed at ${dropoffLocation}`);
      }
      if (remainingHours > maxDrivingPerDay) {
        dayRemarks.push(`${this.formatTime(new Date(dayStartTime.getTime() + 14 * 60 * 60 * 1000))} - 10-hour rest period started`);
      }

      logs.push({
        date: new Date(currentDate),
        ...logData,
        remarks: dayRemarks,
        dailyMiles
      });

      remainingHours -= dailyDrivingHours;
      remainingMiles -= dailyMiles;
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      dayNumber++;
    }

    return logs;
  }

  /**
   * Calculate total time for a specific status (quarter-hour entries = 15 minutes each)
   */
  private calculateTimeByStatus(timeEntries: TimeEntry[], status: string): number {
    return timeEntries.filter(entry => entry.status === status).length * 15; // 15 minutes per quarter-hour
  }

  /**
   * Generate remarks for the log
   */
  private generateRemarks(timeEntries: TimeEntry[], startTime: Date, totalMiles: number): string[] {
    const remarks: string[] = [];
    let currentTime = new Date(startTime);

    timeEntries.forEach((entry, index) => {
      if (entry.description) {
        const timeStr = this.formatTime(new Date(currentTime.getTime() + index * 60 * 60 * 1000));
        remarks.push(`${timeStr} - ${entry.description}`);
      }
    });

    // Add standard remarks
    if (totalMiles > 0) {
      remarks.push(`Total miles driven: ${totalMiles}`);
    }

    // Add compliance notes
    const violations = this.hosCalculator.calculateViolations(timeEntries, 0);
    violations.forEach(violation => {
      remarks.push(`ALERT: ${violation.description}`);
    });

    return remarks;
  }

  /**
   * Format time for remarks
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  /**
   * Export log data to PDF format structure
   */
  exportToPDFData(logData: {
    date: Date;
    timeEntries: TimeEntry[];
    drivingTime: number;
    onDutyTime: number;
    offDutyTime: number;
    sleeperBerthTime: number;
    remarks: string[];
    dailyMiles: number;
  }, driverName: string): any {
    return {
      driverName,
      date: logData.date.toLocaleDateString(),
      totalMiles: logData.dailyMiles,
      drivingTime: this.formatMinutesToHours(logData.drivingTime),
      onDutyTime: this.formatMinutesToHours(logData.onDutyTime),
      offDutyTime: this.formatMinutesToHours(logData.offDutyTime),
      sleeperBerthTime: this.formatMinutesToHours(logData.sleeperBerthTime),
      timeEntries: logData.timeEntries,
      remarks: logData.remarks
    };
  }

  /**
   * Format minutes to hours string
   */
  private formatMinutesToHours(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }
}
