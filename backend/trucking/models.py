"""
Django models for the trucking application.
Converted from TypeScript/Drizzle schema.
"""

import uuid
from django.db import models
from django.utils import timezone


class Driver(models.Model):
    """Driver model - represents a truck driver"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    license_number = models.TextField(unique=True)
    current_cycle_hours = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.name} ({self.license_number})"

    class Meta:
        db_table = 'drivers'


class Trip(models.Model):
    """Trip model - represents a planned or active trip"""
    STATUS_CHOICES = [
        ('planned', 'Planned'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, db_column='driver_id')
    current_location = models.TextField()
    pickup_location = models.TextField()
    dropoff_location = models.TextField()
    estimated_weight = models.IntegerField(default=80000)
    total_distance = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    estimated_duration = models.IntegerField(null=True, blank=True)  # in minutes
    route_data = models.JSONField(null=True, blank=True)  # stores route coordinates and stops
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planned')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Trip {self.id} - {self.pickup_location} to {self.dropoff_location}"

    class Meta:
        db_table = 'trips'


class EldLog(models.Model):
    """ELD Log model - represents daily logging device records"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, db_column='driver_id')
    trip = models.ForeignKey(Trip, on_delete=models.SET_NULL, null=True, blank=True, db_column='trip_id')
    log_date = models.DateTimeField()
    total_miles = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    driving_time = models.IntegerField(default=0)  # in minutes
    on_duty_time = models.IntegerField(default=0)  # in minutes
    off_duty_time = models.IntegerField(default=0)  # in minutes
    sleeper_berth_time = models.IntegerField(default=0)  # in minutes
    time_entries = models.JSONField()  # hour-by-hour status entries
    remarks = models.TextField(blank=True)
    is_compliant = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"ELD Log {self.log_date.date()} - {self.driver.name}"

    class Meta:
        db_table = 'eld_logs'
        ordering = ['-log_date']


class HosViolation(models.Model):
    """HOS Violation model - represents Hours of Service violations"""
    VIOLATION_TYPES = [
        ('driving_limit', 'Driving Limit'),
        ('duty_limit', 'Duty Limit'),
        ('break_required', 'Break Required'),
    ]
    
    SEVERITY_CHOICES = [
        ('warning', 'Warning'),
        ('violation', 'Violation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    driver = models.ForeignKey(Driver, on_delete=models.CASCADE, db_column='driver_id')
    trip = models.ForeignKey(Trip, on_delete=models.SET_NULL, null=True, blank=True, db_column='trip_id')
    violation_type = models.CharField(max_length=50, choices=VIOLATION_TYPES)
    description = models.TextField()
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='warning')
    timestamp = models.DateTimeField(default=timezone.now)
    resolved = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.violation_type} - {self.driver.name} ({self.severity})"

    class Meta:
        db_table = 'hos_violations'
        ordering = ['-timestamp']