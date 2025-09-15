"""
Django REST Framework views for the trucking application.
Converted from Express.js routes.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import datetime

from .models import Driver, Trip, EldLog, HosViolation
from .serializers import (
    DriverSerializer, TripSerializer, EldLogSerializer, 
    HosViolationSerializer, TripCalculationSerializer, HOSStatusSerializer
)
from .services import RouteCalculator, HOSCalculator, ELDLogGenerator


class DriverViewSet(viewsets.ModelViewSet):
    """ViewSet for Driver operations"""
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer
    
    @action(detail=False, methods=['get'], url_path='license/(?P<license_number>[^/.]+)')
    def by_license(self, request, license_number=None):
        """Get driver by license number"""
        try:
            driver = Driver.objects.get(license_number=license_number)
            serializer = self.get_serializer(driver)
            return Response(serializer.data)
        except Driver.DoesNotExist:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['get'], url_path='hos-status')
    def hos_status(self, request, pk=None):
        """Get HOS status for a driver"""
        driver = self.get_object()
        hos_calculator = HOSCalculator()
        
        # Get latest log for current status
        latest_log = EldLog.objects.filter(driver=driver).order_by('-log_date').first()
        
        if latest_log and latest_log.time_entries:
            hos_status = hos_calculator.calculate_hos_status(
                latest_log.time_entries,
                float(driver.current_cycle_hours)
            )
        else:
            # Default status for new driver
            hos_status = {
                'drive_time_left': "11h 00m",
                'on_duty_left': "14h 00m", 
                'cycle_used': f"{driver.current_cycle_hours}h / 70h",
                'next_break': "8h 00m",
                'is_compliant': True
            }
        
        serializer = HOSStatusSerializer(hos_status)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def violations(self, request, pk=None):
        """Get active violations for a driver"""
        driver = self.get_object()
        violations = HosViolation.objects.filter(driver=driver, resolved=False).order_by('-timestamp')
        serializer = HosViolationSerializer(violations, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def trips(self, request, pk=None):
        """Get trips for a driver"""
        driver = self.get_object()
        trips = Trip.objects.filter(driver=driver).order_by('-created_at')
        serializer = TripSerializer(trips, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Get ELD logs for a driver"""
        driver = self.get_object()
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = EldLog.objects.filter(driver=driver)
        
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            queryset = queryset.filter(log_date__gte=start_date)
        
        if end_date:
            end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            queryset = queryset.filter(log_date__lte=end_date)
        
        logs = queryset.order_by('-log_date')
        serializer = EldLogSerializer(logs, many=True)
        return Response(serializer.data)


