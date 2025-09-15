import React from 'react';
import { Bell, Truck, User } from 'lucide-react';

interface NavigationProps {
  driverName?: string;
}

const Navigation: React.FC<NavigationProps> = ({ driverName = "John Driver" }) => {
  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Truck className="text-primary text-2xl" />
              <h1 className="text-xl font-bold text-primary">TruckRoute Pro</h1>
            </div>
            <span className="text-sm text-muted-foreground">ELD & Route Planning</span>
          </div>
          <div className="flex items-center space-x-6">
            <button 
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-notifications"
            >
              <Bell className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <User className="text-primary-foreground text-sm" />
              </div>
              <span className="font-medium" data-testid="text-driver-name">{driverName}</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
