import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import Navigation from '../components/Navigation';
import HOSStatusDashboard from '../components/HOSStatusDashboard';
import TripPlanningForm from '../components/TripPlanningForm';
import RouteMap from '../components/RouteMap';
import FMCSAELDLog from '../components/FMCSAELDLog';
import ComplianceAlerts from '../components/ComplianceAlerts';
import { TripFormData, TripCalculationResult, HOSStatus, Violation } from '../types/trucking';

const Dashboard: React.FC = () => {
  const { toast } = useToast();
  const [currentTripResult, setCurrentTripResult] = useState<TripCalculationResult | null>(null);
  const [selectedLogIndex, setSelectedLogIndex] = useState(0);

  // Mock driver ID - in a real app this would come from authentication
  const driverId = 'c0bf7943-b9b2-47db-9779-b007cb0d7087';
  const driverName = 'John D. Driver';

  // Fetch HOS status
  const { data: hosStatus } = useQuery<HOSStatus>({
    queryKey: ['/api/drivers', driverId, 'hos-status'],
    enabled: true
  });

  // Fetch violations
  const { data: violations = [] } = useQuery<Violation[]>({
    queryKey: ['/api/drivers', driverId, 'violations'],
    enabled: true
  });

  // Trip calculation mutation
  const calculateTripMutation = useMutation({
    mutationFn: async (tripData: TripFormData) => {
      const response = await fetch('/api/trips/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to calculate trip');
      }

      const responseData = await response.json();
      console.log('🔍 API Response received:', {
        hasTrip: !!responseData.trip,
        hasRoute: !!responseData.route,
        routeKeys: responseData.route ? Object.keys(responseData.route) : 'null',
        hasCoordinates: responseData.route?.coordinates?.length || 0,
        hasStops: responseData.route?.stops?.length || 0,
        fullResponse: responseData
      });
      return responseData;
    },
    onSuccess: (data: TripCalculationResult) => {
      console.log('🔍 Setting currentTripResult with:', {
        hasTrip: !!data.trip,
        hasRoute: !!data.route,
        routeData: data.route
      });
      setCurrentTripResult(data);
      setSelectedLogIndex(0);
      toast({
        title: "Route Calculated Successfully",
        description: `Generated ${data.eldLogs.length} daily log(s) for your trip.`,
      });
      
      // Refetch HOS status and violations
      queryClient.invalidateQueries({ queryKey: ['/api/drivers', driverId, 'hos-status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers', driverId, 'violations'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Route Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // PDF export mutation
  const exportPDFMutation = useMutation({
    mutationFn: async (logId: string) => {
      const response = await fetch(`/api/logs/${logId}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to export PDF');
      }
      return response.json();
    },
    onSuccess: (pdfData) => {
      // In a real app, this would trigger PDF download
      console.log('PDF Data:', pdfData);
      toast({
        title: "PDF Export Ready",
        description: "Log sheet data prepared for download.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "PDF Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resolve violation mutation
  const resolveViolationMutation = useMutation({
    mutationFn: async (violationId: string) => {
      const response = await fetch(`/api/violations/${violationId}/resolve`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        throw new Error('Failed to resolve violation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/drivers', driverId, 'violations'] });
      toast({
        title: "Violation Resolved",
        description: "The violation has been marked as resolved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Resolve Violation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTripSubmit = (tripData: TripFormData) => {
    calculateTripMutation.mutate({ ...tripData, driverId });
  };

  const handleExportPDF = (logId: string) => {
    exportPDFMutation.mutate(logId);
  };

  const handleResolveViolation = (violationId: string) => {
    resolveViolationMutation.mutate(violationId);
  };

  const defaultHOSStatus: HOSStatus = {
    driveTimeLeft: "11h 00m",
    onDutyLeft: "14h 00m", 
    cycleUsed: "0h / 70h",
    nextBreak: "8h 00m",
    isCompliant: true
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation driverName={driverName} />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <HOSStatusDashboard hosStatus={hosStatus ?? defaultHOSStatus} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TripPlanningForm
            onSubmit={handleTripSubmit}
            isLoading={calculateTripMutation.isPending}
            driverId={driverId}
          />
          
          <RouteMap
            routeData={currentTripResult?.route}
            isLoading={calculateTripMutation.isPending}
          />
        </div>

        {currentTripResult && (
          <FMCSAELDLog
            logs={currentTripResult.eldLogs}
            driverName={driverName}
            currentLogIndex={selectedLogIndex}
            onExportPDF={handleExportPDF}
            onLogChange={setSelectedLogIndex}
          />
        )}

        <ComplianceAlerts
          violations={violations}
          onResolveViolation={handleResolveViolation}
        />
      </div>
    </div>
  );
};

export default Dashboard;
