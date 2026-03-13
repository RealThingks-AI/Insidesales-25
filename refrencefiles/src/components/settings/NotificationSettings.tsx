import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Loader2 } from 'lucide-react';

interface NotificationPrefs {
  email_notifications: boolean;
  in_app_notifications: boolean;
  push_notifications: boolean;
  lead_assigned: boolean;
  deal_updates: boolean;
  task_reminders: boolean;
  meeting_reminders: boolean;
  weekly_digest: boolean;
}

const NotificationSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    email_notifications: true,
    in_app_notifications: true,
    push_notifications: false,
    lead_assigned: true,
    deal_updates: true,
    task_reminders: true,
    meeting_reminders: true,
    weekly_digest: false,
  });

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPrefs({
          email_notifications: data.email_notifications,
          in_app_notifications: data.in_app_notifications,
          push_notifications: data.push_notifications,
          lead_assigned: data.lead_assigned,
          deal_updates: data.deal_updates,
          task_reminders: data.task_reminders,
          meeting_reminders: data.meeting_reminders,
          weekly_digest: data.weekly_digest,
        });
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          ...prefs,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
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
          <Bell className="h-4 w-4" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delivery Methods */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Delivery Methods
          </p>
          <div className="grid gap-2">
            <div className="flex items-center justify-between py-1">
              <Label htmlFor="email_notifications" className="text-sm cursor-pointer">
                Email
              </Label>
              <Switch
                id="email_notifications"
                checked={prefs.email_notifications}
                onCheckedChange={() => togglePref('email_notifications')}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="in_app_notifications" className="text-sm cursor-pointer">
                In-App
              </Label>
              <Switch
                id="in_app_notifications"
                checked={prefs.in_app_notifications}
                onCheckedChange={() => togglePref('in_app_notifications')}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="push_notifications" className="text-sm cursor-pointer">
                Push
              </Label>
              <Switch
                id="push_notifications"
                checked={prefs.push_notifications}
                onCheckedChange={() => togglePref('push_notifications')}
              />
            </div>
          </div>
        </div>

        {/* Event Triggers */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Event Triggers
          </p>
          <div className="grid gap-2">
            <div className="flex items-center justify-between py-1">
              <Label htmlFor="lead_assigned" className="text-sm cursor-pointer">
                Lead Assigned
              </Label>
              <Switch
                id="lead_assigned"
                checked={prefs.lead_assigned}
                onCheckedChange={() => togglePref('lead_assigned')}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="deal_updates" className="text-sm cursor-pointer">
                Deal Updates
              </Label>
              <Switch
                id="deal_updates"
                checked={prefs.deal_updates}
                onCheckedChange={() => togglePref('deal_updates')}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="task_reminders" className="text-sm cursor-pointer">
                Task Reminders
              </Label>
              <Switch
                id="task_reminders"
                checked={prefs.task_reminders}
                onCheckedChange={() => togglePref('task_reminders')}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="meeting_reminders" className="text-sm cursor-pointer">
                Meeting Reminders
              </Label>
              <Switch
                id="meeting_reminders"
                checked={prefs.meeting_reminders}
                onCheckedChange={() => togglePref('meeting_reminders')}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <Label htmlFor="weekly_digest" className="text-sm cursor-pointer">
                Weekly Digest
              </Label>
              <Switch
                id="weekly_digest"
                checked={prefs.weekly_digest}
                onCheckedChange={() => togglePref('weekly_digest')}
              />
            </div>
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

export default NotificationSettings;
