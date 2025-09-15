import { TimeEntry, HOSStatus } from "@shared/schema";

export class HOSCalculator {
  private readonly DRIVE_LIMIT_HOURS = 11;
  private readonly DUTY_LIMIT_HOURS = 14;
  private readonly CYCLE_LIMIT_HOURS = 70;
  private readonly CYCLE_DAYS = 8;
  private readonly BREAK_REQUIRED_HOURS = 8;
  private readonly BREAK_DURATION_MINUTES = 30;

  /**
   * Calculate current HOS status based on time entries and cycle hours
   */
  calculateHOSStatus(timeEntries: TimeEntry[], currentCycleHours: number): HOSStatus {
    const today = new Date();
    const drivingMinutes = this.calculateDrivingTime(timeEntries);
    const onDutyMinutes = this.calculateOnDutyTime(timeEntries);
    const timeSinceLastBreak = this.getTimeSinceLastBreak(timeEntries);

    // Calculate remaining times
    const driveTimeLeft = Math.max(0, (this.DRIVE_LIMIT_HOURS * 60) - drivingMinutes);
    const onDutyLeft = Math.max(0, (this.DUTY_LIMIT_HOURS * 60) - onDutyMinutes);
    const cycleLeft = Math.max(0, this.CYCLE_LIMIT_HOURS - currentCycleHours);

    // Determine next break requirement
    const nextBreakMinutes = Math.max(0, (this.BREAK_REQUIRED_HOURS * 60) - timeSinceLastBreak);

    // Check compliance
    const isCompliant = this.checkCompliance(timeEntries, currentCycleHours);

    return {
      driveTimeLeft: this.formatTime(driveTimeLeft),
      onDutyLeft: this.formatTime(onDutyLeft),
      cycleUsed: `${currentCycleHours}h / ${this.CYCLE_LIMIT_HOURS}h`,
      nextBreak: nextBreakMinutes > 0 ? this.formatTime(nextBreakMinutes) : "Break required now",
      isCompliant
    };
  }

  /**
   * Calculate driving time from time entries (quarter-hour resolution)
   */
  private calculateDrivingTime(timeEntries: TimeEntry[]): number {
    return timeEntries
      .filter(entry => entry.status === 'driving')
      .length * 15; // Each entry represents 15 minutes (quarter-hour)
  }

  /**
   * Calculate on-duty time (driving + on-duty not driving)
   */
  private calculateOnDutyTime(timeEntries: TimeEntry[]): number {
    return timeEntries
      .filter(entry => entry.status === 'driving' || entry.status === 'on-duty')
      .length * 15; // Each entry represents 15 minutes (quarter-hour)
  }

  /**
   * Get time since last qualifying break
   */
  private getTimeSinceLastBreak(timeEntries: TimeEntry[]): number {
    let consecutiveTime = 0;
    for (let i = timeEntries.length - 1; i >= 0; i--) {
      const entry = timeEntries[i];
      if (entry.status === 'driving' || entry.status === 'on-duty') {
        consecutiveTime += 15; // Each entry represents 15 minutes (quarter-hour)
      } else if (entry.status === 'off-duty' || entry.status === 'sleeper') {
        break;
      }
    }
    return consecutiveTime;
  }

  /**
   * Check HOS compliance
   */
  checkCompliance(timeEntries: TimeEntry[], currentCycleHours: number): boolean {
    const drivingTime = this.calculateDrivingTime(timeEntries);
    const onDutyTime = this.calculateOnDutyTime(timeEntries);
    const timeSinceBreak = this.getTimeSinceLastBreak(timeEntries);

    // Check all HOS limits
    if (drivingTime >= this.DRIVE_LIMIT_HOURS * 60) return false;
    if (onDutyTime >= this.DUTY_LIMIT_HOURS * 60) return false;
    if (currentCycleHours >= this.CYCLE_LIMIT_HOURS) return false;
    if (timeSinceBreak >= this.BREAK_REQUIRED_HOURS * 60) return false;

    return true;
  }

