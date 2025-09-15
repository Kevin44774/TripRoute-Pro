// src/components/RouteMap.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, MapPin, Clock, Route, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getAccessibleMotionProps } from "@/lib/motion";
import { useMotion } from "@/components/ui/motion-provider";

import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  Pane,
} from "react-leaflet";
import L from "leaflet";

// Turf for snapping stops to the route
import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";

import { RouteData } from "../types/trucking";
import {
  formatDistance,
  formatDuration,
  getStopIcon,
  getStopColor,
} from "../lib/routeUtils";

/* ---------------- coord utils (EXTRA SAFE) ---------------- */

type LatLng = [number, number]; // [lat, lng]
type LngLat = [number, number]; // [lng, lat]

function sanitizeNumString(s: string): string {
  // normalize unicode minus and remove thousands commas/spaces
  return s.replace(/\u2212/g, "-").replace(/,/g, "").trim();
}
function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(sanitizeNumString(v));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Accepts:
// - [lat,lng] or [lng,lat]
// - {lat,lng} or {latitude,longitude}
// -> returns [lat,lng] or null
function toLatLngAnySafe(c: unknown): LatLng | null {
  if (Array.isArray(c) && c.length >= 2) {
    const a = toNum(c[0]);
    const b = toNum(c[1]);
    if (a === null || b === null) return null;
    // if first can't be latitude (abs>90) OR second can't be longitude (abs>180), treat as [lng,lat]
    if (Math.abs(a) > 90 || Math.abs(b) > 180) return [b, a];
    return [a, b];
  }

  if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    const latV = o.lat ?? o.latitude ?? o.Lat ?? o.Latitude;
    const lngV = o.lng ?? o.lon ?? o.long ?? o.longitude ?? o.Lng ?? o.Longitude;
    const lat = toNum(latV);
    const lng = toNum(lngV);
    if (lat == null || lng == null) return null;
    return [lat, lng];
  }

  return null;
}

function toLngLat([lat, lng]: LatLng): LngLat {
  return [lng, lat];
}

/* ---------------- marker icons ---------------- */

