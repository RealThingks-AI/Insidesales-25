import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useCRUDAudit } from '@/hooks/useCRUDAudit';
import type { Campaign, CampaignAccount, CampaignContact, CampaignCommunication, CampaignMaterial } from '@/types/campaign';

export function useCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logCreate, logUpdate, logDelete } = useCRUDAudit();

  const campaignsQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    enabled: !!user,
  });

  const createCampaign = useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data, error } = await supabase
        .from('campaigns')
        .insert({ ...campaign, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign created successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error creating campaign', description: err.message, variant: 'destructive' });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update({ ...updates, modified_by: user!.id, modified_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign updated successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating campaign', description: err.message, variant: 'destructive' });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting campaign', description: err.message, variant: 'destructive' });
    },
  });

  const cloneCampaign = useMutation({
    mutationFn: async (original: Campaign) => {
      // Create new campaign with reset status and "Copy of" prefix
      const { data: newCampaign, error: campError } = await supabase
        .from('campaigns')
        .insert({
          campaign_name: `Copy of ${original.campaign_name}`,
          campaign_type: original.campaign_type,
          description: original.description,
          target_audience: original.target_audience,
          region: original.region,
          country: original.country,
          message_strategy: original.message_strategy,
          start_date: original.start_date,
          end_date: original.end_date,
          status: 'Draft',
          owner: original.owner,
          created_by: user!.id,
        } as any)
        .select()
        .single();
      if (campError) throw campError;

      // Clone email templates
      const { data: templates } = await supabase
        .from('campaign_email_templates')
        .select('*')
        .eq('campaign_id', original.id);

      if (templates?.length) {
        await supabase.from('campaign_email_templates').insert(
          templates.map(({ id, campaign_id, created_at, ...t }: any) => ({
            ...t,
            campaign_id: newCampaign.id,
            created_by: user!.id,
          }))
        );
      }

      // Clone phone scripts
      const { data: scripts } = await supabase
        .from('campaign_phone_scripts')
        .select('*')
        .eq('campaign_id', original.id);

      if (scripts?.length) {
        await supabase.from('campaign_phone_scripts').insert(
          scripts.map(({ id, campaign_id, created_at, ...s }: any) => ({
            ...s,
            campaign_id: newCampaign.id,
            created_by: user!.id,
          }))
        );
      }

      return newCampaign;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: 'Campaign duplicated', description: `"${data.campaign_name}" created as Draft` });
    },
    onError: (err: any) => {
      toast({ title: 'Error duplicating campaign', description: err.message, variant: 'destructive' });
    },
  });

  return { campaignsQuery, createCampaign, updateCampaign, deleteCampaign, cloneCampaign };
}

export function useCampaignAccounts(campaignId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['campaign_accounts', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_accounts')
        .select('*, accounts(account_name, industry, country, account_owner)')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return data as CampaignAccount[];
    },
    enabled: !!campaignId && !!user,
  });

  const addAccount = useMutation({
    mutationFn: async ({ accountId }: { accountId: string }) => {
      const { error } = await supabase.from('campaign_accounts').insert({
        campaign_id: campaignId,
        account_id: accountId,
        created_by: user!.id,
      } as any);
      // Ignore unique constraint violations (duplicate already in campaign)
      if (error && !error.message.includes('unique')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
    },
    onError: (err: any) => {
      toast({ title: 'Error adding account', description: err.message, variant: 'destructive' });
    },
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
    },
  });

  const updateAccountStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('campaign_accounts').update({ status } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_accounts', campaignId] });
    },
  });

  return { query, addAccount, removeAccount, updateAccountStatus };
}

export function useCampaignContacts(campaignId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['campaign_contacts', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_contacts')
        .select('*, contacts(contact_name, email, phone_no, linkedin, position, company_name)')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return data as CampaignContact[];
    },
    enabled: !!campaignId && !!user,
  });

  const addContact = useMutation({
    mutationFn: async ({ contactId, accountId }: { contactId: string; accountId?: string }) => {
      const { error } = await supabase.from('campaign_contacts').insert({
        campaign_id: campaignId,
        contact_id: contactId,
        account_id: accountId || null,
        created_by: user!.id,
      } as any);
      // Ignore unique constraint violations (duplicate already in campaign)
      if (error && !error.message.includes('unique')) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
    },
    onError: (err: any) => {
      toast({ title: 'Error adding contact', description: err.message, variant: 'destructive' });
    },
  });

  const removeContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
    },
  });

  const updateContactStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from('campaign_contacts').update({ stage } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_contacts', campaignId] });
    },
  });

  return { query, addContact, removeContact, updateContactStage };
}

