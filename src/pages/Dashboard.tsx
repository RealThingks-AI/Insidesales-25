import YearlyRevenueSummary from "@/components/YearlyRevenueSummary";
import { UserDashboard } from "@/components/dashboard/UserDashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { RefreshCw, LayoutDashboard, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

const currentYear = new Date().getFullYear();
const availableYears = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const Dashboard = () => {
  const [view, setView] = useState<'dashboard' | 'revenue'>('dashboard');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 h-16 border-b bg-background px-6 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-lg font-semibold text-foreground">{greeting()}, {userName}</h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle buttons */}
            <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border">
              <Button
                variant={view === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs gap-1.5 rounded-md"
                onClick={() => setView('dashboard')}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Button>
              <Button
                variant={view === 'revenue' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs gap-1.5 rounded-md"
                onClick={() => setView('revenue')}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Revenue
              </Button>
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            <NotificationBell placement="down" size="small" />

          </div>
        </div>
      </div>

      {/* Year selector below header - only in revenue view */}
      {view === 'revenue' && (
        <div className="flex-shrink-0 px-6 py-3 bg-background flex items-center justify-end">
          <Select value={selectedYear.toString()} onValueChange={value => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-6">
        {view === 'dashboard' ? (
          <UserDashboard />
        ) : (
          <YearlyRevenueSummary selectedYear={selectedYear} onYearChange={setSelectedYear} hideHeader />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
