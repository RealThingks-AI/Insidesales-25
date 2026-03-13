
import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { Button } from "./ui/button";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CRMLayoutProps {
  children: ReactNode;
}

export const CRMLayout = ({ children }: CRMLayoutProps) => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-border px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-foreground">CRM Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <NotificationBell size="small" />
            
            {/* User Menu */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="text-sm">{user?.email}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
