import {
  drivers,
  trips,
  eldLogs,
  hosViolations,
  type Driver,
  type Trip,
  type EldLog,
  type HosViolation,
  type InsertDriver,
  type InsertTrip,
  type InsertEldLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Driver methods
  getDriver(id: string): Promise<Driver | undefined>;
  getDriverByLicense(licenseNumber: string): Promise<Driver | undefined>;
  getFirstDriver(): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriverCycleHours(id: string, hours: number): Promise<void>;

  // Trip methods
  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: string): Promise<Trip | undefined>;
  getTripsByDriver(driverId: string): Promise<Trip[]>;
  updateTripRoute(
    id: string,
    routeData: any,
    totalDistance: number,
    estimatedDuration: number
  ): Promise<void>;
  updateTripStatus(id: string, status: string): Promise<void>;

  // ELD Log methods
  createEldLog(log: InsertEldLog): Promise<EldLog>;
  getEldLog(id: string): Promise<EldLog | undefined>;
  updateEldLog(id: string, updates: Partial<InsertEldLog>): Promise<EldLog>;
  getEldLogsByDriver(
    driverId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EldLog[]>;
  getEldLogsByTrip(tripId: string): Promise<EldLog[]>;

  // HOS Violation methods
  createHosViolation(args: {
    driverId: string;
    tripId?: string;
    violationType: string;
    description: string;
    severity?: string;
  }): Promise<HosViolation>;
  getActiveViolationsByDriver(driverId: string): Promise<HosViolation[]>;
  resolveViolation(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ---------------- Drivers ----------------
  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async getDriverByLicense(licenseNumber: string): Promise<Driver | undefined> {
    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.licenseNumber, licenseNumber));
    return driver || undefined;
  }

  async getFirstDriver(): Promise<Driver | undefined> {
    const [driver] = await db
      .select()
      .from(drivers)
      .orderBy(desc(drivers.createdAt));
    return driver || undefined;
  }

  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(insertDriver).returning();
    return driver;
  }

  async updateDriverCycleHours(id: string, hours: number): Promise<void> {
    await db
      .update(drivers)
      .set({ currentCycleHours: Number(hours) })
      .where(eq(drivers.id, id));
  }

  // ---------------- Trips ----------------
  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const [trip] = await db.insert(trips).values(insertTrip).returning();
    return trip;
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
  }

  async getTripsByDriver(driverId: string): Promise<Trip[]> {
    return await db
      .select()
      .from(trips)
      .where(eq(trips.driverId, driverId))
      .orderBy(desc(trips.createdAt));
  }

  async updateTripRoute(
    id: string,
    routeData: any,
    totalDistance: number,
    estimatedDuration: number
  ): Promise<void> {
    await db
      .update(trips)
      .set({
        routeData: JSON.stringify(routeData),      // JSON as TEXT for SQLite
        totalDistance: Number(totalDistance),      // real
        estimatedDuration,                         // integer
        updatedAt: new Date().toISOString(),       // TEXT ISO
      })
      .where(eq(trips.id, id));
  }

  async updateTripStatus(id: string, status: string): Promise<void> {
    await db
      .update(trips)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(trips.id, id));
  }

  // ---------------- ELD Logs ----------------
  async createEldLog(insertLog: InsertEldLog): Promise<EldLog> {
    const [log] = await db
      .insert(eldLogs)
      .values({
        ...insertLog,
        logDate: new Date(insertLog.logDate as any).toISOString(),
        totalMiles:
          insertLog.totalMiles !== undefined
            ? Number(insertLog.totalMiles)
            : 0,
        timeEntries:
          typeof insertLog.timeEntries === "string"
            ? insertLog.timeEntries
            : JSON.stringify(insertLog.timeEntries),
      })
      .returning();
    return log;
  }

  async getEldLog(id: string): Promise<EldLog | undefined> {
    const [log] = await db.select().from(eldLogs).where(eq(eldLogs.id, id));
    return log || undefined;
  }

  async updateEldLog(
    id: string,
    updates: Partial<InsertEldLog>
  ): Promise<EldLog> {
    const normalized: Partial<InsertEldLog> = {
      ...updates,
      ...(updates.logDate && {
        logDate: new Date(updates.logDate as any).toISOString(),
      }),
      ...(updates.totalMiles !== undefined && {
        totalMiles: Number(updates.totalMiles),
      }),
      ...(updates.timeEntries !== undefined && {
        timeEntries:
          typeof updates.timeEntries === "string"
            ? updates.timeEntries
            : JSON.stringify(updates.timeEntries),
      }),
    };

    const [updatedLog] = await db
      .update(eldLogs)
      .set(normalized)
      .where(eq(eldLogs.id, id))
      .returning();
    return updatedLog;
  }

  async getEldLogsByDriver(
    driverId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<EldLog[]> {
    if (startDate && endDate) {
      return await db
        .select()
        .from(eldLogs)
        .where(
          and(
            eq(eldLogs.driverId, driverId),
            gte(eldLogs.logDate, startDate.toISOString()),
            lte(eldLogs.logDate, endDate.toISOString())
          )
        )
        .orderBy(desc(eldLogs.logDate));
    } else {
      return await db
        .select()
        .from(eldLogs)
        .where(eq(eldLogs.driverId, driverId))
        .orderBy(desc(eldLogs.logDate));
    }
  }

  async getEldLogsByTrip(tripId: string): Promise<EldLog[]> {
    return await db
      .select()
      .from(eldLogs)
      .where(eq(eldLogs.tripId, tripId))
      .orderBy(desc(eldLogs.logDate));
  }

  // ---------------- Violations ----------------
  async createHosViolation(args: {
    driverId: string;
    tripId?: string;
    violationType: string;
    description: string;
    severity?: string;
  }): Promise<HosViolation> {
    const [hosViolation] = await db
      .insert(hosViolations)
      .values(args)
      .returning();
    return hosViolation;
  }

  async getActiveViolationsByDriver(driverId: string): Promise<HosViolation[]> {
    return await db
      .select()
      .from(hosViolations)
      .where(
        and(
          eq(hosViolations.driverId, driverId),
          eq(hosViolations.resolved, false)
        )
      )
      .orderBy(desc(hosViolations.timestamp));
  }

  async resolveViolation(id: string): Promise<void> {
    await db
      .update(hosViolations)
      .set({ resolved: true })
      .where(eq(hosViolations.id, id));
  }
}

export const storage = new DatabaseStorage();
