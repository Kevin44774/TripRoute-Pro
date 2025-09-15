import { RouteStop } from "@shared/schema";

export class RouteCalculator {
  private readonly OSRM_BASE_URL = "https://router.project-osrm.org";
  private readonly FUEL_INTERVAL_MILES = 1000;
  private readonly AVERAGE_SPEED_MPH = 55;

  /**
   * Calculate route between locations using OSRM
   */
  async calculateRoute(
    currentLocation: string,
    pickupLocation: string,
    dropoffLocation: string
  ): Promise<{
    coordinates: [number, number][];   // [lat, lng] for Leaflet
    totalDistance: number;
    estimatedDuration: number;
    stops: RouteStop[];
  }> {
    try {
      // Geocode locations to coordinates
      const currentCoords = await this.geocodeLocation(currentLocation);
      const pickupCoords = await this.geocodeLocation(pickupLocation);
      const dropoffCoords = await this.geocodeLocation(dropoffLocation);

      // Calculate route segments
      const segment1 = await this.getRouteSegment(currentCoords, pickupCoords);
      const segment2 = await this.getRouteSegment(pickupCoords, dropoffCoords);

      // Combine route data
      const totalDistance = segment1.distance + segment2.distance;
      const estimatedDuration = segment1.duration + segment2.duration;
      const coordinates = [...segment1.coordinates, ...segment2.coordinates];

      // Convert [lng, lat] → [lat, lng] for Leaflet
      const leafletCoords: [number, number][] = coordinates.map(
        (c) => [c[1], c[0]]
      );

      // Generate stops (also [lat, lng])
      const stops = this.generateStops(
        currentLocation,
        pickupLocation,
        dropoffLocation,
        [currentCoords[1], currentCoords[0]],
        [pickupCoords[1], pickupCoords[0]],
        [dropoffCoords[1], dropoffCoords[0]],
        totalDistance,
        estimatedDuration
      );

      return {
        coordinates: leafletCoords,
        totalDistance: totalDistance * 0.000621371, // meters → miles
        estimatedDuration: Math.round(estimatedDuration / 60), // sec → min
        stops
      };
    } catch (error) {
      console.error("Route calculation error:", error);
      throw new Error(
        "Failed to calculate route. Please check your locations and try again."
      );
    }
  }

  /**
   * Geocode location string to coordinates (returns [lng, lat])
   */
  private async geocodeLocation(location: string): Promise<[number, number]> {
    const fallbackCoords: Record<string, [number, number]> = {
      "chicago": [-87.6298, 41.8781],
      "chicago, il": [-87.6298, 41.8781],
      "detroit": [-83.0458, 42.3314],
      "detroit, mi": [-83.0458, 42.3314],
      "cleveland": [-81.6944, 41.4993],
      "cleveland, oh": [-81.6944, 41.4993],
      "new york": [-74.006, 40.7128],
      "new york, ny": [-74.006, 40.7128],
      "los angeles": [-118.2437, 34.0522],
      "los angeles, ca": [-118.2437, 34.0522],
      "houston": [-95.3698, 29.7604],
      "houston, tx": [-95.3698, 29.7604],
    };

    const normalizedLocation = location.toLowerCase().trim();
    if (fallbackCoords[normalizedLocation]) {
      return fallbackCoords[normalizedLocation];
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        location
      )}&limit=1`,
      {
        headers: {
          "User-Agent":
            "TruckRoutePro/1.0 (ELD Route Planning Application; support@demo)",
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error(`Location not found: ${location}`);
    }
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
  }

  /**
   * Get route segment between two coordinates ([lng, lat])
   */
  private async getRouteSegment(
    startCoords: [number, number],
    endCoords: [number, number]
  ): Promise<{
    coordinates: [number, number][];
    distance: number;
    duration: number;
  }> {
    const url = `${this.OSRM_BASE_URL}/route/v1/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error("No route found between coordinates");
    }

    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates, // still [lng, lat]
      distance: route.distance,
      duration: route.duration,
    };
  }

  /**
   * Generate stops (outputs [lat, lng] for Leaflet)
   */
  private generateStops(
    currentLocation: string,
    pickupLocation: string,
    dropoffLocation: string,
    currentCoords: [number, number],   // already [lat, lng]
    pickupCoords: [number, number],
    dropoffCoords: [number, number],
    totalDistanceMeters: number,
    totalDurationSeconds: number
  ): RouteStop[] {
    const stops: RouteStop[] = [];
    const totalMiles = totalDistanceMeters * 0.000621371;

    let stopId = 1;
    let currentTime = new Date();

    stops.push({
      id: `stop-${stopId++}`,
      type: "pickup",
      location: currentLocation,
      coordinates: currentCoords,
      estimatedTime: this.formatTime(currentTime),
      description: "Current location",
      required: true,
    });

    currentTime = new Date(
      currentTime.getTime() + (totalDurationSeconds / 2) * 1000
    );
    stops.push({
      id: `stop-${stopId++}`,
      type: "pickup",
      location: pickupLocation,
      coordinates: pickupCoords,
      estimatedTime: this.formatTime(currentTime),
      description: "Pickup location",
      duration: 60,
      required: true,
    });

    const fuelStopsNeeded = Math.floor(totalMiles / this.FUEL_INTERVAL_MILES);
    for (let i = 1; i <= fuelStopsNeeded; i++) {
      const ratio = i / (fuelStopsNeeded + 1);
      const stopTime = new Date(
        currentTime.getTime() + (totalDurationSeconds / 2) * ratio * 1000
      );
      stops.push({
        id: `fuel-${i}`,
        type: "fuel",
        location: `Fuel Stop - Mile ${Math.round(totalMiles * ratio)}`,
        coordinates: this.interpolateCoordinates(pickupCoords, dropoffCoords, ratio),
        estimatedTime: this.formatTime(stopTime),
        description: `Fuel stop at mile ${Math.round(totalMiles * ratio)}`,
        duration: 30,
        required: true,
      });
    }

    const drivingHours = totalDurationSeconds / 3600;
    if (drivingHours > 8) {
      const restTime = new Date(currentTime.getTime() + 8 * 3600 * 1000);
      stops.push({
        id: "rest-1",
        type: "rest",
        location: "Required Rest Stop",
        coordinates: this.interpolateCoordinates(pickupCoords, dropoffCoords, 0.6),
        estimatedTime: this.formatTime(restTime),
        description: "Mandatory 10-hour rest period",
        duration: 600,
        required: true,
      });
    }

    const finalTime = new Date(currentTime.getTime() + totalDurationSeconds * 1000);
    stops.push({
      id: `stop-${stopId++}`,
      type: "dropoff",
      location: dropoffLocation,
      coordinates: dropoffCoords,
      estimatedTime: this.formatTime(finalTime),
      description: "Final destination",
      duration: 60,
      required: true,
    });

    return stops;
  }

  private interpolateCoordinates(
    start: [number, number],
    end: [number, number],
    ratio: number
  ): [number, number] {
    return [
      start[0] + (end[0] - start[0]) * ratio,
      start[1] + (end[1] - start[1]) * ratio,
    ];
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
}
