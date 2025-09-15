"""
Django REST Framework serializers for the trucking application.
"""

from rest_framework import serializers
from .models import Driver, Trip, EldLog, HosViolation


class DriverSerializer(serializers.ModelSerializer):
    """Serializer for Driver model"""
    
    class Meta:
        model = Driver
        fields = ['id', 'name', 'license_number', 'current_cycle_hours', 'created_at']
        read_only_fields = ['id', 'created_at']


class TripSerializer(serializers.ModelSerializer):
    """Serializer for Trip model"""
    driver_id = serializers.UUIDField(write_only=True)
    driver = DriverSerializer(read_only=True)
    
    class Meta:
        model = Trip
        fields = [
            'id', 'driver_id', 'driver', 'current_location', 'pickup_location', 
            'dropoff_location', 'estimated_weight', 'total_distance', 
            'estimated_duration', 'route_data', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EldLogSerializer(serializers.ModelSerializer):
    """Serializer for ELD Log model"""
    driver_id = serializers.UUIDField(write_only=True)
    trip_id = serializers.UUIDField(write_only=True, required=False)
    driver = DriverSerializer(read_only=True)
    trip = TripSerializer(read_only=True)
    
    class Meta:
        model = EldLog
        fields = [
            'id', 'driver_id', 'trip_id', 'driver', 'trip', 'log_date', 
            'total_miles', 'driving_time', 'on_duty_time', 'off_duty_time', 
            'sleeper_berth_time', 'time_entries', 'remarks', 'is_compliant', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class HosViolationSerializer(serializers.ModelSerializer):
    """Serializer for HOS Violation model"""
    driver_id = serializers.UUIDField(write_only=True)
    trip_id = serializers.UUIDField(write_only=True, required=False)
    driver = DriverSerializer(read_only=True)
    trip = TripSerializer(read_only=True)
    
    class Meta:
        model = HosViolation
        fields = [
            'id', 'driver_id', 'trip_id', 'driver', 'trip', 'violation_type', 
            'description', 'severity', 'timestamp', 'resolved'
        ]
        read_only_fields = ['id', 'timestamp']


class TripCalculationSerializer(serializers.Serializer):
    """Serializer for trip calculation request"""
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_hours = serializers.DecimalField(max_digits=4, decimal_places=2, min_value=0, max_value=70)
    estimated_weight = serializers.IntegerField(default=80000, min_value=1000, max_value=80000)
    driver_id = serializers.UUIDField()


class HOSStatusSerializer(serializers.Serializer):
    """Serializer for HOS status response"""
    drive_time_left = serializers.CharField()
    on_duty_left = serializers.CharField()
    cycle_used = serializers.CharField()
    next_break = serializers.CharField()
    is_compliant = serializers.BooleanField()