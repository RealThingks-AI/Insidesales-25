import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCampaigns } from '@/hooks/useCampaigns';
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, AUDIENCE_SEGMENTS } from '@/types/campaign';
import type { Campaign } from '@/types/campaign';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
}

export function CampaignModal({ open, onOpenChange, campaign }: Props) {
  const { createCampaign, updateCampaign } = useCampaigns();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = !!campaign;

  const profilesQuery = useQuery({
    queryKey: ['profiles_for_owner'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name, "Email ID"');
      if (error) throw error;
      return data || [];
    },
  });

  const profiles = profilesQuery.data || [];

  const [form, setForm] = useState({
    campaign_name: '',
    description: '',
    campaign_type: 'Email',
    status: 'Draft',
    owner: '',
    start_date: '',
    end_date: '',
    region: '',
    country: '',
    target_audience: '',
    message_strategy: '',
  });

  useEffect(() => {
    if (campaign) {
      setForm({
        campaign_name: campaign.campaign_name,
        description: campaign.description || '',
        campaign_type: campaign.campaign_type || 'Email',
        status: campaign.status,
        owner: campaign.owner || '',
        start_date: campaign.start_date || '',
        end_date: campaign.end_date || '',
        region: campaign.region || '',
        country: campaign.country || '',
        target_audience: campaign.target_audience || '',
        message_strategy: campaign.message_strategy || '',
      });
    } else {
      setForm({
        campaign_name: '',
        description: '',
        campaign_type: 'Email',
        status: 'Draft',
        owner: user?.id || '',
        start_date: '',
        end_date: '',
        region: '',
        country: '',
        target_audience: '',
        message_strategy: '',
      });
    }
  }, [campaign, open]);

  const handleSubmit = async () => {
    if (!form.campaign_name.trim()) return;
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      toast({ title: 'Start date cannot be after end date', variant: 'destructive' });
      return;
    }
    const payload = {
      ...form,
      owner: form.owner || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };
    if (isEdit) {
      await updateCampaign.mutateAsync({ id: campaign!.id, ...payload });
    } else {
      await createCampaign.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Campaign' : 'New Campaign'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2">
            <Label>Campaign Name *</Label>
            <Input value={form.campaign_name} onChange={e => set('campaign_name', e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.campaign_type} onValueChange={v => set('campaign_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={form.owner} onValueChange={v => set('owner', v)}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p['Email ID'] || p.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Target Audience</Label>
            <Select value={form.target_audience} onValueChange={v => set('target_audience', v)}>
              <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
              <SelectContent>
                {AUDIENCE_SEGMENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
          <div>
            <Label>Region</Label>
            <Input value={form.region} onChange={e => set('region', e.target.value)} />
          </div>
          <div>
            <Label>Country</Label>
            <Input value={form.country} onChange={e => set('country', e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          </div>
          <div className="col-span-2">
            <Label>Campaign Goal / Message Strategy</Label>
            <Textarea value={form.message_strategy} onChange={e => set('message_strategy', e.target.value)} rows={3} placeholder="Describe the campaign goal and messaging approach..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.campaign_name.trim()}>
            {isEdit ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
