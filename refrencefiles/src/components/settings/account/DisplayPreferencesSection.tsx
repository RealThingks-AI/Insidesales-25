import { useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Sun, Moon, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DisplayPrefs {
  date_format: string;
  time_format: string;
  currency: string;
  default_module: string;
}

interface DisplayPreferencesSectionProps {
  displayPrefs: DisplayPrefs;
  setDisplayPrefs: React.Dispatch<React.SetStateAction<DisplayPrefs>>;
  theme: string;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  userId: string;
}

const DisplayPreferencesSection = ({ 
  displayPrefs, 
  setDisplayPrefs, 
  theme, 
  setTheme,
  userId 
}: DisplayPreferencesSectionProps) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(displayPrefs));

  // Auto-save with debounce
  const saveToDatabase = useCallback(async (prefs: DisplayPrefs) => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      lastSavedRef.current = JSON.stringify(prefs);
    } catch (error) {
      console.error('Error saving display preferences:', error);
      toast.error('Failed to save display preferences');
    }
  }, [userId]);

  // Debounced save effect
  useEffect(() => {
    const currentPrefs = JSON.stringify(displayPrefs);
    if (currentPrefs === lastSavedRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveToDatabase(displayPrefs);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [displayPrefs, saveToDatabase]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Display Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Theme */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Theme</Label>
            <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" />Light</div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" />Dark</div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" />System</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Module */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Default Module</Label>
            <Select
              value={displayPrefs.default_module}
              onValueChange={(value) => setDisplayPrefs(p => ({ ...p, default_module: value }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dashboard">Dashboard</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="deals">Deals</SelectItem>
                <SelectItem value="contacts">Contacts</SelectItem>
                <SelectItem value="accounts">Accounts</SelectItem>
                <SelectItem value="tasks">Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Currency</Label>
            <Select
              value={displayPrefs.currency}
              onValueChange={(value) => setDisplayPrefs(p => ({ ...p, currency: value }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ INR (Rupee)</SelectItem>
                <SelectItem value="USD">$ USD (Dollar)</SelectItem>
                <SelectItem value="EUR">€ EUR (Euro)</SelectItem>
                <SelectItem value="GBP">£ GBP (Pound)</SelectItem>
                <SelectItem value="AED">د.إ AED (Dirham)</SelectItem>
                <SelectItem value="SGD">S$ SGD (Singapore)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Format */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Date Format</Label>
            <Select
              value={displayPrefs.date_format}
              onValueChange={(value) => setDisplayPrefs(p => ({ ...p, date_format: value }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Time Format */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Time Format</Label>
            <Select
              value={displayPrefs.time_format}
              onValueChange={(value) => setDisplayPrefs(p => ({ ...p, time_format: value }))}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour</SelectItem>
                <SelectItem value="24h">24-hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DisplayPreferencesSection;
