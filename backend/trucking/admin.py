from django.contrib import admin
from .models import Driver, Trip, EldLog, HosViolation


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ['name', 'license_number', 'current_cycle_hours', 'created_at']
    search_fields = ['name', 'license_number']
    list_filter = ['created_at']


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ['id', 'driver', 'pickup_location', 'dropoff_location', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['pickup_location', 'dropoff_location', 'driver__name']


@admin.register(EldLog)
class EldLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'driver', 'log_date', 'total_miles', 'is_compliant', 'created_at']
    list_filter = ['is_compliant', 'log_date', 'created_at']
    search_fields = ['driver__name']


@admin.register(HosViolation)
class HosViolationAdmin(admin.ModelAdmin):
    list_display = ['id', 'driver', 'violation_type', 'severity', 'resolved', 'timestamp']
    list_filter = ['violation_type', 'severity', 'resolved', 'timestamp']
    search_fields = ['driver__name', 'description']