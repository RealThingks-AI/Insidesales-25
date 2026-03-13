import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface DashboardData {
  deals: { stage: string; count: number }[];
  accounts: { status: string; count: number }[];
  contacts: { source: string; count: number }[];
  actionItems: { status: string; count: number }[];
  emailStats: { sent: number; opened: number; rate: number };
  todaysAgenda: { id: string; title: string; priority: string; due_time: string | null; module_type: string }[];
  recentActivities: { id: string; action: string; resource_type: string; resource_id: string | null; created_at: string; details: any }[];
}

function countBy<T>(items: T[], key: keyof T, categories: string[]): { label: string; count: number }[] {
  const counts: Record<string, number> = {};
  categories.forEach(c => counts[c] = 0);
  items.forEach(item => {
    const val = (item[key] as string) || '';
    const match = categories.find(c => c.toLowerCase() === val.toLowerCase());
    if (match) counts[match]++;
    else {
      // put in "Other" if exists, otherwise first category
      if (counts['Other'] !== undefined) counts['Other']++;
    }
  });
  return categories.map(c => ({ label: c, count: counts[c] || 0 }));
}

export const useDashboardData = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-data', user?.id],
    queryFn: async (): Promise<DashboardData> => {
      if (!user) throw new Error('Not authenticated');

      const [dealsRes, accountsRes, contactsRes, actionItemsRes, emailRes, todayRes, activityRes] = await Promise.all([
        // Deals by stage
        supabase.from('deals').select('stage').eq('created_by', user.id),
        // Accounts by status
        supabase.from('accounts').select('status').eq('account_owner', user.id),
        // Contacts by source
        supabase.from('contacts').select('contact_source').eq('contact_owner', user.id),
        // Action items by status
        supabase.from('action_items').select('status').eq('assigned_to', user.id),
        // Email stats
        supabase.from('campaign_communications').select('email_status').eq('created_by', user.id).eq('communication_type', 'email'),
        // Today's agenda
        supabase.from('action_items').select('id, title, priority, due_time, module_type').eq('assigned_to', user.id).eq('due_date', new Date().toISOString().split('T')[0])supabase.from('action_items').select('id, title, priority, due_time, module_type').eq('assigned_to', user.id).eq('due_date', new Date().toISOString().split('T')[0]).neq('status', 'Completed').neq('status', 'Deferred').order('due_time', { ascending: true }).limit(10),.order('due_time', { ascending: true }).limit(10),
        // Recent activities
        supabase.from('security_audit_log').select('id, action, resource_type, resource_id, created_at, details').order('created_at', { ascending: false }).limit(15),
      ]);

      // Process deals
      const dealStages = ['Lead', 'Discussions', 'Qualified', 'RFQ', 'Offered', 'Won', 'Lost', 'Dropped'];
      const dealCounts = dealStages.map(stage => ({
        stage,
        count: (dealsRes.data || []).filter(d => d.stage === stage).length,
      }));

      // Process accounts
      const accountStatuses = ['New', 'Working', 'Hot', 'Nurture'];
      const accountCounts = accountStatuses.map(status => ({
        status,
        count: (accountsRes.data || []).filter(a => (a.status || 'New') === status).length,
      }));

      // Process contacts
      const contactSources = ['Website', 'Referral', 'LinkedIn', 'Other'];
      const contactData = (contactsRes.data || []);
      const contactCounts = contactSources.map(source => {
        if (source === 'Other') {
          return {
            source,
            count: contactData.filter(c => !['Website', 'Referral', 'LinkedIn'].includes(c.contact_source || '')).length,
          };
        }
        return {
          source,
          count: contactData.filter(c => c.contact_source === source).length,
        };
      });

      // Process action items
      const actionStatuses = ['Open', 'In Progress', 'Completed', 'Deferred'];
      const actionCounts = actionStatuses.map(status => ({
        status,
        count: (actionItemsRes.data || []).filter(a => a.status === status).length,
      }));

      // Process email stats
      const emails = emailRes.data || [];
      const sent = emails.length;
      const opened = emails.filter(e => e.email_status === 'opened').length;

      return {
        deals: dealCounts,
        accounts: accountCounts,
        contacts: contactCounts,
        actionItems: actionCounts,
        emailStats: { sent, opened, rate: sent > 0 ? Math.round((opened / sent) * 100) : 0 },
        todaysAgenda: (todayRes.data || []) as DashboardData['todaysAgenda'],
        recentActivities: (activityRes.data || []) as DashboardData['recentActivities'],
      };
    },
    enabled: !!user,
    staleTime: 30000,
  });
};