function makeBadgeIcon(letter: string, color: string) {
  const html = `<div class="marker-badge ${color}">${letter}</div>`;
  return L.divIcon({
    html,
    className: "custom-stop-marker",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

const stopIcons: Record<string, L.DivIcon> = {
  pickup: makeBadgeIcon("P", "blue"),
  dropoff: makeBadgeIcon("D", "green"),
  fuel: makeBadgeIcon("F", "orange"),
  rest: makeBadgeIcon("R", "red"),
};

interface RouteMapProps {
  routeData?: RouteData;
  isLoading?: boolean;
}

const RouteMap: React.FC<RouteMapProps> = ({ routeData, isLoading = false }) => {
  const { reducedMotion } = useMotion();
  const [isSummaryOpen, setIsSummaryOpen] = React.useState(true);

  /* ---------- memoized, validated route geometry ---------- */
  const routeLatLngs = React.useMemo<LatLng[]>(
    () =>
      (routeData?.coordinates ?? [])
        .map(toLatLngAnySafe)
        .filter((v): v is LatLng => Array.isArray(v)),
    [routeData?.coordinates]
  );

  // Build Turf line (needs [lng,lat]) only if we have 2+ valid points
  const routeLine = React.useMemo(
    () =>
      routeLatLngs.length > 1
        ? lineString(routeLatLngs.map((ll) => toLngLat(ll)))
        : null,
    [routeLatLngs]
  );

  // Normalize & snap stop to route (if possible)
const snapToRouteLatLng = React.useCallback(
  (raw: unknown): LatLng | null => {
    const ll = toLatLngAnySafe(raw);
    if (!ll) return null;
    if (!routeLine) return ll;

    const [lat, lng] = ll;

    // Final guards: must be finite numbers
    if (
      typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng)
    ) {
      return null; // skip this stop entirely
    }

    // Turf requires all route coords to be numeric too — quick guard
    const routeOk =
      Array.isArray(routeLine.geometry?.coordinates) &&
      routeLine.geometry.coordinates.every(
        (p: any) =>
          Array.isArray(p) &&
          p.length >= 2 &&
          typeof p[0] === "number" &&
          typeof p[1] === "number" &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1])
      );
    if (!routeOk) return ll;

    try {
      // Use interpolation along segments
      const snapped = nearestPointOnLine(
        routeLine,
        point([lng, lat]),
        { units: "meters" }
      );

      const coords = snapped?.geometry?.coordinates;
      if (
        !Array.isArray(coords) ||
        coords.length < 2 ||
        typeof coords[0] !== "number" ||
        typeof coords[1] !== "number" ||
        !Number.isFinite(coords[0]) ||
        !Number.isFinite(coords[1])
      ) {
        return ll; // fallback to original position
      }

      const [sLng, sLat] = coords as [number, number];
      return [sLat, sLng];
    } catch {
      // If Turf chokes on anything, just use the original normalized point
      return ll;
    }
  },
  [routeLine]
);

  /* ---------- map bounds handler ---------- */
  const MapBoundsHandler: React.FC<{ coordinates: unknown[] }> = ({
    coordinates,
  }) => {
    const map = useMap();
    React.useEffect(() => {
      const latLngs = (coordinates ?? [])
        .map(toLatLngAnySafe)
        .filter((v): v is LatLng => Array.isArray(v));
      if (!latLngs.length) return;
      if (latLngs.length > 1) {
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 12 });
      } else {
        map.setView(latLngs[0], 10);
      }
    }, [coordinates, map]);
    return null;
  };

  /* ---------- skeleton/stat UI ---------- */
  const MapSkeleton = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-96 w-full rounded-md" />
    </div>
  );

  const RouteStats = ({ routeData }: { routeData: RouteData }) => {
    const requiredStops = routeData.stops.filter((s) => s.required).length;
    const stats = [
      { icon: Route, label: "Distance", value: formatDistance(routeData.totalDistance), color: "text-blue-600" },
      { icon: Clock, label: "Duration", value: formatDuration(routeData.estimatedDuration), color: "text-green-600" },
      { icon: MapPin, label: "Stops", value: `${routeData.stops.length} total`, color: "text-orange-600" },
      { icon: Navigation, label: "Required", value: `${requiredStops} stops`, color: "text-red-600" },
    ];
    return (
      <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4" {...getAccessibleMotionProps("staggerChildren", reducedMotion)}>
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            {...getAccessibleMotionProps("fadeUp", reducedMotion)}
            transition={{ delay: reducedMotion ? 0 : index * 0.1 }}
            className="bg-background border rounded-lg p-3 text-center"
          >
            <stat.icon className={`${stat.color} h-5 w-5 mx-auto mb-1`} />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-sm font-semibold">{stat.value}</p>
          </motion.div>
        ))}
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <motion.div {...getAccessibleMotionProps("fadeUp", reducedMotion)}>
        <Card className="p-6">
          <MapSkeleton />
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div {...getAccessibleMotionProps("fadeUp", reducedMotion)}>
      <Card className="p-6">
        <Collapsible open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <div className="flex items-center space-x-2">
                <MapPin className="text-primary h-5 w-5" />
                <h2 className="text-xl font-semibold">Route Overview</h2>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isSummaryOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            {routeData && <RouteStats routeData={routeData} />}
          </CollapsibleContent>
        </Collapsible>

        <div className="map-wrapper relative h-96 border border-border rounded-md overflow-hidden mt-4">
          {routeData ? (
            <MapContainer className="h-full w-full" center={[39.8283, -98.5795]} zoom={4} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

              <MapBoundsHandler coordinates={routeData.coordinates as unknown[]} />

              {/* Route BELOW markers */}
              <Pane name="route" style={{ zIndex: 350 }}>
                <Polyline
                  positions={routeLatLngs}
                  pathOptions={{ color: "#1f4b99", weight: 4, lineJoin: "round", lineCap: "round" }}
                  pane="route"
                  interactive={false}
                />
              </Pane>

              {/* Markers in default marker pane */}
              {routeData.stops.map((stop) => {
                const pos = snapToRouteLatLng(stop.coordinates);
                if (!pos) return null; // skip invalid stop
                return (
                  <Marker key={stop.id} position={pos} icon={stopIcons[stop.type] ?? stopIcons.pickup} riseOnHover zIndexOffset={10000}>
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold text-sm">{stop.type} — {stop.location}</h3>
                        <p className="text-xs text-gray-600">{stop.description}</p>
                        {stop.estimatedTime && <p className="text-xs font-medium mt-1">ETA: {stop.estimatedTime}</p>}
                        {"duration" in stop && stop.duration ? <p className="text-xs">Duration: {formatDuration(stop.duration as number)}</p> : null}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">Route will appear here after calculation</div>
          )}
        </div>

        <AnimatePresence>
          {routeData && routeData.stops.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Navigation className="h-5 w-5 text-primary mr-2" /> Trip Stops
              </h3>
              <div className="space-y-3">
                {routeData.stops.map((stop) => (
                  <div key={stop.id} className="flex items-center justify-between p-4 rounded-lg border-l-4">
                    <div className="flex items-center space-x-3">
                      <i className={`${getStopIcon(stop.type)} ${getStopColor(stop.type)} text-lg`} />
                      <div>
                        <span className="font-medium">{stop.location}</span>
                        <p className="text-sm text-muted-foreground">{stop.description}</p>
                        {"duration" in stop && stop.duration ? (
                          <p className="text-xs text-muted-foreground">Duration: {formatDuration(stop.duration as number)}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-sm">{stop.estimatedTime}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};

export default RouteMap;
