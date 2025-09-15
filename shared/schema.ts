import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ----------------- DRIVERS -----------------
export const drivers = sqliteTable("drivers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  licenseNumber: text("license_number").notNull().unique(),
  currentCycleHours: real("current_cycle_hours").default(0),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ----------------- TRIPS -----------------
export const trips = sqliteTable("trips", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  driverId: text("driver_id").notNull(),
  currentLocation: text("current_location").notNull(),
  pickupLocation: text("pickup_location").notNull(),
  dropoffLocation: text("dropoff_location").notNull(),
  estimatedWeight: integer("estimated_weight").default(80000),
  totalDistance: real("total_distance"),
  estimatedDuration: integer("estimated_duration"), // in minutes
  routeData: text("route_data"), // JSON as text
  status: text("status").default("planned"), // planned, active, completed
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: text("updated_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ----------------- ELD LOGS -----------------
export const eldLogs = sqliteTable("eld_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  driverId: text("driver_id").notNull(),
  tripId: text("trip_id"),
  logDate: text("log_date").notNull(),
  totalMiles: real("total_miles").default(0),
  drivingTime: integer("driving_time").default(0), // in minutes
  onDutyTime: integer("on_duty_time").default(0), // in minutes
  offDutyTime: integer("off_duty_time").default(0), // in minutes
  sleeperBerthTime: integer("sleeper_berth_time").default(0), // in minutes
  timeEntries: text("time_entries").notNull(), // JSON as text
  remarks: text("remarks"),
  isCompliant: integer("is_compliant", { mode: "boolean" }).default(true),
  coDriverName: text("co_driver_name"),
  carrierName: text("carrier_name").notNull().default(""),
  dotNumber: text("dot_number"),
  timeZone: text("time_zone").notNull().default("America/New_York"),
  truckNumber: text("truck_number"),
  trailerNumbers: text("trailer_numbers"),
  shippingDocNumbers: text("shipping_doc_numbers"),
  mainOfficeAddress: text("main_office_address"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// ----------------- HOS VIOLATIONS -----------------
export const hosViolations = sqliteTable("hos_violations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  driverId: text("driver_id").notNull(),
  tripId: text("trip_id"),
  violationType: text("violation_type").notNull(),
  description: text("description").notNull(),
  severity: text("severity").default("warning"),
  timestamp: text("timestamp")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  resolved: integer("resolved", { mode: "boolean" }).default(false),
});

// ----------------- ZOD SCHEMAS -----------------
export const insertDriverSchema = createInsertSchema(drivers).pick({
  name: true,
  licenseNumber: true,
  currentCycleHours: true,
});

export const insertTripSchema = createInsertSchema(trips).pick({
  driverId: true,
  currentLocation: true,
  pickupLocation: true,
  dropoffLocation: true,
  estimatedWeight: true,
});

export const insertEldLogSchema = createInsertSchema(eldLogs).pick({
  driverId: true,
  tripId: true,
  logDate: true,
  totalMiles: true,
  drivingTime: true,
  onDutyTime: true,
  offDutyTime: true,
  sleeperBerthTime: true,
  timeEntries: true,
  remarks: true,
  isCompliant: true,
  coDriverName: true,
  carrierName: true,
  dotNumber: true,
  timeZone: true,
  truckNumber: true,
  trailerNumbers: true,
  shippingDocNumbers: true,
  mainOfficeAddress: true,
});

// ----------------- TYPES -----------------
export type Driver = typeof drivers.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type EldLog = typeof eldLogs.$inferSelect;
export type HosViolation = typeof hosViolations.$inferSelect;

export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type InsertEldLog = z.infer<typeof insertEldLogSchema>;

// ----------------- FRONTEND TYPES -----------------
export interface RouteStop {
  id: string;
  type: "fuel" | "rest" | "pickup" | "dropoff" | "break";
  location: string;
  coordinates: [number, number];
  estimatedTime: string;
  description: string;
  duration?: number;
  required: boolean;
}

export interface TimeEntry {
  quarterHour: number; // 0-95
  status: "off-duty" | "sleeper" | "driving" | "on-duty";
  description?: string;
}

export interface HOSStatus {
  driveTimeLeft: string;
  onDutyLeft: string;
  cycleUsed: string;
  nextBreak: string;
  isCompliant: boolean;
}
