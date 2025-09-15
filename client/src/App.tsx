import "leaflet/dist/leaflet.css";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MotionProvider, useMotion } from "@/components/ui/motion-provider";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { reducedMotion } = useMotion();
  
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </MotionConfig>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <AppContent />
      </MotionProvider>
    </QueryClientProvider>
  );
}

export default App;
