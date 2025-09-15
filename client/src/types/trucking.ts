export interface TripFormData {
  currentLocation: string;
  pickupLocation: string;
  dropoffLocation: string;
  currentCycleHours: number;
  estimatedWeight: number;
  driverId: string;
}

export interface RouteData {
  coordinates: [number, number][];
  totalDistance: number;
  estimatedDuration: number;
  stops: RouteStop[];
}

export interface RouteStop {
  id: string;
  type: 'fuel' | 'rest' | 'pickup' | 'dropoff' | 'break';
  location: string;
  coordinates: [number, number];
  estimatedTime: string;
  description: string;
  duration?: number;
  required: boolean;
}

export interface TimeEntry {
  quarterHour: number; // 0-95 (96 quarter-hour slots per day)
  status: 'off-duty' | 'sleeper' | 'driving' | 'on-duty';
  description?: string;
}

export interface ELDLogData {
  id: string;
  date: string;
  totalMiles: string;
  drivingTime: number;  // in minutes
  onDutyTime: number;   // in minutes
  offDutyTime: number;  // in minutes
  sleeperBerthTime: number; // in minutes
  timeEntries: TimeEntry[];
  remarks: string;
  isCompliant: boolean;
  // FMCSA required fields
  coDriverName?: string;
  carrierName?: string;
  dotNumber?: string;
  timeZone?: string;
  truckNumber?: string;
  trailerNumbers?: string;
  shippingDocNumbers?: string;
  mainOfficeAddress?: string;
}

export interface HOSStatus {
  driveTimeLeft: string;
  onDutyLeft: string;
  cycleUsed: string;
  nextBreak: string;
  isCompliant: boolean;
}

export interface Violation {
  id: string;
  violationType: string;
  description: string;
  severity: 'warning' | 'violation';
  timestamp: string;
  resolved: boolean;
}

export interface TripCalculationResult {
  trip: any;
  route: RouteData;
  eldLogs: ELDLogData[];
  hosStatus: HOSStatus;
  violations: Violation[];
}
