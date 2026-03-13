import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CampaignContact } from '@/types/campaign';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaignContact: CampaignContact | null;
}

export function ConvertToDealDialog({ open, onOpenChange, campaignId, campaignContact }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dealName, setDealName] = useState('');
  const [accountId, setAccountId] = useState<string>('');
  const [leadOwner, setLeadOwner] = useState('');
  const [loading, setLoading] = useState(false);

  const contactName = campaignContact?.contacts?.contact_name || '';

  // Pre-fill account from campaign contact
  useEffect(() => {
    if (open && campaignContact) {
      setAccountId(campaignContact.account_id || '');
      setDealName('');
      setLeadOwner('');
    }
  }, [open, campaignContact]);

  // Fetch accounts for dropdown
  const accountsQuery = useQuery({
    queryKey: ['accounts_for_deal_convert'],
    queryFn: async () => {
      const { data } = await supabase.from('accounts').select('id, account_name').order('account_name');
      return data || [];
    },
    enabled: open,
  });

  // Fetch users for owner selection
  const usersQuery = useQuery({
    queryKey: ['users_for_deal_owner'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
    enabled: open,
  });

  const handleConvert = async () => {
    if (!user || !campaignContact) return;
    setLoading(true);
    try {
      // Duplicate deal guard: check if a deal already exists for this campaign + contact combo
      const { data: existingStakeholders } = await supabase
        .from('deal_stakeholders')
        .select('deal_id')
        .eq('contact_id', campaignContact.contact_id);

      if (existingStakeholders && existingStakeholders.length > 0) {
        const dealIds = existingStakeholders.map(s => s.deal_id);
        const { data: existingDeals } = await supabase
          .from('deals')
          .select('id, deal_name')
          .eq('campaign_id', campaignId)
          .in('id', dealIds);

        if (existingDeals && existingDeals.length > 0) {
          toast({
            title: 'Deal already exists',
            description: `A deal from this campaign for ${contactName} already exists: "${existingDeals[0].deal_name}"`,
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      const name = dealName.trim() || `Campaign Lead - ${contactName}`;

      // Create deal with account and owner
      const { data: dealData, error } = await supabase.from('deals').insert({
        deal_name: name,
        stage: 'Lead',
        lead_name: contactName,
        created_by: user.id,
        campaign_id: campaignId,
        account_id: accountId || null,
        lead_owner: leadOwner || null,
      } as any).select('id').single();
      if (error) throw error;

      // Link the contact as a stakeholder on the new deal
      if (dealData?.id) {
        await supabase.from('deal_stakeholders').insert({
          deal_id: dealData.id,
          contact_id: campaignContact.contact_id,
          role: 'Champion',
          created_by: user.id,
        } as any);
      }

      // Update campaign contact stage
      await supabase.from('campaign_contacts').update({ stage: 'Qualified' } as any).eq('id', campaignContact.id);

      // Update associated campaign account status
      if (campaignContact.account_id) {
        await supabase
          .from('campaign_accounts')
          .update({ status: 'Deal Created' } as any)
          .eq('campaign_id', campaignId)
          .eq('account_id', campaignContact.account_id);
      }

      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign_aggregates'] });
      queryClient.invalidateQueries({ queryKey: ['campaign_deals', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({ title: 'Deal created', description: `"${name}" added to Lead stage` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error creating deal', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedAccountName = accountsQuery.data?.find(a => a.id === accountId)?.account_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Deal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">
            Create a new Deal at <strong>Lead</strong> stage from campaign contact <strong>{contactName}</strong>.
          </p>
          <div>
            <Label>Deal Name</Label>
            <Input
              value={dealName}
              onChange={e => setDealName(e.target.value)}
              placeholder={`Campaign Lead - ${contactName}`}
              className="h-9"
            />
          </div>
          <div>
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select account (optional)" />
              </SelectTrigger>
              <SelectContent>
                {accountsQuery.data?.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccountName && (
              <p className="text-xs text-muted-foreground mt-1">Linked to: {selectedAccountName}</p>
            )}
          </div>
          <div>
            <Label>Deal Owner</Label>
            <Select value={leadOwner} onValueChange={setLeadOwner}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select owner (optional)" />
              </SelectTrigger>
              <SelectContent>
                {usersQuery.data?.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || 'Unnamed'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>• Contact <strong>{contactName}</strong> will be linked as Champion stakeholder</p>
            <p>• Campaign contact stage will be set to <strong>Qualified</strong></p>
            {accountId && <p>• Account status will be updated to <strong>Deal Created</strong></p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConvert} disabled={loading}>
            {loading ? 'Creating...' : 'Create Deal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
