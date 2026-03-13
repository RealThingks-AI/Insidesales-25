import { useState, useEffect } from 'react';
import { Megaphone, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SettingsCard from './shared/SettingsCard';
import {
  CAMPAIGN_TYPES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_CONTACT_STAGES,
  CAMPAIGN_ACCOUNT_STATUSES,
  CALL_OUTCOMES,
  LINKEDIN_STATUSES,
  EMAIL_TYPES,
  AUDIENCE_SEGMENTS,
} from '@/types/campaign';

const CampaignSettings = () => {
  const { toast } = useToast();
  const [followUpDays, setFollowUpDays] = useState('3');
  const [maxFollowUps, setMaxFollowUps] = useState('3');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_settings' as any)
        .select('setting_key, setting_value');
      if (error) throw error;
      const settings = (data as any[]) || [];
      for (const s of settings) {
        if (s.setting_key === 'follow_up_days') setFollowUpDays(s.setting_value);
        if (s.setting_key === 'max_follow_ups') setMaxFollowUps(s.setting_value);
      }
    } catch (err) {
      console.error('Error loading campaign settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      // Upsert both settings
      for (const [key, value] of [['follow_up_days', followUpDays], ['max_follow_ups', maxFollowUps]]) {
        const { error } = await supabase
          .from('campaign_settings' as any)
          .upsert(
            { setting_key: key, setting_value: value, updated_by: userId, updated_at: new Date().toISOString() } as any,
            { onConflict: 'setting_key' }
          );
        if (error) throw error;
      }

      toast({ title: 'Campaign settings saved' });
    } catch (err: any) {
      toast({ title: 'Error saving settings', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={Megaphone}
        title="Campaign Configuration"
        description="View campaign types, stages, and default settings"
      >
        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium">Campaign Types</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CAMPAIGN_TYPES.map(t => <Badge key={t} variant="secondary">{t}</Badge>)}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Campaign Statuses</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CAMPAIGN_STATUSES.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Audience Segments</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {AUDIENCE_SEGMENTS.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Megaphone}
        title="Contact & Account Stages"
        description="Review the stages used for campaign contacts and accounts"
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label className="text-sm font-medium">Contact Stages</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CAMPAIGN_CONTACT_STAGES.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Account Statuses</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CAMPAIGN_ACCOUNT_STATUSES.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Megaphone}
        title="Outreach Options"
        description="View call outcomes, LinkedIn statuses, and email types"
      >
        <div className="grid grid-cols-3 gap-6">
          <div>
            <Label className="text-sm font-medium">Call Outcomes</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CALL_OUTCOMES.map(o => <Badge key={o} variant="outline">{o}</Badge>)}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">LinkedIn Statuses</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {LINKEDIN_STATUSES.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Email Types</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {EMAIL_TYPES.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={Megaphone}
        title="Follow-Up Rules"
        description="Configure default follow-up timing for campaigns"
      >
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <Label>Days Between Follow-Ups</Label>
            <Input
              type="number"
              min="1"
              max="30"
              value={followUpDays}
              onChange={e => setFollowUpDays(e.target.value)}
              className="h-9 mt-1"
              disabled={loading}
            />
          </div>
          <div>
            <Label>Max Follow-Ups</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={maxFollowUps}
              onChange={e => setMaxFollowUps(e.target.value)}
              className="h-9 mt-1"
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            These defaults are used when creating new campaigns. Individual campaigns can override these values.
          </p>
          <Button size="sm" onClick={handleSave} disabled={saving || loading}>
            <Save className="h-3 w-3 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
};

export default CampaignSettings;