export function useCampaignCommunications(campaignId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['campaign_communications', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_communications')
        .select('*, contacts(contact_name), accounts(account_name)')
        .eq('campaign_id', campaignId!)
        .order('communication_date', { ascending: false });
      if (error) throw error;
      return data as CampaignCommunication[];
    },
    enabled: !!campaignId && !!user,
  });

  const addCommunication = useMutation({
    mutationFn: async (comm: Partial<CampaignCommunication>) => {
      const { error } = await supabase.from('campaign_communications').insert({
        ...comm,
        campaign_id: campaignId,
        owner: user!.id,
        created_by: user!.id,
      } as any);
      if (error) throw error;

      // Cross-link email communications to email_history for activity tracking
      if (comm.communication_type === 'Email' && comm.contact_id) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('email, contact_name')
          .eq('id', comm.contact_id)
          .single();

        if (contact?.email) {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from('email_history').insert({
            subject: comm.subject || 'Campaign Email',
            sender_email: userData?.user?.email || 'unknown',
            recipient_email: contact.email,
            recipient_name: contact.contact_name,
            contact_id: comm.contact_id,
            account_id: comm.account_id || null,
            sent_by: user!.id,
            status: (comm.email_status || 'sent').toLowerCase(),
            body: comm.body || null,
          } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_communications', campaignId] });
      toast({ title: 'Communication logged' });
    },
    onError: (err: any) => {
      toast({ title: 'Error logging communication', description: err.message, variant: 'destructive' });
    },
  });

  return { query, addCommunication };
}

export function useCampaignMaterials(campaignId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['campaign_materials', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_materials')
        .select('*')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return data as CampaignMaterial[];
    },
    enabled: !!campaignId && !!user,
  });

  const uploadMaterial = useMutation({
    mutationFn: async ({ file, fileType }: { file: File; fileType: string }) => {
      const filePath = `${user!.id}/${campaignId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('campaign-materials')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('campaign_materials').insert({
        campaign_id: campaignId,
        file_name: file.name,
        file_path: filePath,
        file_type: fileType,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_materials', campaignId] });
      toast({ title: 'Material uploaded' });
    },
    onError: (err: any) => {
      toast({ title: 'Error uploading material', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string }) => {
      await supabase.storage.from('campaign-materials').remove([filePath]);
      const { error } = await supabase.from('campaign_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_materials', campaignId] });
      toast({ title: 'Material deleted' });
    },
  });

  return { query, uploadMaterial, deleteMaterial };
}

export function useCampaignEmailTemplates(campaignId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['campaign_email_templates', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_email_templates')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!campaignId && !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async (template: Record<string, any>) => {
      const { error } = await supabase.from('campaign_email_templates').insert({
        ...template,
        campaign_id: campaignId,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_email_templates', campaignId] });
      toast({ title: 'Email template created' });
    },
    onError: (err: any) => {
      toast({ title: 'Error creating template', description: err.message, variant: 'destructive' });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any> & { id: string }) => {
      const { error } = await supabase.from('campaign_email_templates').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_email_templates', campaignId] });
      toast({ title: 'Template updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating template', description: err.message, variant: 'destructive' });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_email_templates', campaignId] });
      toast({ title: 'Template deleted' });
    },
  });

  return { query, createTemplate, updateTemplate, deleteTemplate };
}

export function useCampaignPhoneScripts(campaignId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['campaign_phone_scripts', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_phone_scripts')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!campaignId && !!user,
  });

  const createScript = useMutation({
    mutationFn: async (script: Record<string, any>) => {
      const { error } = await supabase.from('campaign_phone_scripts').insert({
        ...script,
        campaign_id: campaignId,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_phone_scripts', campaignId] });
      toast({ title: 'Phone script created' });
    },
    onError: (err: any) => {
      toast({ title: 'Error creating script', description: err.message, variant: 'destructive' });
    },
  });

  const updateScript = useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any> & { id: string }) => {
      const { error } = await supabase.from('campaign_phone_scripts').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_phone_scripts', campaignId] });
      toast({ title: 'Script updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error updating script', description: err.message, variant: 'destructive' });
    },
  });

  const deleteScript = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaign_phone_scripts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_phone_scripts', campaignId] });
      toast({ title: 'Script deleted' });
    },
  });

  return { query, createScript, updateScript, deleteScript };
}

export function useCampaignAggregates() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['campaign_aggregates'],
    queryFn: async () => {
      // First get all campaign IDs
      const { data: campaigns } = await supabase.from('campaigns').select('id');
      if (!campaigns?.length) return {};

      const counts: Record<string, { accounts: number; contacts: number; deals: number }> = {};

      // Use count queries per campaign to avoid 1000-row limit
      await Promise.all(
        campaigns.map(async (c: any) => {
          const [accRes, conRes, dealRes] = await Promise.all([
            supabase.from('campaign_accounts').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
            supabase.from('campaign_contacts').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
            supabase.from('deals').select('id', { count: 'exact', head: true }).eq('campaign_id', c.id),
          ]);
          counts[c.id] = {
            accounts: accRes.count ?? 0,
            contacts: conRes.count ?? 0,
            deals: dealRes.count ?? 0,
          };
        })
      );

      return counts;
    },
    enabled: !!user,
  });

  return query;
}
