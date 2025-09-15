import { RouteStop } from "../types/trucking";

export const formatDistance = (miles: number): string => {
  if (miles < 1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${Math.round(miles)} mi`;
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const getStopIcon = (type: RouteStop['type']): string => {
  switch (type) {
    case 'pickup':
      return 'fas fa-box';
    case 'dropoff':
      return 'fas fa-flag-checkered';
    case 'fuel':
      return 'fas fa-gas-pump';
    case 'rest':
      return 'fas fa-bed';
    case 'break':
      return 'fas fa-pause';
    default:
      return 'fas fa-map-marker-alt';
  }
};

export const getStopColor = (type: RouteStop['type']): string => {
  switch (type) {
    case 'pickup':
      return 'text-blue-600';
    case 'dropoff':
      return 'text-green-600';
    case 'fuel':
      return 'text-orange-500';
    case 'rest':
      return 'text-red-500';
    case 'break':
      return 'text-yellow-500';
    default:
      return 'text-gray-500';
  }
};

export const getStopBorderColor = (type: RouteStop['type']): string => {
  switch (type) {
    case 'pickup':
      return 'border-blue-600';
    case 'dropoff':
      return 'border-green-600';
    case 'fuel':
      return 'border-orange-500';
    case 'rest':
      return 'border-red-500';
    case 'break':
      return 'border-yellow-500';
    default:
      return 'border-gray-500';
  }
};

export const calculateTotalTripTime = (stops: RouteStop[]): number => {
  if (stops.length < 2) return 0;
  
  const startTime = new Date(`2024-01-01 ${stops[0].estimatedTime}`);
  const endTime = new Date(`2024-01-01 ${stops[stops.length - 1].estimatedTime}`);
  
  let diffMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  
  // Handle day overflow
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }
  
  return diffMinutes;
};

export const getNextStop = (stops: RouteStop[]): RouteStop | null => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  
  for (const stop of stops) {
    if (stop.estimatedTime > currentTime) {
      return stop;
    }
  }
  
  return null;
};

export const isStopPassed = (stop: RouteStop): boolean => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  return stop.estimatedTime < currentTime;
};

export const calculateFuelStops = (totalMiles: number): number => {
  const FUEL_RANGE = 1000; // miles per fuel stop
  return Math.floor(totalMiles / FUEL_RANGE);
};

export const calculateRequiredRestStops = (drivingHours: number): number => {
  const MAX_DRIVING_HOURS = 11;
  return Math.max(0, Math.ceil(drivingHours / MAX_DRIVING_HOURS) - 1);
};

export const estimateArrivalTime = (startTime: Date, durationMinutes: number): Date => {
  return new Date(startTime.getTime() + durationMinutes * 60 * 1000);
};

/**
 * Escapes HTML characters to prevent XSS attacks
 * @param text - The text to escape
 * @returns The escaped text safe for HTML insertion
 */
export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Creates safe popup content for map markers using escaped user input
 * @param stop - The route stop data
 * @returns Safe HTML content for the popup
 */
export const createSafePopupContent = (stop: { location: string; description: string; estimatedTime: string; duration?: number }): string => {
  const safeLocation = escapeHtml(stop.location);
  const safeDescription = escapeHtml(stop.description);
  const safeEstimatedTime = escapeHtml(stop.estimatedTime);
  
  return `
    <div class="p-2">
      <h3 class="font-semibold text-sm">${safeLocation}</h3>
      <p class="text-xs text-gray-600">${safeDescription}</p>
      <p class="text-xs font-medium mt-1">ETA: ${safeEstimatedTime}</p>
      ${stop.duration ? `<p class="text-xs">Duration: ${formatDuration(stop.duration)}</p>` : ''}
    </div>
  `;
};

/**
 * Creates safe icon HTML for map markers with validated CSS classes
 * @param type - The stop type
 * @returns Safe HTML for the icon marker
 */
export const createSafeIconHtml = (type: RouteStop['type']): string => {
  // Get validated CSS classes from utility functions
  const borderColor = getStopBorderColor(type);
  const iconClass = getStopIcon(type);
  const iconColor = getStopColor(type);
  
  // Since utility functions return predefined classes, this should be safe
  // but we're being extra defensive by ensuring the classes are valid CSS class names
  const safeBorderColor = escapeHtml(borderColor);
  const safeIconClass = escapeHtml(iconClass);
  const safeIconColor = escapeHtml(iconColor);
  
  return `
    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2 ${safeBorderColor} shadow-lg">
      <i class="${safeIconClass} ${safeIconColor} text-sm"></i>
    </div>
  `;
};
