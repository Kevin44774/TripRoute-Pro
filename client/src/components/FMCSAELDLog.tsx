import React, { useRef, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Download, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { ELDLogData, TimeEntry } from '../types/trucking';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';

interface FMCSAELDLogProps {
  logs: ELDLogData[];
  driverName: string;
  currentLogIndex?: number;
  onExportPDF?: (logId: string) => void;
  onLogChange?: (index: number) => void;
}

type DrawingMode = 'off-duty' | 'sleeper' | 'driving' | 'on-duty' | 'erase';

const STATUS_COLORS = {
  'off-duty': '#10B981',    // Green
  'sleeper': '#3B82F6',     // Blue  
  'driving': '#EF4444',     // Red
  'on-duty': '#F59E0B'      // Amber
};

const STATUS_LABELS = {
  'off-duty': '1. Off Duty',
  'sleeper': '2. Sleeper Berth',
  'driving': '3. Driving',
  'on-duty': '4. On-Duty (Not Driving)'
};

// FMCSA Time Zones
const TIME_ZONES = [
  'America/New_York',     // Eastern
  'America/Chicago',      // Central
  'America/Denver',       // Mountain
  'America/Los_Angeles',  // Pacific
  'America/Anchorage',    // Alaska
  'Pacific/Honolulu'      // Hawaii
];

const FMCSAELDLog: React.FC<FMCSAELDLogProps> = ({
  logs,
  driverName,
  currentLogIndex = 0,
  onExportPDF,
  onLogChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLogIndex, setSelectedLogIndex] = useState(currentLogIndex);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('driving');
  const [isDrawing, setIsDrawing] = useState(false);
  const { toast } = useToast();
  
  // Editable fields - these would be bound to the ELD log data
  const [editableData, setEditableData] = useState({
    remarks: '',
    totalMiles: '0',
    coDriverName: '',
    carrierName: '',
    dotNumber: '',
    timeZone: 'America/New_York',
    truckNumber: '',
    trailerNumbers: '',
    shippingDocNumbers: '',
    mainOfficeAddress: '',
    timeEntries: [] as TimeEntry[]
  });
  
  const currentLog = logs[selectedLogIndex];

  // Initialize editable data when log changes
  useEffect(() => {
    if (currentLog) {
      setEditableData({
        remarks: currentLog.remarks || '',
        totalMiles: currentLog.totalMiles?.toString() || '0',
        coDriverName: currentLog.coDriverName || '',
        carrierName: currentLog.carrierName || '',
        dotNumber: currentLog.dotNumber || '',
        timeZone: currentLog.timeZone || 'America/New_York',
        truckNumber: currentLog.truckNumber || '',
        trailerNumbers: currentLog.trailerNumbers || '',
        shippingDocNumbers: currentLog.shippingDocNumbers || '',
        mainOfficeAddress: currentLog.mainOfficeAddress || '',
        timeEntries: currentLog.timeEntries || initializeQuarterHourEntries()
      });
      drawLogSheet();
    }
  }, [currentLog, selectedLogIndex]);

  // Redraw canvas when time entries change
  useEffect(() => {
    drawLogSheet();
  }, [editableData.timeEntries]);

  // Initialize 96 quarter-hour entries (all off-duty by default)
  const initializeQuarterHourEntries = (): TimeEntry[] => {
    return Array.from({ length: 96 }, (_, i) => ({
      quarterHour: i,
      status: 'off-duty' as const,
      description: ''
    }));
  };

  // Mutation to save log changes
  const updateLogMutation = useMutation({
    mutationFn: async (updatedLog: Partial<ELDLogData>) => {
      return await apiRequest(`/api/logs/${currentLog?.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedLog)
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "ELD log updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/drivers', currentLog?.driverId || '', 'logs'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save log changes",
        variant: "destructive"
      });
      console.error('Failed to update log:', error);
    }
  });

  const handleSaveLog = () => {
    if (!currentLog) return;

    const totals = calculateTotals();
    const updatedLog = {
      ...editableData,
      drivingTime: totals.driving,
      onDutyTime: totals.onDuty,
      offDutyTime: totals.offDuty,
      sleeperBerthTime: totals.sleeper,
      isCompliant: checkCompliance(totals)
    };

    updateLogMutation.mutate(updatedLog);
  };

  const drawLogSheet = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas size for proper resolution (96 quarter-hours)
    canvas.width = 1440; // 15 pixels per quarter-hour
    canvas.height = 320;
    canvas.style.width = '100%';
    canvas.style.height = '320px';

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);
    
    // Draw existing log entries
    drawLogEntries(ctx, canvas.width, canvas.height);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    // Draw horizontal lines for each status row
    const rowHeight = height / 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * rowHeight);
      ctx.lineTo(width, i * rowHeight);
      ctx.stroke();
    }

    // Draw vertical lines for quarter-hours (96 total)
    const quarterWidth = width / 96;
    for (let i = 0; i <= 96; i++) {
      const x = i * quarterWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      
      // Make hour lines thicker
      if (i % 4 === 0) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = '#f3f4f6';
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
    }
    
    // Reset stroke style
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
  };

  const drawLogEntries = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const quarterWidth = width / 96;
    const rowHeight = height / 4;
    const statusRows = { 'off-duty': 0, 'sleeper': 1, 'driving': 2, 'on-duty': 3 };

    ctx.lineWidth = 4;
    
    // Draw continuous lines for each status
    Object.entries(statusRows).forEach(([status, rowIndex]) => {
      ctx.strokeStyle = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
      const y = (rowIndex * rowHeight) + (rowHeight / 2);
      
      let currentSegmentStart = -1;

      for (let quarter = 0; quarter < 96; quarter++) {
        const entry = editableData.timeEntries[quarter];
        const isActive = entry?.status === status;
        const x = quarter * quarterWidth + (quarterWidth / 2);

        if (isActive && currentSegmentStart === -1) {
          // Start new segment
          currentSegmentStart = x;
        } else if (!isActive && currentSegmentStart !== -1) {
          // End current segment and draw line
          ctx.beginPath();
          ctx.moveTo(currentSegmentStart, y);
          ctx.lineTo(x, y);
          ctx.stroke();
          currentSegmentStart = -1;
        }
      }

      // Complete line if still active at end of day
      if (currentSegmentStart !== -1) {
        ctx.beginPath();
        ctx.moveTo(currentSegmentStart, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentLog || drawingMode === 'erase') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    // Calculate which quarter-hour and status row was clicked
    const quarterHour = Math.floor(x / (canvas.width / 96));
    const statusRowIndex = Math.floor(y / (canvas.height / 4));
    const statusOrder = ['off-duty', 'sleeper', 'driving', 'on-duty'];
    const clickedStatus = statusOrder[statusRowIndex];

    if (quarterHour >= 0 && quarterHour < 96 && clickedStatus) {
      // Update the time entry
      const newTimeEntries = [...editableData.timeEntries];
      newTimeEntries[quarterHour] = {
        quarterHour,
        status: clickedStatus as any,
        description: ''
      };
      
      setEditableData(prev => ({
        ...prev,
        timeEntries: newTimeEntries
      }));
    }
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    handleCanvasClick(event);
  };

  const calculateTotals = () => {
    const totals = { offDuty: 0, sleeper: 0, driving: 0, onDuty: 0 };
    
    editableData.timeEntries.forEach(entry => {
      switch (entry.status) {
        case 'off-duty': totals.offDuty += 15; break;  // 15 minutes per quarter-hour
        case 'sleeper': totals.sleeper += 15; break;
        case 'driving': totals.driving += 15; break;
        case 'on-duty': totals.onDuty += 15; break;
      }
    });

    return totals;
  };

  const checkCompliance = (totals: { driving: number; onDuty: number }) => {
    // Basic FMCSA compliance checks
    return totals.driving <= 660 && totals.onDuty <= 840; // 11h driving, 14h on-duty in minutes
  };

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  const handlePrevDay = () => {
    if (selectedLogIndex > 0) {
      const newIndex = selectedLogIndex - 1;
      setSelectedLogIndex(newIndex);
      onLogChange?.(newIndex);
    }
  };

  const handleNextDay = () => {
    if (selectedLogIndex < logs.length - 1) {
      const newIndex = selectedLogIndex + 1;
      setSelectedLogIndex(newIndex);
      onLogChange?.(newIndex);
    }
  };

  if (!currentLog) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 text-muted-foreground mx-auto mb-4">📋</div>
          <p className="text-lg font-medium text-muted-foreground">No logs available</p>
          <p className="text-sm text-muted-foreground">Generate a trip to see daily logs</p>
        </div>
      </Card>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">FMCSA ELD Daily Log - Day {selectedLogIndex + 1}</h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handlePrevDay}
              disabled={selectedLogIndex === 0}
              data-testid="button-prev-day"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev Day
            </Button>
            <Button
              variant="outline"
              onClick={handleNextDay}
              disabled={selectedLogIndex === logs.length - 1}
              data-testid="button-next-day"
            >
              Next Day
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              onClick={handleSaveLog}
              disabled={updateLogMutation.isPending}
              data-testid="button-save-log"
            >
              <Save className="mr-2 h-4 w-4" />
              {updateLogMutation.isPending ? 'Saving...' : 'Save Log'}
            </Button>
            <Button
              onClick={() => onExportPDF?.(currentLog.id)}
              data-testid="button-export-pdf"
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* FMCSA Required Header Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 border border-border rounded-md bg-muted/30">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Driver Name *</label>
              <Input value={driverName} readOnly className="font-mono" data-testid="input-driver-name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Co-Driver Name</label>
              <Input 
                value={editableData.coDriverName} 
                onChange={(e) => setEditableData(prev => ({ ...prev, coDriverName: e.target.value }))}
                className="font-mono" 
                placeholder="Optional co-driver"
                data-testid="input-co-driver-name" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date (MM/DD/YYYY) *</label>
              <Input value={currentLog.date} readOnly className="font-mono" data-testid="input-date" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Carrier Name *</label>
              <Input 
                value={editableData.carrierName} 
                onChange={(e) => setEditableData(prev => ({ ...prev, carrierName: e.target.value }))}
                className="text-sm"
                required
                data-testid="input-carrier-name" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">DOT Number</label>
              <Input 
                value={editableData.dotNumber} 
                onChange={(e) => setEditableData(prev => ({ ...prev, dotNumber: e.target.value }))}
                className="font-mono"
                placeholder="DOT-XXXXXXX"
                data-testid="input-dot-number" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time Zone *</label>
              <select 
                value={editableData.timeZone} 
                onChange={(e) => setEditableData(prev => ({ ...prev, timeZone: e.target.value }))}
                className="w-full h-10 px-3 py-2 border border-input bg-background text-sm rounded-md"
                data-testid="select-time-zone"
              >
                {TIME_ZONES.map(tz => (
                  <option key={tz} value={tz}>
                    {tz.replace('America/', '').replace('Pacific/', '').replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Truck/Tractor Number</label>
              <Input 
                value={editableData.truckNumber} 
                onChange={(e) => setEditableData(prev => ({ ...prev, truckNumber: e.target.value }))}
                className="font-mono"
                placeholder="Truck #"
                data-testid="input-truck-number" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trailer Number(s)</label>
              <Input 
                value={editableData.trailerNumbers} 
                onChange={(e) => setEditableData(prev => ({ ...prev, trailerNumbers: e.target.value }))}
                className="font-mono"
                placeholder="Trailer #(s)"
                data-testid="input-trailer-numbers" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Total Miles Driving Today *</label>
              <Input 
                type="number"
                value={editableData.totalMiles} 
                onChange={(e) => setEditableData(prev => ({ ...prev, totalMiles: e.target.value }))}
                className="font-mono" 
                data-testid="input-total-miles"
              />
            </div>
          </div>
        </div>

        {/* Additional FMCSA Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 border border-border rounded-md bg-muted/20">
          <div>
            <label className="block text-sm font-medium mb-1">Main Office Address</label>
            <Input 
              value={editableData.mainOfficeAddress} 
              onChange={(e) => setEditableData(prev => ({ ...prev, mainOfficeAddress: e.target.value }))}
              className="text-sm"
              placeholder="Company main office address"
              data-testid="input-main-office" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shipping Document Numbers</label>
            <Input 
              value={editableData.shippingDocNumbers} 
              onChange={(e) => setEditableData(prev => ({ ...prev, shippingDocNumbers: e.target.value }))}
              className="font-mono"
              placeholder="Bill of lading, etc."
              data-testid="input-shipping-docs" 
            />
          </div>
        </div>

        {/* Drawing Tools */}
        <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-md">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Drawing Mode:</span>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <Button
                key={key}
                variant={drawingMode === key ? "default" : "outline"}
                size="sm"
                onClick={() => setDrawingMode(key as DrawingMode)}
                className="text-xs"
                style={{ 
                  backgroundColor: drawingMode === key ? STATUS_COLORS[key as keyof typeof STATUS_COLORS] : undefined,
                  borderColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS]
                }}
                data-testid={`button-mode-${key}`}
              >
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
                ></div>
                {label.split('. ')[1]}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Click on the grid to set driver status for each 15-minute period
          </div>
        </div>

        {/* Time Headers - Quarter Hour Resolution */}
        <div className="mb-2">
          <div className="flex">
            <div className="w-32 text-center text-sm font-medium py-2">Status</div>
            <div className="flex-1">
              <div className="flex">
                <div className="flex-1 text-center text-sm font-medium py-2 bg-blue-50 border-x">
                  MIDNIGHT ← AM → NOON
                </div>
                <div className="flex-1 text-center text-sm font-medium py-2 bg-orange-50 border-x">
                  NOON ← PM → MIDNIGHT
                </div>
              </div>
              <div className="flex text-xs text-center">
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="flex-1 py-1 border-r border-border">
                    {i === 0 ? '12' : i <= 12 ? i : i - 12}{i < 12 ? 'A' : 'P'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ELD Grid Canvas - 96 Quarter Hours */}
        <div className="border border-border rounded-md overflow-hidden mb-6">
          <div className="flex">
            <div className="w-32 bg-muted">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <div 
                  key={key} 
                  className="h-20 flex items-center justify-center text-sm font-medium border-b border-border"
                  style={{ backgroundColor: `${STATUS_COLORS[key as keyof typeof STATUS_COLORS]}20` }}
                >
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
                    ></div>
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                onMouseDown={() => setIsDrawing(true)}
                onMouseUp={() => setIsDrawing(false)}
                onMouseMove={handleCanvasMouseMove}
                className="w-full cursor-crosshair border-l border-border"
                data-testid="eld-canvas"
              />
            </div>
          </div>
        </div>

        {/* Daily Summary - Updated to show minutes */}
        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-md">
          {Object.entries({
            'Off Duty': { minutes: totals.offDuty, color: STATUS_COLORS['off-duty'] },
            'Sleeper': { minutes: totals.sleeper, color: STATUS_COLORS['sleeper'] },
            'Driving': { minutes: totals.driving, color: STATUS_COLORS['driving'] },
            'On Duty': { minutes: totals.onDuty, color: STATUS_COLORS['on-duty'] }
          }).map(([label, { minutes, color }]) => (
            <div key={label} className="text-center">
              <div className="flex items-center justify-center mb-2">
                <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: color }}></div>
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="text-2xl font-bold font-mono" data-testid={`total-${label.toLowerCase().replace(' ', '-')}`}>
                {formatMinutesToHours(minutes)}
              </div>
            </div>
          ))}
        </div>

        {/* Compliance Status */}
        <div className="mb-6 p-3 rounded-md border" style={{ 
          backgroundColor: checkCompliance(totals) ? '#dcfce7' : '#fef2f2',
          borderColor: checkCompliance(totals) ? '#16a34a' : '#dc2626'
        }}>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${checkCompliance(totals) ? 'bg-green-600' : 'bg-red-600'}`}></div>
            <span className="text-sm font-medium">
              {checkCompliance(totals) ? 'COMPLIANT' : 'NON-COMPLIANT'} - {formatMinutesToHours(totals.driving)} driving, {formatMinutesToHours(totals.onDuty)} on-duty
            </span>
          </div>
        </div>

        {/* Remarks Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Remarks</label>
            <Textarea
              value={editableData.remarks}
              onChange={(e) => setEditableData(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Enter locations, special circumstances, or other remarks..."
              className="min-h-[100px]"
              data-testid="textarea-remarks"
            />
          </div>
          
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Driver's Signature: _________________________ Date: _______
            </div>
            <div className="text-xs text-muted-foreground">
              24 Hr. Period Starting Time: Midnight {editableData.timeZone.replace('America/', '').replace('_', ' ')}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FMCSAELDLog;