class TripViewSet(viewsets.ModelViewSet):
    """ViewSet for Trip operations"""
    queryset = Trip.objects.all()
    serializer_class = TripSerializer
    
    def perform_create(self, serializer):
        """Create trip with driver lookup"""
        driver_id = self.request.data.get('driver_id')
        driver = get_object_or_404(Driver, id=driver_id)
        serializer.save(driver=driver)
    
    @action(detail=False, methods=['post'])
    def calculate(self, request):
        """Calculate route and generate ELD logs"""
        serializer = TripCalculationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'error': 'Invalid trip data', 'details': serializer.errors}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        
        try:
            # Get driver
            driver = get_object_or_404(Driver, id=data['driver_id'])
            
            # Calculate route
            route_calculator = RouteCalculator()
            route_data = route_calculator.calculate_route(
                data['current_location'],
                data['pickup_location'],
                data['dropoff_location']
            )
            
            # Create trip record
            trip = Trip.objects.create(
                driver=driver,
                current_location=data['current_location'],
                pickup_location=data['pickup_location'],
                dropoff_location=data['dropoff_location'],
                estimated_weight=data['estimated_weight'],
                total_distance=route_data['total_distance'],
                estimated_duration=route_data['estimated_duration'],
                route_data=route_data
            )
            
            # Generate ELD logs
            eld_log_generator = ELDLogGenerator()
            driving_hours = route_data['estimated_duration'] / 60  # Convert minutes to hours
            start_time = timezone.now()
            
            if driving_hours > 11:
                # Multi-day trip
                eld_logs_data = eld_log_generator.generate_multi_day_logs(
                    start_time,
                    route_data['total_distance'],
                    driving_hours,
                    data['pickup_location'],
                    data['dropoff_location']
                )
            else:
                # Single day trip
                single_log = eld_log_generator.generate_log_for_trip(
                    start_time,
                    route_data['total_distance'],
                    driving_hours
                )
                eld_logs_data = [{
                    'date': start_time,
                    'daily_miles': route_data['total_distance'],
                    **single_log
                }]
            
            # Store ELD logs in database
            saved_logs = []
            for log_data in eld_logs_data:
                eld_log = EldLog.objects.create(
                    driver=driver,
                    trip=trip,
                    log_date=log_data['date'],
                    total_miles=log_data['daily_miles'],
                    driving_time=log_data['driving_time'],
                    on_duty_time=log_data['on_duty_time'],
                    off_duty_time=log_data['off_duty_time'],
                    sleeper_berth_time=log_data['sleeper_berth_time'],
                    time_entries=log_data['time_entries'],
                    remarks='\n'.join(log_data['remarks']),
                    is_compliant=log_data['is_compliant']
                )
                saved_logs.append(eld_log)
            
            # Calculate HOS status
            hos_calculator = HOSCalculator()
            current_time_entries = eld_logs_data[0]['time_entries'] if eld_logs_data else []
            hos_status = hos_calculator.calculate_hos_status(
                current_time_entries, 
                float(data['current_cycle_hours'])
            )
            
            # Check for violations
            violations_data = hos_calculator.calculate_violations(
                current_time_entries, 
                float(data['current_cycle_hours'])
            )
            
            saved_violations = []
            for violation in violations_data:
                hos_violation = HosViolation.objects.create(
                    driver=driver,
                    trip=trip,
                    violation_type=violation['type'],
                    description=violation['description'],
                    severity=violation['severity']
                )
                saved_violations.append(hos_violation)
            
            # Serialize response data
            trip_serializer = TripSerializer(trip)
            eld_logs_serializer = EldLogSerializer(saved_logs, many=True)
            violations_serializer = HosViolationSerializer(saved_violations, many=True)
            hos_status_serializer = HOSStatusSerializer(hos_status)
            
            return Response({
                'trip': trip_serializer.data,
                'route': route_data,
                'eld_logs': eld_logs_serializer.data,
                'hos_status': hos_status_serializer.data,
                'violations': violations_serializer.data
            })
            
        except Exception as e:
            # Provide more specific error messages
            error_message = "Failed to calculate route"
            user_friendly_message = "Please check your locations and try again"
            
            error_str = str(e)
            if "Could not find location" in error_str:
                error_message = "Location not found"
                user_friendly_message = "One or more locations could not be found. Please check spelling and try common city names."
            elif "Geocoding failed" in error_str:
                error_message = "Address lookup service temporarily unavailable" 
                user_friendly_message = "Our address lookup service is temporarily busy. Please try again in a moment or use major city names."
            elif "No route found" in error_str:
                error_message = "No route available"
                user_friendly_message = "No driving route could be found between these locations. Please check the addresses."
            
            return Response({
                'error': error_message,
                'details': user_friendly_message,
                'original_error': error_str
            }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """Get ELD logs for a trip"""
        trip = self.get_object()
        logs = EldLog.objects.filter(trip=trip).order_by('-log_date')
        serializer = EldLogSerializer(logs, many=True)
        return Response(serializer.data)


class EldLogViewSet(viewsets.ModelViewSet):
    """ViewSet for ELD Log operations"""
    queryset = EldLog.objects.all()
    serializer_class = EldLogSerializer
    
    def perform_create(self, serializer):
        """Create ELD log with driver and trip lookup"""
        driver_id = self.request.data.get('driver_id')
        trip_id = self.request.data.get('trip_id')
        
        driver = get_object_or_404(Driver, id=driver_id)
        trip = None
        if trip_id:
            trip = get_object_or_404(Trip, id=trip_id)
        
        serializer.save(driver=driver, trip=trip)
    
    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        """Get PDF export data for a log"""
        log = self.get_object()
        driver = log.driver
        
        eld_log_generator = ELDLogGenerator()
        pdf_data = eld_log_generator.export_to_pdf_data({
            'date': log.log_date,
            'time_entries': log.time_entries,
            'driving_time': log.driving_time,
            'on_duty_time': log.on_duty_time,
            'off_duty_time': log.off_duty_time,
            'sleeper_berth_time': log.sleeper_berth_time,
            'remarks': log.remarks.split('\n') if log.remarks else [],
            'daily_miles': float(log.total_miles)
        }, driver.name)
        
        return Response(pdf_data)


class HosViolationViewSet(viewsets.ModelViewSet):
    """ViewSet for HOS Violation operations"""
    queryset = HosViolation.objects.all()
    serializer_class = HosViolationSerializer
    
    def perform_create(self, serializer):
        """Create violation with driver and trip lookup"""
        driver_id = self.request.data.get('driver_id')
        trip_id = self.request.data.get('trip_id')
        
        driver = get_object_or_404(Driver, id=driver_id)
        trip = None
        if trip_id:
            trip = get_object_or_404(Trip, id=trip_id)
        
        serializer.save(driver=driver, trip=trip)
    
    @action(detail=True, methods=['patch'])
    def resolve(self, request, pk=None):
        """Resolve a violation"""
        violation = self.get_object()
        violation.resolved = True
        violation.save()
        return Response({'success': True})