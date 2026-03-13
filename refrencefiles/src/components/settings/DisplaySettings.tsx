import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useThemePreferences } from '@/hooks/useThemePreferences';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Sun, Moon, Loader2 } from 'lucide-react';

interface DisplayPrefs {
  date_format: string;
  time_format: string;
  currency: string;
  default_module: string;
}

const DisplaySettings = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useThemePreferences();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<DisplayPrefs>({
    date_format: 'DD/MM/YYYY',
    time_format: '12h',
    currency: 'INR',
    default_module: 'dashboard',
  });

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPrefs({
          date_format: data.date_format || 'DD/MM/YYYY',
          time_format: data.time_format || '12h',
          currency: data.currency || 'INR',
          default_module: data.default_module || 'dashboard',
        });
      }
    } catch (error) {
      console.error('Error fetching display preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          theme,
          ...prefs,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Row 1: Theme + Default Module */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Theme</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5" />
                    Dark
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Default Module</Label>
            <Select
              value={prefs.default_module}
              onValueChange={(value) => setPrefs(p => ({ ...p, default_module: value }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
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
        </div>

        {/* Row 2: Date Format + Time Format */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Date Format</Label>
            <Select
              value={prefs.date_format}
              onValueChange={(value) => setPrefs(p => ({ ...p, date_format: value }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2024)</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2024)</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-12-31)</SelectItem>
                <SelectItem value="DD-MMM-YYYY">DD-MMM-YYYY (31-Dec-2024)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Time Format</Label>
            <Select
              value={prefs.time_format}
              onValueChange={(value) => setPrefs(p => ({ ...p, time_format: value }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (3:30 PM)</SelectItem>
                <SelectItem value="24h">24-hour (15:30)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 3: Currency */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Currency</Label>
            <Select
              value={prefs.currency}
              onValueChange={(value) => setPrefs(p => ({ ...p, currency: value }))}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ INR (Indian Rupee)</SelectItem>
                <SelectItem value="USD">$ USD (US Dollar)</SelectItem>
                <SelectItem value="EUR">€ EUR (Euro)</SelectItem>
                <SelectItem value="GBP">£ GBP (British Pound)</SelectItem>
                <SelectItem value="AED">د.إ AED (UAE Dirham)</SelectItem>
                <SelectItem value="SGD">S$ SGD (Singapore Dollar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 border-t flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DisplaySettings;
