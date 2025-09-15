import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Package, FlagIcon, Calculator, ChevronDown, Check, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMotion } from '@/components/ui/motion-provider';
import { getAccessibleMotionProps } from '@/lib/motion';
import { TripFormData } from '../types/trucking';

const tripFormSchema = z.object({
  currentLocation: z.string().min(1, "Current location is required"),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropoffLocation: z.string().min(1, "Dropoff location is required"),
  currentCycleHours: z.coerce.number().min(0, "Must be 0 or greater").max(70, "Cannot exceed 70 hours"),
  estimatedWeight: z.coerce.number().min(1000, "Weight must be at least 1000 lbs").max(80000, "Weight cannot exceed 80,000 lbs"),
  driverId: z.string().min(1, "Driver ID is required")
});

interface TripPlanningFormProps {
  onSubmit: (data: TripFormData) => void;
  isLoading?: boolean;
  driverId: string;
}

const TripPlanningForm: React.FC<TripPlanningFormProps> = ({
  onSubmit,
  isLoading = false,
  driverId
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [validatedFields, setValidatedFields] = useState<Set<string>>(new Set());
  const { setIsLoading: setGlobalLoading, reducedMotion } = useMotion();
  
  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      currentLocation: "",
      pickupLocation: "",
      dropoffLocation: "",
      currentCycleHours: 0,
      estimatedWeight: 80000,
      driverId
    }
  });

  // Update global loading state
  useEffect(() => {
    setGlobalLoading(isLoading);
  }, [isLoading, setGlobalLoading]);

  // Track field validation for success animations
  const handleFieldBlur = (fieldName: string, value: any) => {
    const fieldSchema = tripFormSchema.shape[fieldName as keyof typeof tripFormSchema.shape];
    if (fieldSchema) {
      try {
        fieldSchema.parse(value);
        setValidatedFields(prev => new Set([...Array.from(prev), fieldName]));
      } catch {
        setValidatedFields(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.delete(fieldName);
          return newSet;
        });
      }
    }
  };

  const handleSubmit = (data: TripFormData) => {
    onSubmit(data);
  };

  return (
    <motion.div 
      {...getAccessibleMotionProps('fadeUp', reducedMotion)}
    >
      <Card className="p-6 overflow-hidden">
        <motion.div 
          className="flex items-center space-x-2 mb-6"
          {...getAccessibleMotionProps('slideIn', reducedMotion)}
        >
          <motion.div
            whileHover={reducedMotion ? {} : { rotate: 360 }}
            transition={reducedMotion ? { duration: 0.1 } : { duration: 0.6, ease: 'easeInOut' }}
          >
            <MapPin className="text-primary" />
          </motion.div>
          <h2 className="text-xl font-semibold">Plan New Trip</h2>
        </motion.div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Current Location Field */}
            <FormField
              control={form.control}
              name="currentLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <motion.div
                        animate={form.formState.errors.currentLocation && !reducedMotion ? { x: [-10, 10, -10, 10, 0] } : {}}
                        transition={reducedMotion ? { duration: 0.1 } : { duration: 0.5 }}
                      >
                        <Input
                          {...field}
                          placeholder="Enter your current location"
                          className="pl-10 pr-10"
                          data-testid="input-current-location"
                          onBlur={(e) => handleFieldBlur('currentLocation', e.target.value)}
                        />
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <AnimatePresence>
                          {validatedFields.has('currentLocation') && !form.formState.errors.currentLocation && (
                            <motion.div
                              {...getAccessibleMotionProps('fadeIn', reducedMotion)}
                              className="absolute right-3 top-3"
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pickup Location Field */}
            <motion.div
              {...getAccessibleMotionProps('fadeUp', reducedMotion)}
            >
              <FormField
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Location</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <motion.div
                          animate={form.formState.errors.pickupLocation && !reducedMotion ? { x: [-10, 10, -10, 10, 0] } : {}}
                          transition={reducedMotion ? { duration: 0.1 } : { duration: 0.5 }}
                        >
                          <Input
                            {...field}
                            placeholder="Enter pickup address"
                            className="pl-10 pr-10"
                            data-testid="input-pickup-location"
                            onBlur={(e) => handleFieldBlur('pickupLocation', e.target.value)}
                          />
                          <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <AnimatePresence>
                            {validatedFields.has('pickupLocation') && !form.formState.errors.pickupLocation && (
                              <motion.div
                                {...getAccessibleMotionProps('fadeIn', reducedMotion)}
                                className="absolute right-3 top-3"
                              >
                                <Check className="h-4 w-4 text-green-500" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Dropoff Location Field */}
            <motion.div
              {...getAccessibleMotionProps('fadeUp', reducedMotion)}
            >
              <FormField
                control={form.control}
                name="dropoffLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dropoff Location</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <motion.div
                          animate={form.formState.errors.dropoffLocation && !reducedMotion ? { x: [-10, 10, -10, 10, 0] } : {}}
                          transition={reducedMotion ? { duration: 0.1 } : { duration: 0.5 }}
                        >
                          <Input
                            {...field}
                            placeholder="Enter delivery address"
                            className="pl-10 pr-10"
                            data-testid="input-dropoff-location"
                            onBlur={(e) => handleFieldBlur('dropoffLocation', e.target.value)}
                          />
                          <FlagIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <AnimatePresence>
                            {validatedFields.has('dropoffLocation') && !form.formState.errors.dropoffLocation && (
                              <motion.div
                                {...getAccessibleMotionProps('fadeIn', reducedMotion)}
                                className="absolute right-3 top-3"
                              >
                                <Check className="h-4 w-4 text-green-500" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            {/* Advanced Options Section */}
            <motion.div
              {...getAccessibleMotionProps('fadeUp', reducedMotion)}
            >
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <motion.div
                    {...getAccessibleMotionProps('scaleHover', reducedMotion)}
                  >
                    <Button 
                      variant="ghost" 
                      type="button"
                      className="w-full justify-between"
                      data-testid="button-advanced-toggle"
                    >
                      <div className="flex items-center space-x-2">
                        <Settings className="h-4 w-4" />
                        <span>Advanced Options</span>
                      </div>
                      <motion.div
                        animate={reducedMotion ? {} : { rotate: isAdvancedOpen ? 180 : 0 }}
                        transition={reducedMotion ? { duration: 0.1 } : { duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </motion.div>
                    </Button>
                  </motion.div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <motion.div
                    {...getAccessibleMotionProps('collapseY', reducedMotion)}
                    className="grid grid-cols-2 gap-4 pt-4"
                  >
                    <FormField
                      control={form.control}
                      name="currentCycleHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Cycle Hours</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="0"
                              max="70"
                              placeholder="0"
                              data-testid="input-cycle-hours"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="estimatedWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Weight (lbs)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min="1000"
                              max="80000"
                              placeholder="80000"
                              data-testid="input-weight"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>

            {/* Submit Button */}
            <motion.div
              {...getAccessibleMotionProps('fadeUp', reducedMotion)}
            >
              <motion.div
                {...getAccessibleMotionProps('scaleHover', reducedMotion)}
              >
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                  data-testid="button-calculate-route"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  {isLoading ? "Calculating..." : "Calculate Route & Generate Logs"}
                </Button>
              </motion.div>
            </motion.div>
          </form>
        </Form>
      </Card>
    </motion.div>
  );
};

export default TripPlanningForm;