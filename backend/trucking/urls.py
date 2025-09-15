"""
URL configuration for the trucking application.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'drivers', views.DriverViewSet)
router.register(r'trips', views.TripViewSet)
router.register(r'logs', views.EldLogViewSet, basename='eldlog')
router.register(r'violations', views.HosViolationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]