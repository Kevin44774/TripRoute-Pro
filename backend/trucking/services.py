"""
Business logic services for the trucking application.
Converted from TypeScript services.
"""

import json
import requests
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
from decimal import Decimal


class RouteCalculator:
    """Handles route calculation using external mapping services"""
    
    def __init__(self):
        self.osrm_base_url = "https://router.project-osrm.org"
        self.nominatim_base_url = "https://nominatim.openstreetmap.org"
    
    def geocode_location(self, location: str) -> Tuple[float, float]:
        """Convert location string to coordinates"""
        try:
            response = requests.get(
                f"{self.nominatim_base_url}/search",
                params={
                    'q': location,
                    'format': 'json',
                    'limit': 1
                },
                headers={'User-Agent': 'TruckRoute-Pro/1.0'},
                timeout=10
            )
            response.raise_for_status()
            
            data = response.json()
            if not data:
                raise Exception(f"Could not find location: {location}")
            
            return float(data[0]['lat']), float(data[0]['lon'])
        except Exception as e:
            raise Exception(f"Geocoding failed for {location}: {str(e)}")
    
    def calculate_route(self, current_location: str, pickup_location: str, dropoff_location: str) -> Dict[str, Any]:
        """Calculate route between locations with stops"""
        try:
            # Geocode all locations
            current_coords = self.geocode_location(current_location)
            pickup_coords = self.geocode_location(pickup_location)
            dropoff_coords = self.geocode_location(dropoff_location)
            
            # Calculate route from current to pickup to dropoff
            waypoints = f"{current_coords[1]},{current_coords[0]};{pickup_coords[1]},{pickup_coords[0]};{dropoff_coords[1]},{dropoff_coords[0]}"
            
            response = requests.get(
                f"{self.osrm_base_url}/route/v1/driving/{waypoints}",
                params={
                    'overview': 'full',
                    'geometries': 'geojson',
                    'steps': 'true'
                },
                timeout=15
            )
            response.raise_for_status()
            
            data = response.json()
            if data.get('code') != 'Ok' or not data.get('routes'):
                raise Exception("No route found between locations")
            
            route = data['routes'][0]
            geometry = route['geometry']['coordinates']
            
            # Calculate total distance and duration
            total_distance = route['distance'] / 1609.34  # Convert meters to miles
            total_duration = route['duration'] / 60  # Convert seconds to minutes
            
            # Generate required stops based on distance
            stops = self._generate_stops(
                current_location, pickup_location, dropoff_location,
                current_coords, pickup_coords, dropoff_coords,
                total_distance, total_duration
            )
            
            return {
                'coordinates': geometry,
                'total_distance': round(total_distance, 2),
                'estimated_duration': round(total_duration),
                'stops': stops
            }
            
        except Exception as e:
            raise Exception(f"Route calculation failed: {str(e)}")
    
    def _generate_stops(self, current_location: str, pickup_location: str, dropoff_location: str,
                       current_coords: Tuple[float, float], pickup_coords: Tuple[float, float], 
                       dropoff_coords: Tuple[float, float], total_distance: float, total_duration: float) -> List[Dict[str, Any]]:
        """Generate required stops for the route"""
        stops = []
        stop_id = 1
        
        # Pickup stop
        stops.append({
            'id': f'pickup-{stop_id}',
            'type': 'pickup',
            'location': pickup_location,
            'coordinates': [pickup_coords[1], pickup_coords[0]],
            'estimated_time': '1 hour',
            'description': 'Load pickup - 1 hour',
            'duration': 60,
            'required': True
        })
        stop_id += 1
        
        # Fuel stops (every 1000 miles)
        fuel_stops_needed = int(total_distance // 1000)
        for i in range(fuel_stops_needed):
            stops.append({
                'id': f'fuel-{stop_id}',
                'type': 'fuel',
                'location': f'Fuel Stop {i + 1}',
                'coordinates': [pickup_coords[1], pickup_coords[0]],  # Approximate location
                'estimated_time': '30 minutes',
                'description': 'Required fuel stop',
                'duration': 30,
                'required': True
            })
            stop_id += 1
        
        # Rest stops for long trips (every 11 hours of driving)
        driving_hours = total_duration / 60
        rest_stops_needed = int(driving_hours // 11)
        for i in range(rest_stops_needed):
            stops.append({
                'id': f'rest-{stop_id}',
                'type': 'rest',
                'location': f'Rest Area {i + 1}',
                'coordinates': [pickup_coords[1], pickup_coords[0]],  # Approximate location
                'estimated_time': '10 hours',
                'description': 'Required 10-hour rest break',
                'duration': 600,
                'required': True
            })
            stop_id += 1
        
        # Dropoff stop
        stops.append({
            'id': f'dropoff-{stop_id}',
            'type': 'dropoff',
            'location': dropoff_location,
            'coordinates': [dropoff_coords[1], dropoff_coords[0]],
            'estimated_time': '1 hour',
            'description': 'Unload delivery - 1 hour',
            'duration': 60,
            'required': True
        })
        
        return stops


class HOSCalculator:
    """Handles Hours of Service calculations and compliance checking"""
    
    def calculate_hos_status(self, time_entries: List[Dict[str, Any]], current_cycle_hours: float) -> Dict[str, Any]:
        """Calculate current HOS status"""
        # Calculate time used today
        driving_minutes = sum(1 for entry in time_entries if entry.get('status') == 'driving') * 60
        on_duty_minutes = sum(1 for entry in time_entries if entry.get('status') in ['driving', 'on-duty']) * 60
        
        # Calculate remaining time
        drive_time_left_minutes = max(0, 11 * 60 - driving_minutes)
        on_duty_left_minutes = max(0, 14 * 60 - on_duty_minutes)
        
        # Calculate cycle usage
        cycle_used_hours = current_cycle_hours + (on_duty_minutes / 60)
        cycle_remaining = max(0, 70 - cycle_used_hours)
        
        # Determine next break requirement
        continuous_driving = 0
        for entry in time_entries:
            if entry.get('status') == 'driving':
                continuous_driving += 1
            else:
                continuous_driving = 0
        
        next_break_minutes = max(0, 8 * 60 - continuous_driving * 60)
        
        # Check compliance
        is_compliant = (
            driving_minutes <= 11 * 60 and
            on_duty_minutes <= 14 * 60 and
            cycle_used_hours <= 70 and
            continuous_driving <= 8
        )
        
        return {
            'drive_time_left': self._format_time(drive_time_left_minutes),
            'on_duty_left': self._format_time(on_duty_left_minutes),
            'cycle_used': f"{cycle_used_hours:.1f}h / 70h",
            'next_break': self._format_time(next_break_minutes),
            'is_compliant': is_compliant
        }
    
    def calculate_violations(self, time_entries: List[Dict[str, Any]], current_cycle_hours: float) -> List[Dict[str, Any]]:
        """Check for HOS violations"""
        violations = []
        
        # Count time usage
        driving_minutes = sum(1 for entry in time_entries if entry.get('status') == 'driving') * 60
        on_duty_minutes = sum(1 for entry in time_entries if entry.get('status') in ['driving', 'on-duty']) * 60
        cycle_used_hours = current_cycle_hours + (on_duty_minutes / 60)
        
        # Check 11-hour driving limit
        if driving_minutes > 11 * 60:
            violations.append({
                'type': 'driving_limit',
                'description': f'Exceeded 11-hour driving limit by {self._format_time(driving_minutes - 11 * 60)}',
                'severity': 'violation'
            })
        
        # Check 14-hour on-duty limit
        if on_duty_minutes > 14 * 60:
            violations.append({
                'type': 'duty_limit',
                'description': f'Exceeded 14-hour on-duty limit by {self._format_time(on_duty_minutes - 14 * 60)}',
                'severity': 'violation'
            })
        
        # Check 70-hour cycle limit
        if cycle_used_hours > 70:
            violations.append({
                'type': 'duty_limit',
                'description': f'Exceeded 70-hour cycle limit by {cycle_used_hours - 70:.1f} hours',
                'severity': 'violation'
            })
        
        # Check 8-hour driving without break
        continuous_driving = 0
        max_continuous = 0
        for entry in time_entries:
            if entry.get('status') == 'driving':
                continuous_driving += 1
                max_continuous = max(max_continuous, continuous_driving)
            else:
                continuous_driving = 0
        
        if max_continuous > 8:
            violations.append({
                'type': 'break_required',
                'description': f'Drove {max_continuous} hours without required 30-minute break',
                'severity': 'violation'
            })
        
        return violations
    
    def _format_time(self, minutes: int) -> str:
        """Format minutes to hours and minutes string"""
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h {mins:02d}m"


class ELDLogGenerator:
    """Generates Electronic Logging Device logs"""
    
    def generate_log_for_trip(self, start_time: datetime, distance_miles: float, driving_hours: float) -> Dict[str, Any]:
        """Generate a single day ELD log"""
        time_entries = []
        remarks = []
        
        current_hour = start_time.hour
        driving_time = int(driving_hours * 60)  # Convert to minutes
        on_duty_time = driving_time + 120  # Add 2 hours for pickup/dropoff
        off_duty_time = 24 * 60 - on_duty_time  # Rest of day off duty
        
        # Generate hourly entries
        for hour in range(24):
            if hour < current_hour:
                status = 'off-duty'
            elif hour < current_hour + 1:  # First hour - pickup
                status = 'on-duty'
                if hour == current_hour:
                    remarks.append(f"{hour:02d}:00 - Begin pickup activities")
            elif hour < current_hour + 1 + driving_hours:  # Driving hours
                status = 'driving'
                if hour == current_hour + 1:
                    remarks.append(f"{hour:02d}:00 - Begin driving")
            elif hour < current_hour + 1 + driving_hours + 1:  # Final hour - dropoff
                status = 'on-duty'
                if hour == int(current_hour + 1 + driving_hours):
                    remarks.append(f"{hour:02d}:00 - Begin dropoff activities")
            else:
                status = 'off-duty'
                if hour == int(current_hour + 1 + driving_hours + 1):
                    remarks.append(f"{hour:02d}:00 - Off duty")
            
            time_entries.append({
                'hour': hour,
                'status': status
            })
        
        return {
            'time_entries': time_entries,
            'driving_time': driving_time,
            'on_duty_time': on_duty_time,
            'off_duty_time': off_duty_time,
            'sleeper_berth_time': 0,
            'remarks': remarks,
            'is_compliant': driving_hours <= 11 and on_duty_time <= 14 * 60
        }
    
    def generate_multi_day_logs(self, start_time: datetime, total_distance: float, 
                               total_driving_hours: float, pickup_location: str, 
                               dropoff_location: str) -> List[Dict[str, Any]]:
        """Generate multiple day ELD logs for long trips"""
        logs = []
        current_date = start_time
        remaining_hours = total_driving_hours
        remaining_distance = total_distance
        
        day_count = 1
        while remaining_hours > 0:
            # Calculate daily driving (max 11 hours)
            daily_driving_hours = min(11, remaining_hours)
            daily_distance = (daily_driving_hours / total_driving_hours) * total_distance
            
            log_data = self.generate_log_for_trip(current_date, daily_distance, daily_driving_hours)
            
            logs.append({
                'date': current_date,
                'daily_miles': round(daily_distance, 2),
                **log_data
            })
            
            remaining_hours -= daily_driving_hours
            remaining_distance -= daily_distance
            current_date += timedelta(days=1)
            day_count += 1
            
            # Add mandatory 10-hour break between driving days
            if remaining_hours > 0:
                # Next day starts after 10-hour break
                current_date = current_date.replace(hour=max(0, (current_date.hour + 10) % 24))
        
        return logs
    
    def export_to_pdf_data(self, log_data: Dict[str, Any], driver_name: str) -> Dict[str, Any]:
        """Export log data in format suitable for PDF generation"""
        return {
            'driver_name': driver_name,
            'date': log_data['date'].strftime('%Y-%m-%d') if isinstance(log_data.get('date'), datetime) else str(log_data.get('date', '')),
            'total_miles': log_data.get('daily_miles', 0),
            'time_entries': log_data.get('time_entries', []),
            'driving_time': f"{log_data.get('driving_time', 0) // 60}h {log_data.get('driving_time', 0) % 60}m",
            'on_duty_time': f"{log_data.get('on_duty_time', 0) // 60}h {log_data.get('on_duty_time', 0) % 60}m",
            'off_duty_time': f"{log_data.get('off_duty_time', 0) // 60}h {log_data.get('off_duty_time', 0) % 60}m",
            'sleeper_berth_time': f"{log_data.get('sleeper_berth_time', 0) // 60}h {log_data.get('sleeper_berth_time', 0) % 60}m",
            'remarks': log_data.get('remarks', [])
        }