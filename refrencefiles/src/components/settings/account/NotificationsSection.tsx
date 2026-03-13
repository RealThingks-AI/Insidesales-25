import { useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Clock, Building2, Users, UserCheck, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationPrefs {
  email_notifications: boolean;
  in_app_notifications: boolean;
  lead_assigned: boolean;
  deal_updates: boolean;
  task_reminders: boolean;
  meeting_reminders: boolean;
  weekly_digest: boolean;
  notification_frequency: string;
  leads_notifications: boolean;
  contacts_notifications: boolean;
  accounts_notifications: boolean;
}

interface NotificationsSectionProps {
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: React.Dispatch<React.SetStateAction<NotificationPrefs>>;
  userId: string;
}

const NotificationsSection = ({ notificationPrefs, setNotificationPrefs, userId }: NotificationsSectionProps) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify(notificationPrefs));
  const isInitialMount = useRef(true);

  const saveToDatabase = useCallback(async (prefs: NotificationPrefs) => {
    if (!userId) return;
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      if (error) throw error;
      lastSavedRef.current = JSON.stringify(prefs);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error('Failed to save notification preferences');
    }
  }, [userId]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedRef.current = JSON.stringify(notificationPrefs);
      return;
    }
    const currentPrefs = JSON.stringify(notificationPrefs);
    if (currentPrefs === lastSavedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveToDatabase(notificationPrefs), 600);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [notificationPrefs, saveToDatabase]);

  const togglePref = (key: keyof NotificationPrefs) => {
    setNotificationPrefs(p => ({ ...p, [key]: !p[key] }));
  };

  const deliveryMethods = [
    { key: 'email_notifications' as const, label: 'Email', icon: Mail },
    { key: 'in_app_notifications' as const, label: 'In-App', icon: Bell },
  ];

  const eventTriggers = [
    { key: 'lead_assigned' as const, label: 'Lead Assigned' },
    { key: 'deal_updates' as const, label: 'Deal Updates' },
    { key: 'task_reminders' as const, label: 'Task Reminders' },
    { key: 'meeting_reminders' as const, label: 'Meeting Reminders' },
    { key: 'weekly_digest' as const, label: 'Weekly Digest' },
  ];

  const moduleNotifications = [
    { key: 'leads_notifications' as const, label: 'Leads', icon: UserCheck },
    { key: 'contacts_notifications' as const, label: 'Contacts', icon: Users },
    { key: 'accounts_notifications' as const, label: 'Accounts', icon: Building2 },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Frequency */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Delivery Frequency</span>
          </div>
          <Select 
            value={notificationPrefs.notification_frequency} 
            onValueChange={(v) => setNotificationPrefs(p => ({ ...p, notification_frequency: v }))}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instant">Instant</SelectItem>
              <SelectItem value="daily">Daily Digest</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Delivery Methods */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Delivery Methods</Label>
          <div className="grid grid-cols-3 gap-2">
            {deliveryMethods.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </div>
                <Switch checked={notificationPrefs[key]} onCheckedChange={() => togglePref(key)} />
              </div>
            ))}
          </div>
        </div>

        {/* Module Notifications */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Module Notifications</Label>
          <div className="grid grid-cols-3 gap-2">
            {moduleNotifications.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </div>
                <Switch checked={notificationPrefs[key]} onCheckedChange={() => togglePref(key)} />
              </div>
            ))}
          </div>
        </div>

        {/* Event Triggers */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Event Triggers</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {eventTriggers.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30">
                <span className="text-sm">{label}</span>
                <Switch checked={notificationPrefs[key]} onCheckedChange={() => togglePref(key)} />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationsSection;
