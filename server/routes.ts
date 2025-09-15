import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTripSchema,
  insertDriverSchema,
  insertEldLogSchema,
} from "@shared/schema";
import { RouteCalculator } from "./services/routeCalculator";
import { HOSCalculator } from "./services/hosCalculator";
import { ELDLogGenerator } from "./services/eldLogGenerator";
import { z } from "zod";

const routeCalculator = new RouteCalculator();
const hosCalculator = new HOSCalculator();
const eldLogGenerator = new ELDLogGenerator();

export async function registerRoutes(app: Express): Promise<Server> {
  // ---------------- Drivers ----------------
  app.post("/api/drivers", async (req, res) => {
    try {
      const driverData = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(driverData);
      res.json(driver);
    } catch (error: any) {
      console.error("DRIVER CREATE ERROR:", error?.issues ?? error);
      if (error?.issues) {
        return res.status(400).json({
          error: "Invalid driver data",
          details: error.issues,
          received: req.body,
        });
      }
      return res.status(400).json({
        error: "Invalid driver data",
        details: error?.message || "Unknown error",
        received: req.body,
      });
    }
  });

  app.get("/api/drivers/:id", async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.id);
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      res.json(driver);
    } catch {
      res.status(500).json({ error: "Failed to fetch driver" });
    }
  });

  app.get("/api/drivers/license/:licenseNumber", async (req, res) => {
    try {
      const driver = await storage.getDriverByLicense(req.params.licenseNumber);
      if (!driver) return res.status(404).json({ error: "Driver not found" });
      res.json(driver);
    } catch {
      res.status(500).json({ error: "Failed to fetch driver" });
    }
  });

  // ---------------- Trips ----------------
  app.post("/api/trips", async (req, res) => {
    try {
      const tripData = insertTripSchema.parse(req.body);
      const trip = await storage.createTrip(tripData);
      res.json(trip);
    } catch (error) {
      res.status(400).json({
        error: "Invalid trip data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.post("/api/trips/calculate", async (req, res) => {
    try {
      // driverId is OPTIONAL (frontend does not need to send it)
      const schema = z.object({
        currentLocation: z.string().min(1),
        pickupLocation: z.string().min(1),
        dropoffLocation: z.string().min(1),
        currentCycleHours: z.number().min(0).max(70),
        estimatedWeight: z.number().optional().default(80000),
        driverId: z.string().optional(),
      });

      const data = schema.parse(req.body);

      // Resolve or auto-create a driver
      let driverId = data.driverId;
      if (!driverId) {
        const existing = await storage.getFirstDriver();
        if (existing) {
          driverId = existing.id;
        } else {
          const demo = await storage.createDriver({
            name: "Demo Driver",
            licenseNumber: `DEMO-${Date.now()}`,
            currentCycleHours: 0,
          });
          driverId = demo.id;
        }
      }

      // Calculate route via OSRM
      const routeData = await routeCalculator.calculateRoute(
        data.currentLocation,
        data.pickupLocation,
        data.dropoffLocation
      );

      // Create trip (IMPORTANT: include driverId)
      const trip = await storage.createTrip({
        driverId,
        currentLocation: data.currentLocation,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        estimatedWeight: data.estimatedWeight,
      });

      // Update trip with route details
      await storage.updateTripRoute(
        trip.id,
        routeData,
        routeData.totalDistance,
        routeData.estimatedDuration
      );

      // Generate ELD logs
      const drivingHours = routeData.estimatedDuration / 60;
      const startTime = new Date();

      let genLogs: any[];
      if (drivingHours > 11) {
        genLogs = eldLogGenerator.generateMultiDayLogs(
          startTime,
          routeData.totalDistance,
          drivingHours,
          data.pickupLocation,
          data.dropoffLocation
        );
      } else {
        const singleLog = eldLogGenerator.generateLogForTrip(
          startTime,
          routeData.totalDistance,
          drivingHours
        );
        genLogs = [
          {
            date: startTime,
            ...singleLog,
            dailyMiles: routeData.totalDistance,
          },
        ];
      }

      // Save logs
      const savedLogs = [];
      for (const logData of genLogs) {
        const savedLog = await storage.createEldLog({
          driverId,
          tripId: trip.id,
          logDate: logData.date.toISOString(),
          totalMiles: logData.dailyMiles,
          drivingTime: logData.drivingTime,
          onDutyTime: logData.onDutyTime,
          offDutyTime: logData.offDutyTime,
          sleeperBerthTime: logData.sleeperBerthTime,
          timeEntries: JSON.stringify(logData.timeEntries),
          remarks: logData.remarks.join("\n"),
          isCompliant: logData.isCompliant,
        });
        savedLogs.push(savedLog);
      }

      // HOS status & violations (compute BEFORE responding)
      const currentTimeEntries = genLogs[0]?.timeEntries || [];
      const hosStatus = hosCalculator.calculateHOSStatus(
        currentTimeEntries,
        data.currentCycleHours
      );

      const violations = hosCalculator.calculateViolations(
        currentTimeEntries,
        data.currentCycleHours
      );
      for (const v of violations) {
        await storage.createHosViolation({
          driverId,
          tripId: trip.id,
          violationType: v.type,
          description: v.description,
          severity: v.severity,
        });
      }

      // Normalize timeEntries to arrays for the response
      const responseLogs = savedLogs.map((l) => ({
        ...l,
        timeEntries: safeParseArray(l.timeEntries),
      }));

      // Single response
      res.json({
        trip,
        route: routeData,
        eldLogs: responseLogs,
        hosStatus,
        violations,
      });
    } catch (error) {
      console.error("Route calculation error:", error);
      let errorMessage = "Failed to calculate route";
      let userFriendlyMessage = "Please check your locations and try again";
      if (error instanceof Error) {
        if (error.message.includes("Could not find location")) {
          errorMessage = "Location not found";
          userFriendlyMessage =
            "One or more locations could not be found. Please check spelling and try common city names.";
        } else if (error.message.includes("Geocoding failed")) {
          errorMessage = "Address lookup service temporarily unavailable";
          userFriendlyMessage =
            "Our address lookup service is temporarily busy. Please try again.";
        } else if (error.message.includes("No route found")) {
          errorMessage = "No route available";
          userFriendlyMessage =
            "No driving route could be found. Please check the addresses.";
        }
      }
      res.status(400).json({
        error: errorMessage,
        details: userFriendlyMessage,
        originalError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/trips/:id", async (req, res) => {
    try {
      const trip = await storage.getTrip(req.params.id);
      if (!trip) return res.status(404).json({ error: "Trip not found" });
      res.json(trip);
    } catch {
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  app.get("/api/drivers/:driverId/trips", async (req, res) => {
    try {
      const trips = await storage.getTripsByDriver(req.params.driverId);
      res.json(trips);
    } catch {
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  // ---------------- ELD Logs ----------------
  app.get("/api/drivers/:driverId/logs", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const logs = await storage.getEldLogsByDriver(
        req.params.driverId,
        start,
        end
      );
      const parsed = logs.map((l) => ({
        ...l,
        timeEntries: safeParseArray(l.timeEntries),
      }));
      res.json(parsed);
    } catch {
      res.status(500).json({ error: "Failed to fetch ELD logs" });
    }
  });

  app.put("/api/logs/:id", async (req, res) => {
    try {
      const logId = req.params.id;
      const updates = insertEldLogSchema.partial().parse(req.body);
      const updatedLog = await storage.updateEldLog(logId, updates);
      res.json(updatedLog);
    } catch (error) {
      console.error("Failed to update ELD log:", error);
      res.status(400).json({
        error: "Failed to update ELD log",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/trips/:tripId/logs", async (req, res) => {
    try {
      const logs = await storage.getEldLogsByTrip(req.params.tripId);
      const parsed = logs.map((l) => ({
        ...l,
        timeEntries: safeParseArray(l.timeEntries),
      }));
      res.json(parsed);
    } catch {
      res.status(500).json({ error: "Failed to fetch trip logs" });
    }
  });

  app.get("/api/logs/:id/pdf", async (req, res) => {
    try {
      const log = await storage.getEldLog(req.params.id);
      if (!log) return res.status(404).json({ error: "Log not found" });

      const driver = await storage.getDriver(log.driverId);
      if (!driver) return res.status(404).json({ error: "Driver not found" });

      const pdfData = eldLogGenerator.exportToPDFData(
        {
          date: new Date(log.logDate),
          timeEntries: safeParseArray(log.timeEntries),
          drivingTime: log.drivingTime || 0,
          onDutyTime: log.onDutyTime || 0,
          offDutyTime: log.offDutyTime || 0,
          sleeperBerthTime: log.sleeperBerthTime || 0,
          remarks: log.remarks ? log.remarks.split("\n") : [],
          dailyMiles: Number(log.totalMiles || 0),
        },
        driver.name
      );

      res.json(pdfData);
    } catch {
      res.status(500).json({ error: "Failed to generate PDF data" });
    }
  });

  // ---------------- HOS Status / Violations ----------------
  app.get("/api/drivers/:driverId/hos-status", async (req, res) => {
    try {
      const driver = await storage.getDriver(req.params.driverId);
      if (!driver) return res.status(404).json({ error: "Driver not found" });

      const logs = await storage.getEldLogsByDriver(req.params.driverId);
      const latestLog = logs[0];
      const currentCycleHours = Number(driver.currentCycleHours) || 0;

      let hosStatus;
      if (latestLog && latestLog.timeEntries) {
        const parsed = safeParseArray(latestLog.timeEntries);
        if (parsed.length > 0) {
          hosStatus = hosCalculator.calculateHOSStatus(
            parsed as any,
            currentCycleHours
          );
        }
      }
      if (!hosStatus) {
        hosStatus = {
          driveTimeLeft: "11h 00m",
          onDutyLeft: "14h 00m",
          cycleUsed: `${currentCycleHours}h / 70h`,
          nextBreak: "8h 00m",
          isCompliant: true,
        };
      }

      res.json(hosStatus);
    } catch (error) {
      console.error("HOS Status error:", error);
      res.status(500).json({
        error: "Failed to fetch HOS status",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/drivers/:driverId/violations", async (req, res) => {
    try {
      const violations = await storage.getActiveViolationsByDriver(
        req.params.driverId
      );
      res.json(violations);
    } catch {
      res.status(500).json({ error: "Failed to fetch violations" });
    }
  });

  app.patch("/api/violations/:id/resolve", async (req, res) => {
    try {
      await storage.resolveViolation(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to resolve violation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// -------- helpers --------
function safeParseArray(raw: unknown): any[] {
  try {
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