  /**
   * Generate time entries for a trip based on route and stops (quarter-hour resolution)
   */
  generateTimeEntries(
    startTime: Date,
    drivingHours: number,
    pickupDuration: number = 60,
    dropoffDuration: number = 60,
    fuelStops: number = 0
  ): TimeEntry[] {
    const entries: TimeEntry[] = [];
    
    // Convert start time to quarter-hour index (0-95)
    let currentQuarterHour = (startTime.getHours() * 4) + Math.floor(startTime.getMinutes() / 15);

    // Add off-duty time before trip starts
    for (let i = 0; i < currentQuarterHour; i++) {
      entries.push({ quarterHour: i, status: 'off-duty' });
    }

    // Add pickup time (convert pickup duration minutes to quarter-hours)
    const pickupQuarters = Math.ceil(pickupDuration / 15);
    for (let i = 0; i < pickupQuarters && currentQuarterHour < 96; i++) {
      entries.push({ 
        quarterHour: currentQuarterHour, 
        status: 'on-duty', 
        description: i === 0 ? 'Pickup' : undefined 
      });
      currentQuarterHour++;
    }

    // Add driving time with breaks (convert driving hours to quarter-hours)
    const drivingQuarters = drivingHours * 4; // 4 quarter-hours per hour
    let remainingDrivingQuarters = drivingQuarters;
    let consecutiveDrivingQuarters = 0;

    while (remainingDrivingQuarters > 0 && currentQuarterHour < 96) {
      // Check if break is needed (after 8 hours = 32 quarter-hours of driving)
      if (consecutiveDrivingQuarters >= (this.BREAK_REQUIRED_HOURS * 4) && remainingDrivingQuarters > 0) {
        // Add required 30-minute break (2 quarter-hours)
        for (let i = 0; i < 2 && currentQuarterHour < 96; i++) {
          entries.push({ 
            quarterHour: currentQuarterHour, 
            status: 'off-duty', 
            description: i === 0 ? '30-min break' : undefined 
          });
          currentQuarterHour++;
        }
        consecutiveDrivingQuarters = 0;
      } else {
        entries.push({ quarterHour: currentQuarterHour, status: 'driving' });
        remainingDrivingQuarters--;
        consecutiveDrivingQuarters++;
        currentQuarterHour++;
      }
    }

    // Add fuel stops (30 minutes each = 2 quarter-hours)
    for (let stop = 0; stop < fuelStops && currentQuarterHour < 96; stop++) {
      for (let i = 0; i < 2 && currentQuarterHour < 96; i++) {
        entries.push({ 
          quarterHour: currentQuarterHour, 
          status: 'on-duty', 
          description: i === 0 ? 'Fuel stop' : undefined 
        });
        currentQuarterHour++;
      }
    }

    // Add dropoff time (convert dropoff duration minutes to quarter-hours)
    const dropoffQuarters = Math.ceil(dropoffDuration / 15);
    for (let i = 0; i < dropoffQuarters && currentQuarterHour < 96; i++) {
      entries.push({ 
        quarterHour: currentQuarterHour, 
        status: 'on-duty', 
        description: i === 0 ? 'Delivery' : undefined 
      });
      currentQuarterHour++;
    }

    // Fill remaining quarter-hours as off-duty
    while (currentQuarterHour < 96) {
      entries.push({ quarterHour: currentQuarterHour, status: 'off-duty' });
      currentQuarterHour++;
    }

    return entries;
  }

  /**
   * Format minutes to hours and minutes string
   */
  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }

  /**
   * Calculate violations for time entries
   */
  calculateViolations(timeEntries: TimeEntry[], currentCycleHours: number): Array<{type: string, description: string, severity: string}> {
    const violations = [];
    const drivingTime = this.calculateDrivingTime(timeEntries);
    const onDutyTime = this.calculateOnDutyTime(timeEntries);
    const timeSinceBreak = this.getTimeSinceLastBreak(timeEntries);

    if (drivingTime > this.DRIVE_LIMIT_HOURS * 60) {
      violations.push({
        type: 'driving_limit',
        description: `Exceeded 11-hour driving limit by ${this.formatTime(drivingTime - (this.DRIVE_LIMIT_HOURS * 60))}`,
        severity: 'violation'
      });
    }

    if (onDutyTime > this.DUTY_LIMIT_HOURS * 60) {
      violations.push({
        type: 'duty_limit',
        description: `Exceeded 14-hour duty limit by ${this.formatTime(onDutyTime - (this.DUTY_LIMIT_HOURS * 60))}`,
        severity: 'violation'
      });
    }

    if (timeSinceBreak >= this.BREAK_REQUIRED_HOURS * 60) {
      violations.push({
        type: 'break_required',
        description: `30-minute break required after ${this.BREAK_REQUIRED_HOURS} hours of driving`,
        severity: 'warning'
      });
    }

    if (currentCycleHours >= this.CYCLE_LIMIT_HOURS) {
      violations.push({
        type: 'cycle_limit',
        description: `Exceeded 70-hour/8-day cycle limit`,
        severity: 'violation'
      });
    }

    return violations;
  }
}
