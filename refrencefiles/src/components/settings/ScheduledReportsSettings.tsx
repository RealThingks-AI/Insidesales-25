import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  FileText, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  Calendar,
  Clock,
  Mail
} from 'lucide-react';
import { format } from 'date-fns';

interface ReportSchedule {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  recipients: any;
  filters: any;
  is_enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
}

const reportTypes = [
  { value: 'deals_summary', label: 'Deals Summary' },
  { value: 'leads_activity', label: 'Leads Activity' },
  { value: 'pipeline_status', label: 'Pipeline Status' },
  { value: 'revenue_forecast', label: 'Revenue Forecast' },
  { value: 'team_performance', label: 'Team Performance' },
];

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const ScheduledReportsSettings = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ReportSchedule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    report_type: 'deals_summary',
    frequency: 'weekly',
    day_of_week: 1,
    day_of_month: 1,
    time_of_day: '08:00',
    recipients: '',
    is_enabled: true,
  });

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('report_schedules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching report schedules:', error);
      toast.error('Failed to load report schedules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleOpenModal = (schedule?: ReportSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        name: schedule.name,
        report_type: schedule.report_type,
        frequency: schedule.frequency,
        day_of_week: schedule.day_of_week || 1,
        day_of_month: schedule.day_of_month || 1,
        time_of_day: schedule.time_of_day || '08:00',
        recipients: (schedule.recipients || []).join(', '),
        is_enabled: schedule.is_enabled,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        name: '',
        report_type: 'deals_summary',
        frequency: 'weekly',
        day_of_week: 1,
        day_of_month: 1,
        time_of_day: '08:00',
        recipients: user?.email || '',
        is_enabled: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.recipients) {
      toast.error('Name and recipients are required');
      return;
    }

    setSaving(true);
    try {
      const recipientsList = formData.recipients.split(',').map(e => e.trim()).filter(Boolean);
      
      const payload = {
        name: formData.name,
        report_type: formData.report_type,
        frequency: formData.frequency,
        day_of_week: formData.frequency === 'weekly' ? formData.day_of_week : null,
        day_of_month: formData.frequency === 'monthly' ? formData.day_of_month : null,
        time_of_day: formData.time_of_day,
        recipients: recipientsList,
        is_enabled: formData.is_enabled,
        created_by: user?.id,
      };

      if (editingSchedule) {
        const { error } = await supabase
          .from('report_schedules')
          .update(payload)
          .eq('id', editingSchedule.id);

        if (error) throw error;
        toast.success('Report schedule updated successfully');
      } else {
        const { error } = await supabase
          .from('report_schedules')
          .insert(payload);

        if (error) throw error;
        toast.success('Report schedule created successfully');
      }

      setShowModal(false);
      fetchSchedules();
    } catch (error) {
      console.error('Error saving report schedule:', error);
      toast.error('Failed to save report schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report schedule?')) return;

    try {
      const { error } = await supabase
        .from('report_schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Report schedule deleted');
      fetchSchedules();
    } catch (error) {
      console.error('Error deleting report schedule:', error);
      toast.error('Failed to delete report schedule');
    }
  };

  const handleToggleEnabled = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('report_schedules')
        .update({ is_enabled: !currentState })
        .eq('id', id);

      if (error) throw error;
      fetchSchedules();
    } catch (error) {
      console.error('Error toggling report schedule:', error);
      toast.error('Failed to update report schedule');
    }
  };

  const getFrequencyLabel = (schedule: ReportSchedule) => {
    switch (schedule.frequency) {
      case 'daily':
        return `Daily at ${schedule.time_of_day}`;
      case 'weekly':
        const day = daysOfWeek.find(d => d.value === schedule.day_of_week);
        return `Every ${day?.label} at ${schedule.time_of_day}`;
      case 'monthly':
        return `Monthly on day ${schedule.day_of_month} at ${schedule.time_of_day}`;
      default:
        return schedule.frequency;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Scheduled Reports</h3>
          <p className="text-sm text-muted-foreground">
            Configure automated reports to be sent via email
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Report Schedule
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No scheduled reports yet</p>
              <p className="text-sm">Create a schedule to automatically receive reports</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className={!schedule.is_enabled ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{schedule.name}</h4>
                        <Badge variant="outline">
                          {reportTypes.find(t => t.value === schedule.report_type)?.label}
                        </Badge>
                        {!schedule.is_enabled && (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {getFrequencyLabel(schedule)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {(schedule.recipients || []).length} recipient(s)
                        </span>
                        {schedule.last_sent_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last sent: {format(new Date(schedule.last_sent_at), 'MMM d, HH:mm')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.is_enabled}
                      onCheckedChange={() => handleToggleEnabled(schedule.id, schedule.is_enabled)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(schedule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(schedule.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Edit Report Schedule' : 'Create Report Schedule'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Weekly Sales Report"
              />
            </div>

            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select 
                value={formData.report_type} 
                onValueChange={(v) => setFormData({ ...formData, report_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select 
                  value={formData.frequency} 
                  onValueChange={(v) => setFormData({ ...formData, frequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select 
                    value={formData.day_of_week.toString()} 
                    onValueChange={(v) => setFormData({ ...formData, day_of_week: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {daysOfWeek.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Select 
                    value={formData.day_of_month.toString()} 
                    onValueChange={(v) => setFormData({ ...formData, day_of_month: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time of Day</Label>
              <Input
                id="time"
                type="time"
                value={formData.time_of_day}
                onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipients">Recipients (comma-separated) *</Label>
              <Input
                id="recipients"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
              />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduledReportsSettings;